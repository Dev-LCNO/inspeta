// SERVIDOR FALSO. Mesmas assinaturas que a camada real (Supabase + rotas /api)
// terá; trocar a implementação não muda nenhuma tela. Regras que o banco real
// garante (RLS, unique client_uuid, versão imutável) estão reproduzidas aqui.
import { evaluateForm, validateDefinition, type DefinitionIssue, type FormDefinition, type Previous } from "@app/form-engine";
import { emitChange, kv, serial } from "./kv";
import { net } from "./net";
import { AVALIADOS, FORMULARIOS, HISTORICO, MEMBROS, ORG, PLANOS_MODELO, VERSOES } from "./seed";
import {
  OfflineError,
  type Avaliado, type FiltroInspecoes, type Formulario, type FormularioVersao, type ID, type Inspecao,
  type InspecaoEnvio, type InspecaoEvento, type Membro, type Organizacao, type PacoteSync, type ResultadoEnvio,
  type EmailSaida, type LinhaImportacao, type PlanoAcao, type PlanoModelo, type PlanoSituacao, type ResultadoImportacao,
} from "./types";
import type { Answers } from "@app/form-engine";

interface State {
  v: 1;
  formularios: Formulario[];
  versoes: FormularioVersao[];
  avaliados: Avaliado[];
  inspecoes: Inspecao[];
  eventos: InspecaoEvento[];
  eventoSeq: number;
  planosModelo: PlanoModelo[];
  planos: PlanoAcao[];
  emails: EmailSaida[];
}

const STATE_KEY = "srv:state";
const SESSAO_KEY = "inspeta:sessao";
const uuid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const clone = <T,>(v: T): T => structuredClone(v);
const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

async function load(): Promise<State> {
  const s = await kv.get<State>(STATE_KEY);
  if (s) {
    // migração de estados gravados antes do marco 2
    s.planosModelo ??= clone(PLANOS_MODELO);
    s.planos ??= [];
    s.emails ??= [];
    return s;
  }
  const fresh: State = {
    v: 1, formularios: clone(FORMULARIOS), versoes: clone(VERSOES), avaliados: clone(AVALIADOS),
    inspecoes: [], eventos: [], eventoSeq: 0, planosModelo: clone(PLANOS_MODELO), planos: [], emails: [],
  };
  for (const h of HISTORICO) {
    const m = MEMBROS.find((x) => x.id === h.responsavel_id)!;
    processar(fresh, m, { ...h, status: "completa", anexos: [], device_id: "seed" }, h.finalizada_em);
  }
  await kv.set(STATE_KEY, fresh);
  return fresh;
}
async function save(s: State, topic: string): Promise<void> {
  await kv.set(STATE_KEY, s);
  emitChange(topic);
}
function mutate<T>(topic: string, fn: (s: State) => T): Promise<T> {
  return serial(async () => {
    const s = await load();
    const out = fn(s);
    await save(s, topic);
    return out;
  });
}

function log(s: State, inspecao_id: ID, membro_id: ID | null, acao: InspecaoEvento["acao"], dados: Record<string, unknown> = {}, em = nowISO()) {
  s.eventos.push({ id: ++s.eventoSeq, inspecao_id, membro_id, acao, dados, em });
}

function anteriores(s: State, formulario_id: ID, avaliado_id: ID, excetoClient?: string): Previous {
  const form = s.formularios.find((f) => f.id === formulario_id);
  const meses = form?.rascunho.config.reincidencia_meses ?? 3;
  const limite = Date.now() - meses * 31 * 864e5;
  const ult = s.inspecoes
    .filter((i) => i.formulario_id === formulario_id && i.avaliado_id === avaliado_id && i.status !== "rascunho"
      && i.client_uuid !== excetoClient && i.finalizada_em && Date.parse(i.finalizada_em) >= limite)
    .sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""))[0];
  if (!ult) return {};
  const out: Previous = {};
  for (const [k, r] of Object.entries(ult.resultado.questoes)) out[k] = { conforme: r.conforme, resposta: ult.respostas[k] };
  return out;
}

/** Regra de servidor: grava/atualiza por client_uuid e recalcula com o form-engine. */
function processar(s: State, m: Membro, e: InspecaoEnvio, agora = nowISO()): ResultadoEnvio {
  const versao = s.versoes.find((v) => v.id === e.formulario_versao_id && v.formulario_id === e.formulario_id);
  if (!versao) return { client_uuid: e.client_uuid, ok: false, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
  if (!pode(m, "aplicar") || !podeFormulario(m, e.formulario_id))
    return { client_uuid: e.client_uuid, ok: false, erro: "sem_permissao", mensagem: "Você não tem permissão para este formulário." };

  const existente = s.inspecoes.find((i) => i.client_uuid === e.client_uuid);
  if (existente) {
    if (existente.responsavel_id !== m.id)
      return { client_uuid: e.client_uuid, ok: false, erro: "conflito", mensagem: "Inspeção pertence a outra pessoa." };
    if (existente.status !== "rascunho") {
      // reenvio de algo já finalizado: idempotente, não altera nada
      return { client_uuid: e.client_uuid, ok: true, id: existente.id, nota_pct: existente.nota_pct, classificacao: existente.classificacao };
    }
  }

  const prev = anteriores(s, e.formulario_id, e.avaliado_id, e.client_uuid);
  const ev = evaluateForm(versao.definicao, e.respostas, prev);
  if (e.status === "completa" && ev.pendentes.length)
    return { client_uuid: e.client_uuid, ok: false, erro: "invalido", mensagem: `${ev.pendentes.length} questão(ões) com pendência.` };

  const resultado: Inspecao["resultado"] = {
    nao_conformidades: ev.nao_conformidades,
    questoes: Object.fromEntries(Object.values(ev.questoes).filter((q) => q.visivel).map((q) => [q.key, {
      conforme: q.conforme, pontos: q.pontos, pontos_max: q.pontos_max, reincidente: q.reincidente, valor_calculado: q.valor_calculado,
    }])),
    topicos: Object.fromEntries(Object.values(ev.topicos).map((t) => [t.key, { pct: t.pct, desconto_pct: t.desconto_pct }])),
  };
  const base = {
    org_id: ORG.id, client_uuid: e.client_uuid, formulario_id: e.formulario_id, formulario_versao_id: e.formulario_versao_id,
    avaliado_id: e.avaliado_id, responsavel_id: m.id, status: e.status, iniciada_em: e.iniciada_em, finalizada_em: e.finalizada_em,
    geo_inicio: e.geo_inicio ?? null, geo_fim: e.geo_fim ?? null, respostas: e.respostas, anexos: e.anexos,
    nota_pct: ev.nota_pct, pontos: ev.pontos, pontos_max: ev.pontos_max,
    classificacao: ev.classificacao?.nome ?? null, classificacao_cor: ev.classificacao?.cor ?? null,
    qtd_nao_conformidades: ev.nao_conformidades.length, resultado, device_id: e.device_id, sincronizada_em: agora,
  };
  let id: ID;
  if (existente) {
    Object.assign(existente, base, { updated_at: agora });
    id = existente.id;
  } else {
    id = uuid();
    s.inspecoes.push({ id, ...base, created_at: agora, updated_at: agora });
    log(s, id, m.id, "criada", { device_id: e.device_id }, e.iniciada_em);
  }
  log(s, id, m.id, "sincronizada", { device_id: e.device_id }, agora);
  if (e.status === "completa") log(s, id, m.id, "finalizada", { nota_pct: ev.nota_pct, ncs: ev.nao_conformidades.length }, e.finalizada_em ?? agora);
  return { client_uuid: e.client_uuid, ok: true, id, nota_pct: ev.nota_pct, classificacao: ev.classificacao?.nome ?? null };
}

export function pode(m: Membro, acao: Membro["acoes"][number]): boolean {
  return m.is_master || m.acoes.includes(acao);
}
function podeFormulario(m: Membro, formId: ID): boolean {
  return pode(m, "gerenciar_formularios") || m.formularios_permitidos === "todos" || m.formularios_permitidos.includes(formId);
}
function membro(id: ID): Membro {
  const m = MEMBROS.find((x) => x.id === id);
  if (!m) throw new Error("Sessão inválida");
  return m;
}
function requireOnline() {
  if (!net.online) throw new OfflineError();
}

// ---------------------------------------------------------------------------
// API pública (assinaturas estáveis)
// ---------------------------------------------------------------------------

export const server = {
  // ---- sessão ----
  async entrar(email: string, senha: string): Promise<Membro> {
    await latency();
    const m = MEMBROS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!m || senha.length < 4) throw new Error("E-mail ou senha incorretos.");
    localStorage.setItem(SESSAO_KEY, m.id);
    emitChange("sessao");
    return m;
  },
  sessao(): Membro | null {
    const id = localStorage.getItem(SESSAO_KEY);
    return id ? MEMBROS.find((m) => m.id === id) ?? null : null;
  },
  sair(): void {
    localStorage.removeItem(SESSAO_KEY);
    emitChange("sessao");
  },
  org(): Organizacao { return ORG; },
  membros(): Membro[] { return MEMBROS; },

  // ---- formulários ----
  async listarFormularios() {
    await latency();
    const s = await load();
    return s.formularios.filter((f) => !f.arquivado).map((f) => {
      const v = s.versoes.find((x) => x.id === f.versao_publicada_id) ?? null;
      return {
        ...f,
        versao_numero: v?.numero ?? null,
        tem_alteracoes: !v || JSON.stringify(v.definicao) !== JSON.stringify(f.rascunho),
        qtd_questoes: f.rascunho.topicos.reduce((n, t) => n + t.questoes.length, 0),
        qtd_inspecoes: s.inspecoes.filter((i) => i.formulario_id === f.id && i.status !== "rascunho").length,
      };
    }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async obterFormulario(id: ID): Promise<Formulario> {
    const f = (await load()).formularios.find((x) => x.id === id);
    if (!f) throw new Error("Formulário não encontrado.");
    return clone(f);
  },
  async criarFormulario(nome: string): Promise<Formulario> {
    await latency();
    if (!nome.trim()) throw new Error("Dê um nome ao formulário.");
    const def: FormDefinition = {
      config: { calcular_nota: true, casas_decimais: 1, classificacoes: [
        { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
        { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
        { nome: "Bom", cor: "rank-good", min: 85, max: 100 },
      ] },
      topicos: [{ key: uuid(), titulo: "Tópico 1", questoes: [{ key: uuid(), titulo: "", tipo: "escolha_simples", obrigatoria: true, opcoes: [
        { key: uuid(), texto: "Sim", pontos: 10, conforme: true },
        { key: uuid(), texto: "Não", pontos: 0, conforme: false },
      ] }] }],
    };
    return mutate("formularios", (s) => {
      const f: Formulario = { id: uuid(), org_id: ORG.id, nome: nome.trim(), rascunho: def, versao_publicada_id: null, avaliados_vinculados: [], arquivado: false, created_at: nowISO(), updated_at: nowISO() };
      s.formularios.push(f);
      return clone(f);
    });
  },
  /** Autosave. `esperado` = updated_at que o editor carregou (trava otimista). */
  salvarRascunho(id: ID, patch: { nome?: string; rascunho?: FormDefinition; avaliados_vinculados?: ID[] }, esperado?: string): Promise<Formulario> {
    return mutate("formularios", (s) => {
      const f = s.formularios.find((x) => x.id === id);
      if (!f) throw new Error("Formulário não encontrado.");
      if (esperado && f.updated_at !== esperado) throw new Error("Este formulário foi alterado em outra aba. Recarregue para não perder mudanças.");
      if (patch.nome !== undefined) f.nome = patch.nome;
      if (patch.rascunho) f.rascunho = patch.rascunho;
      if (patch.avaliados_vinculados) f.avaliados_vinculados = patch.avaliados_vinculados;
      f.updated_at = nowISO();
      return clone(f);
    });
  },
  async publicar(id: ID, por: ID): Promise<{ ok: true; versao: FormularioVersao } | { ok: false; problemas: DefinitionIssue[] }> {
    await latency();
    return mutate("formularios", (s) => {
      const f = s.formularios.find((x) => x.id === id);
      if (!f) throw new Error("Formulário não encontrado.");
      const problemas = validateDefinition(f.rascunho);
      if (problemas.length) return { ok: false as const, problemas };
      const numero = Math.max(0, ...s.versoes.filter((v) => v.formulario_id === id).map((v) => v.numero)) + 1;
      const versao: FormularioVersao = { id: uuid(), formulario_id: id, numero, definicao: clone(f.rascunho), publicado_em: nowISO(), publicado_por: por };
      s.versoes.push(versao); // versões nunca são alteradas
      f.versao_publicada_id = versao.id;
      f.updated_at = nowISO();
      return { ok: true as const, versao: clone(versao) };
    });
  },
  async obterVersao(id: ID): Promise<FormularioVersao> {
    const v = (await load()).versoes.find((x) => x.id === id);
    if (!v) throw new Error("Versão não encontrada.");
    return clone(v);
  },

  // ---- avaliados ----
  async listarAvaliados(): Promise<Avaliado[]> {
    await latency();
    return clone((await load()).avaliados).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  criarAvaliado(dados: Pick<Avaliado, "nome"> & Partial<Avaliado>): Promise<Avaliado> {
    if (!dados.nome?.trim()) return Promise.reject(new Error("O nome do avaliado é obrigatório."));
    return mutate("avaliados", (s) => {
      if (dados.codigo_externo && s.avaliados.some((a) => a.codigo_externo === dados.codigo_externo))
        throw new Error(`Já existe um avaliado com o código ${dados.codigo_externo}.`);
      const a: Avaliado = { ...dados, id: uuid(), org_id: ORG.id, nome: dados.nome.trim(), ativo: true, created_at: nowISO(), updated_at: nowISO() };
      s.avaliados.push(a);
      return clone(a);
    });
  },

  // ---- inspeções (backoffice) ----
  async listarInspecoes(quem: Membro, filtro: FiltroInspecoes = {}): Promise<Inspecao[]> {
    await latency();
    const s = await load();
    const busca = (filtro.busca ?? "").trim().toLowerCase();
    const nomeAv = new Map(s.avaliados.map((a) => [a.id, a.nome]));
    const nomeF = new Map(s.formularios.map((f) => [f.id, f.nome]));
    const nomeM = new Map(MEMBROS.map((m) => [m.id, m.nome]));
    return clone(s.inspecoes.filter((i) => {
      if (!pode(quem, "ver_todas_inspecoes") && i.responsavel_id !== quem.id) return false; // = policy inspecoes_ler
      if (filtro.status && i.status !== filtro.status) return false;
      const d = (i.finalizada_em ?? i.iniciada_em).slice(0, 10);
      if (filtro.de && d < filtro.de) return false;
      if (filtro.ate && d > filtro.ate) return false;
      if (busca) {
        const hay = [nomeAv.get(i.avaliado_id), nomeF.get(i.formulario_id), nomeM.get(i.responsavel_id), i.id.slice(0, 8)].join(" ").toLowerCase();
        if (!hay.includes(busca)) return false;
      }
      return true;
    }).sort((a, b) => (b.finalizada_em ?? b.iniciada_em).localeCompare(a.finalizada_em ?? a.iniciada_em)));
  },
  async obterInspecao(quem: Membro, id: ID): Promise<Inspecao> {
    const i = (await load()).inspecoes.find((x) => x.id === id);
    if (!i || (!pode(quem, "ver_todas_inspecoes") && i.responsavel_id !== quem.id)) throw new Error("Inspeção não encontrada.");
    return clone(i);
  },
  async eventos(id: ID): Promise<InspecaoEvento[]> {
    return clone((await load()).eventos.filter((e) => e.inspecao_id === id));
  },
  async anexo(client_uuid: string): Promise<string | undefined> {
    return kv.get<string>("srv:anexo:" + client_uuid);
  },
  registrarRelatorio(id: ID, quem: ID): Promise<void> {
    return mutate("inspecoes", (s) => log(s, id, quem, "relatorio_enviado", { formato: "pdf" }));
  },

  // ---- sync do app de campo (exige rede) ----
  async pacote(membroId: ID): Promise<PacoteSync> {
    requireOnline();
    await latency();
    const m = membro(membroId);
    const s = await load();
    const formularios = s.formularios
      .filter((f) => !f.arquivado && f.versao_publicada_id && podeFormulario(m, f.id))
      .map((f) => ({
        formulario_id: f.id, nome: f.nome,
        versao: clone(s.versoes.find((v) => v.id === f.versao_publicada_id)!),
        avaliados: f.avaliados_vinculados.length ? f.avaliados_vinculados : ("todos" as const),
      }));
    const anterioresMap: PacoteSync["anteriores"] = {};
    for (const f of formularios) for (const a of s.avaliados) {
      const p = anteriores(s, f.formulario_id, a.id);
      if (Object.keys(p).length) anterioresMap[`${f.formulario_id}|${a.id}`] = p as PacoteSync["anteriores"][string];
    }
    return { cursor: nowISO(), membro: m, org: ORG, formularios, avaliados: clone(s.avaliados.filter((a) => a.ativo)), anteriores: anterioresMap };
  },
  async enviarAnexo(membroId: ID, client_uuid: string, dataUrl: string): Promise<void> {
    requireOnline();
    membro(membroId);
    await latency();
    if (dataUrl.length > 15 * 1024 * 1024 * 1.37) throw new Error("Arquivo acima de 15 MB.");
    await kv.set("srv:anexo:" + client_uuid, dataUrl); // put idempotente por client_uuid
  },
  async enviarInspecoes(membroId: ID, lote: InspecaoEnvio[]): Promise<ResultadoEnvio[]> {
    requireOnline();
    const m = membro(membroId);
    await latency();
    if (lote.length > 20) throw new Error("Lote acima de 20 inspeções.");
    const presentes = new Set(await kv.keys("srv:anexo:"));
    const res = await mutate("inspecoes", (s) => lote.map((e) => {
      const falta = e.anexos.find((a) => !presentes.has("srv:anexo:" + a.client_uuid));
      if (falta) return { client_uuid: e.client_uuid, ok: false as const, erro: "anexo_faltando" as const, mensagem: "Foto ainda não enviada." };
      return processar(s, m, e);
    }));
    // = job "inspecao-finalizada" (Inngest na arquitetura): planos de ação + e-mails. Idempotente.
    for (const r of res) {
      const e = lote.find((x) => x.client_uuid === r.client_uuid);
      if (r.ok && e?.status === "completa") await posFinalizacao(r.id);
    }
    return res;
  },


  // ---- planos de ação: modelos ----
  async listarPlanosModelo(): Promise<PlanoModelo[]> {
    await latency();
    return clone((await load()).planosModelo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  async obterPlanoModelo(id: ID): Promise<PlanoModelo> {
    const m = (await load()).planosModelo.find((x) => x.id === id);
    if (!m) throw new Error("Modelo de plano não encontrado.");
    return clone(m);
  },
  criarPlanoModelo(nome: string): Promise<PlanoModelo> {
    if (!nome.trim()) return Promise.reject(new Error("Dê um nome ao modelo."));
    return mutate("planos", (s) => {
      if (s.planosModelo.some((m) => m.nome.toLowerCase() === nome.trim().toLowerCase())) throw new Error("Já existe um modelo com esse nome.");
      const m: PlanoModelo = {
        id: uuid(), org_id: ORG.id, nome: nome.trim(), agrupamento: "por_inspecao", prazo_dias: 3, destinatario: "avaliado",
        definicao: { config: { calcular_nota: false }, topicos: [{ key: uuid(), titulo: "Correção", questoes: [
          { key: uuid(), titulo: "O que foi feito para corrigir?", tipo: "texto", obrigatoria: true },
        ] }] },
        created_at: nowISO(), updated_at: nowISO(),
      };
      s.planosModelo.push(m);
      return clone(m);
    });
  },
  salvarPlanoModelo(m: PlanoModelo): Promise<PlanoModelo> {
    return mutate("planos", (s) => {
      const i = s.planosModelo.findIndex((x) => x.id === m.id);
      if (i < 0) throw new Error("Modelo de plano não encontrado.");
      if (!m.nome.trim()) throw new Error("Dê um nome ao modelo.");
      if (m.destinatario === "fixo" && !/^\S+@\S+\.\S+$/.test(m.email_fixo ?? "")) throw new Error("Informe um e-mail válido para o destinatário fixo.");
      s.planosModelo[i] = { ...clone(m), updated_at: nowISO() };
      return clone(s.planosModelo[i]!);
    });
  },

  // ---- planos de ação: histórico ----
  async listarPlanos(quem: Membro, filtro: { busca?: string; situacao?: PlanoSituacao | "" } = {}) {
    await latency();
    const s = await load();
    const hoje = hojeNaOrg();
    const busca = (filtro.busca ?? "").trim().toLowerCase();
    return s.planos
      .filter((p) => {
        if (pode(quem, "gerenciar_planos")) return true;
        const i = s.inspecoes.find((x) => x.id === p.inspecao_id);
        return i?.responsavel_id === quem.id;
      })
      .map((p) => ({
        ...clone(p),
        situacao: situacao(p, hoje),
        avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "Formulário removido",
      }))
      .filter((p) => (!filtro.situacao || p.situacao === filtro.situacao)
        && (!busca || [p.avaliado, p.modelo_snapshot.nome, p.responsavel_email, p.formulario].join(" ").toLowerCase().includes(busca)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async planosDaInspecao(inspecao_id: ID) {
    const s = await load();
    const hoje = hojeNaOrg();
    return s.planos.filter((p) => p.inspecao_id === inspecao_id).map((p) => ({ ...clone(p), situacao: situacao(p, hoje) }));
  },
  /** Gera um link novo (o anterior deixa de valer) e, se pedido, reenvia o e-mail. */
  async novoLinkPlano(plano_id: ID, quem: Membro, reenviarPara?: string): Promise<{ link: string }> {
    if (!pode(quem, "gerenciar_planos")) throw new Error("Sem permissão.");
    await latency();
    const token = novoToken();
    const hash = await sha256(token);
    const link = linkPublico(token);
    await mutate("planos", (s) => {
      const p = s.planos.find((x) => x.id === plano_id);
      if (!p) throw new Error("Plano não encontrado.");
      p.token_hash = hash;
      if (reenviarPara) {
        if (!/^\S+@\S+\.\S+$/.test(reenviarPara)) throw new Error("E-mail inválido.");
        p.responsavel_email = reenviarPara;
        p.ultimo_email_em = nowISO();
        filaEmail(s, emailPlano(s, p, link, hash));
      }
      p.updated_at = nowISO();
    });
    return { link };
  },

  // ---- planos de ação: página pública (sem login, só com o token) ----
  async planoPorToken(token: string) {
    await latency();
    const hash = await sha256(token);
    const s = await load();
    const p = s.planos.find((x) => x.token_hash === hash);
    if (!p) throw new Error("Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
    const i = s.inspecoes.find((x) => x.id === p.inspecao_id)!;
    const v = s.versoes.find((x) => x.id === i.formulario_versao_id)!;
    const nc = p.questao_keys.map((k) => {
      let numero = 0, q = null as null | (typeof v.definicao.topicos)[number]["questoes"][number];
      for (const t of v.definicao.topicos) for (const x of t.questoes) { numero++; if (x.key === k) { q = x; break; } if (q) break; }
      return { key: k, numero, titulo: q?.titulo ?? "Questão", resposta: i.respostas[k], questao: q, reincidente: !!i.resultado.questoes[k]?.reincidente };
    });
    return {
      plano: { ...clone(p), situacao: situacao(p, hojeNaOrg()) },
      org: ORG,
      avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "",
      formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "",
      inspecao: { finalizada_em: i.finalizada_em, nota_pct: i.nota_pct, classificacao: i.classificacao, responsavel: MEMBROS.find((m) => m.id === i.responsavel_id)?.nome ?? "" },
      ncs: nc,
    };
  },
  async responderPlano(token: string, dados: { respostas: Record<string, Answers>; fotos: { client_uuid: string; nc_key: string; questao_key: string; dataUrl: string; bytes: number }[]; nome: string }): Promise<void> {
    await latency();
    const hash = await sha256(token);
    for (const f of dados.fotos) await kv.set("srv:anexo:" + f.client_uuid, f.dataUrl);
    await mutate("planos", (s) => {
      const p = s.planos.find((x) => x.token_hash === hash);
      if (!p) throw new Error("Este link não vale mais.");
      if (p.status === "finalizado") throw new Error("Este plano já foi respondido.");
      if (!dados.nome.trim()) throw new Error("Informe seu nome.");
      for (const nc of p.questao_keys) {
        const resp = { ...(dados.respostas[nc] ?? {}) };
        for (const f of dados.fotos.filter((x) => x.nc_key === nc)) {
          const a = (resp[f.questao_key] ??= {});
          a.fotos = (a.fotos ?? 0) + 1;
        }
        const ev = evaluateForm(p.modelo_snapshot.definicao, resp);
        if (ev.pendentes.length) throw new Error("Ainda há perguntas obrigatórias sem resposta.");
        p.respostas[nc] = resp;
      }
      p.anexos = dados.fotos.map((f) => ({ client_uuid: f.client_uuid, questao_key: f.questao_key, nc_key: f.nc_key, tipo: "foto", mime: "image/jpeg", bytes: f.bytes }));
      p.status = "finalizado";
      p.respondido_por = dados.nome.trim();
      p.finalizado_em = nowISO();
      p.updated_at = nowISO();
    });
  },

  // ---- e-mails (simulados: a caixa de saída mostra o que o Resend enviaria) ----
  async caixaDeSaida(): Promise<EmailSaida[]> {
    await latency();
    return clone((await load()).emails).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  },

  // ---- importação de avaliados ----
  async importarAvaliados(linhas: LinhaImportacao[], opts: { simular?: boolean } = {}): Promise<ResultadoImportacao> {
    await latency();
    const aplicar = (s: State): ResultadoImportacao => {
      const r: ResultadoImportacao = { novos: 0, atualizados: 0, erros: [] };
      const codigosNoArquivo = new Map<string, number>();
      linhas.forEach((l, k) => {
        const n = k + 2; // linha 1 = cabeçalho
        const nome = (l.nome ?? "").trim();
        const codigo = (l.codigo_externo ?? "").trim() || undefined;
        if (!nome) { r.erros.push({ linha: n, motivo: "sem nome" }); return; }
        if (l.email && !/^\S+@\S+\.\S+$/.test(l.email.trim())) { r.erros.push({ linha: n, motivo: `e-mail inválido: ${l.email}` }); return; }
        if (codigo) {
          if (codigosNoArquivo.has(codigo)) { r.erros.push({ linha: n, motivo: `código ${codigo} repetido (já está na linha ${codigosNoArquivo.get(codigo)})` }); return; }
          codigosNoArquivo.set(codigo, n);
        }
        const existente = codigo
          ? s.avaliados.find((a) => a.codigo_externo === codigo)
          : s.avaliados.find((a) => !a.codigo_externo && a.nome.toLowerCase() === nome.toLowerCase());
        const dados = {
          nome, codigo_externo: codigo,
          documento: l.documento?.trim() || undefined, email: l.email?.trim() || undefined,
          telefone: l.telefone?.trim() || undefined, endereco: l.endereco?.trim() || undefined,
        };
        if (existente) {
          for (const [k2, v2] of Object.entries(dados)) if (v2 !== undefined) (existente as unknown as Record<string, unknown>)[k2] = v2;
          existente.updated_at = nowISO();
          r.atualizados++;
        } else {
          s.avaliados.push({ ...dados, id: uuid(), org_id: ORG.id, ativo: true, created_at: nowISO(), updated_at: nowISO() });
          r.novos++;
        }
      });
      return r;
    };
    if (opts.simular) return aplicar(clone(await load()));
    return mutate("avaliados", aplicar);
  },

  /** Só para testes/demonstração: volta ao estado inicial. */
  async _reset(): Promise<void> {
    for (const k of await kv.keys("")) await kv.del(k);
    localStorage.clear();
    emitChange("reset");
  },
};

export type ServerApi = typeof server;

// ---------------------------------------------------------------------------
// planos de ação: job pós-finalização e utilitários
// ---------------------------------------------------------------------------

function hojeNaOrg(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG.fuso_horario }).format(new Date()); // yyyy-mm-dd
}
function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** "em atraso" é derivado (= view planos_acao_situacao do schema): aberto e com prazo vencido. */
function situacao(p: PlanoAcao, hoje: string): PlanoSituacao {
  return p.status === "aberto" && p.prazo < hoje ? "em_atraso" : p.status;
}
function novoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(t: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
function linkPublico(token: string): string {
  return `${location.origin}${location.pathname}#/p/${token}`;
}
function filaEmail(s: State, e: Omit<EmailSaida, "id" | "criado_em" | "status">): void {
  if (s.emails.some((x) => x.idem_key === e.idem_key)) return; // idem_key único (= emails_saida no schema)
  s.emails.push({ ...e, id: uuid(), criado_em: nowISO(), status: e.para ? "enviado" : "sem_destinatario" });
}
function emailPlano(s: State, p: PlanoAcao, link: string, hash: string): Omit<EmailSaida, "id" | "criado_em" | "status"> {
  const av = s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "";
  const prazo = p.prazo.split("-").reverse().join("/");
  return {
    idem_key: `plano:${p.id}:${hash.slice(0, 16)}`,
    para: p.responsavel_email ?? "",
    assunto: `Plano de ação: ${p.modelo_snapshot.nome} — ${av}`,
    texto: `A inspeção em ${av} encontrou ${p.questao_keys.length} ${p.questao_keys.length === 1 ? "não conformidade" : "não conformidades"} que precisam de correção até ${prazo}.\nAbra o link para registrar o que foi feito. Não precisa de senha.`,
    link,
  };
}

/** Idempotente: rodar duas vezes não cria plano nem e-mail repetido. */
async function posFinalizacao(inspecao_id: ID): Promise<void> {
  const s0 = await load();
  const i = s0.inspecoes.find((x) => x.id === inspecao_id);
  if (!i || i.status === "rascunho") return;
  const v = s0.versoes.find((x) => x.id === i.formulario_versao_id)!;
  const qByKey = new Map(v.definicao.topicos.flatMap((t) => t.questoes).map((q) => [q.key, q]));

  // grupos (modelo → NCs) conforme o agrupamento do modelo
  const grupos: { modelo: PlanoModelo; keys: string[] }[] = [];
  for (const k of i.resultado.nao_conformidades) {
    const mid = qByKey.get(k)?.plano_acao_modelo_id;
    const modelo = mid ? s0.planosModelo.find((m) => m.id === mid) : undefined;
    if (!modelo) continue;
    const g = modelo.agrupamento === "por_inspecao" ? grupos.find((x) => x.modelo.id === modelo.id) : undefined;
    if (g) g.keys.push(k); else grupos.push({ modelo, keys: [k] });
  }
  const tokens = await Promise.all(grupos.map(async () => { const t = novoToken(); return { t, h: await sha256(t) }; }));

  await mutate("planos", (s) => {
    const av = s.avaliados.find((a) => a.id === i.avaliado_id);
    grupos.forEach((g, n) => {
      const chave = [...g.keys].sort().join(",");
      if (s.planos.some((p) => p.inspecao_id === i.id && p.modelo_id === g.modelo.id && [...p.questao_keys].sort().join(",") === chave)) return;
      const para = g.modelo.destinatario === "fixo" ? g.modelo.email_fixo ?? null : av?.email ?? null;
      const p: PlanoAcao = {
        id: uuid(), org_id: ORG.id, modelo_id: g.modelo.id, modelo_snapshot: { nome: g.modelo.nome, definicao: clone(g.modelo.definicao) },
        inspecao_id: i.id, avaliado_id: i.avaliado_id, formulario_id: i.formulario_id, questao_keys: g.keys,
        responsavel_email: para, token_hash: tokens[n]!.h, prazo: somarDias(hojeNaOrg(), g.modelo.prazo_dias),
        status: "aberto", respostas: {}, anexos: [], finalizado_em: null, ultimo_email_em: para ? nowISO() : null,
        created_at: nowISO(), updated_at: nowISO(),
      };
      s.planos.push(p);
      filaEmail(s, emailPlano(s, p, linkPublico(tokens[n]!.t), tokens[n]!.h));
    });

    // relatório por e-mail, se o formulário pedir
    const cfg = v.definicao.config.relatorio?.emails;
    const destinos = new Set<string>();
    if (cfg?.avaliado && av?.email) destinos.add(av.email);
    for (const e of cfg?.extras ?? []) if (e.trim()) destinos.add(e.trim());
    const form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "";
    for (const para of destinos) {
      filaEmail(s, {
        idem_key: `relatorio:${i.id}:${para}`, para,
        assunto: `Relatório: ${form} — ${av?.nome ?? ""} — ${i.nota_pct === null ? "sem nota" : String(i.nota_pct).replace(".", ",") + "%"}`,
        texto: `Segue o relatório da inspeção finalizada em ${new Date(i.finalizada_em ?? i.iniciada_em).toLocaleString("pt-BR", { timeZone: ORG.fuso_horario })}. ${i.qtd_nao_conformidades} não conformidade(s).`,
        anexo: { tipo: "relatorio_pdf", inspecao_id: i.id },
      });
    }
    if (destinos.size) log(s, i.id, null, "relatorio_enviado", { para: [...destinos] });
  });
}
