// SERVIDOR FALSO. Mesmas assinaturas que a camada real (Supabase + rotas /api)
// terá; trocar a implementação não muda nenhuma tela. Regras que o banco real
// garante (RLS, unique client_uuid, versão imutável) estão reproduzidas aqui.
import { evaluateForm, validateDefinition, type DefinitionIssue, type FormDefinition, type Previous } from "@app/form-engine";
import { emitChange, kv, serial } from "./kv";
import { net } from "./net";
import { ACESSO_EQUIPE_NOVA, ACESSO_PESSOA_NOVA, resolverMembros } from "./acesso";
import { descreverRegra, instantesDaRegra, limiteDaOcorrencia, situacaoOcorrencia, somarDias as somarDiasAg, validarRegra } from "./agenda";
import { agendamentosIniciais, historicoDemo, AVALIADOS, EQUIPES, FORMULARIOS, FUNCOES, HISTORICO, MEMBROS_REG, ORG, PLANOS_MODELO, VERSOES } from "./seed";
import {
  OfflineError,
  type Avaliado, type FiltroInspecoes, type Formulario, type FormularioVersao, type ID, type Inspecao,
  type InspecaoEnvio, type InspecaoEvento, type Membro, type Organizacao, type PacoteSync, type ResultadoEnvio,
  type Acesso, type Aprovacao, type Agendamento, type Ocorrencia, type OcorrenciaPacote, type OcorrenciaSituacao, type RegraAgenda, type Equipe, type Funcao, type MembroRegistro,
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
  membros: MembroRegistro[];
  funcoes: Funcao[];
  equipes: Equipe[];
  agendamentos: Agendamento[];
  ocorrencias: Ocorrencia[];
  aprovacoes: Aprovacao[];
}

const STATE_KEY = "srv:state";
const SESSAO_KEY = "inspeta:sessao";
/** Cópia síncrona dos membros resolvidos (sessao() e membros() são síncronos nas telas). */
const MEMBROS_KEY = "inspeta:membros";
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
    // migração de estados gravados antes do marco 3
    s.membros ??= clone(MEMBROS_REG);
    s.funcoes ??= clone(FUNCOES);
    s.equipes ??= clone(EQUIPES);
    s.agendamentos ??= agendamentosIniciais(hojeNaOrg());
    s.ocorrencias ??= [];
    s.aprovacoes ??= [];
    if (localStorage.getItem(MEMBROS_KEY) === null) publicarMembros(s);
    return s;
  }
  const fresh: State = {
    v: 1, formularios: clone(FORMULARIOS), versoes: clone(VERSOES), avaliados: clone(AVALIADOS),
    inspecoes: [], eventos: [], eventoSeq: 0, planosModelo: clone(PLANOS_MODELO), planos: [], emails: [],
    membros: clone(MEMBROS_REG), funcoes: clone(FUNCOES), equipes: clone(EQUIPES),
    agendamentos: agendamentosIniciais(hojeNaOrg()), ocorrencias: [], aprovacoes: [],
  };
  for (const h of HISTORICO) {
    const m = membroEm(fresh, h.responsavel_id);
    processar(fresh, m, { ...h, status: "completa", anexos: [], device_id: "seed" }, h.finalizada_em);
  }
  await kv.set(STATE_KEY, fresh);
  return fresh;
}
async function save(s: State, topic: string): Promise<void> {
  await kv.set(STATE_KEY, s);
  if (topic === "membros") { publicarMembros(s); emitChange("sessao"); }
  emitChange(topic);
}
function publicarMembros(s: State): void {
  localStorage.setItem(MEMBROS_KEY, JSON.stringify(resolverMembros(s.membros, s.funcoes, s.equipes)));
}
let cacheRaw: string | null = null;
let cache: Membro[] = [];
function membrosCache(): Membro[] {
  const raw = localStorage.getItem(MEMBROS_KEY) ?? "seed";
  if (raw !== cacheRaw) {
    cache = raw === "seed" ? resolverMembros(MEMBROS_REG, FUNCOES, EQUIPES) : JSON.parse(raw) as Membro[];
    cacheRaw = raw;
  }
  return cache;
}
function membroEm(s: State, id: ID): Membro {
  const m = resolverMembros(s.membros, s.funcoes, s.equipes).find((x) => x.id === id);
  if (!m || !m.ativo) throw new Error("Sessão inválida");
  return m;
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

/** Questões que trazem a última resposta (automático) ou repetem a primeira (único). */
function questoesPreenchidas(def: FormDefinition) {
  return def.topicos.flatMap((t) => t.questoes).filter((q) => q.preenchimento_automatico || q.preenchimento_unico);
}
/** Última resposta conhecida de cada questão marcada, sem janela de tempo. Fotos e assinatura não são copiadas. */
function ultimasRespostas(s: State, def: FormDefinition, formulario_id: ID, avaliado_id: ID, excetoClient?: string): Answers {
  const qs = questoesPreenchidas(def);
  if (!qs.length) return {};
  const out: Answers = {};
  const hist = s.inspecoes.filter((i) => i.formulario_id === formulario_id && i.avaliado_id === avaliado_id && i.status !== "rascunho" && i.client_uuid !== excetoClient)
    .sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""));
  for (const q of qs) {
    const r = hist.find((i) => { const a = i.respostas[q.key]; return a && (a.opcoes?.length || a.numero != null || a.texto || a.data || a.na); })?.respostas[q.key];
    if (r) out[q.key] = { opcoes: r.opcoes, numero: r.numero, texto: r.texto, data: r.data, na: r.na };
  }
  return out;
}

/** Regra de servidor: grava/atualiza por client_uuid e recalcula com o form-engine. */
function processar(s: State, m: Membro, e: InspecaoEnvio, agora = nowISO()): ResultadoEnvio {
  const versao = s.versoes.find((v) => v.id === e.formulario_versao_id && v.formulario_id === e.formulario_id);
  if (!versao) return { client_uuid: e.client_uuid, ok: false, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
  if (!pode(m, "aplicar") || !podeFormulario(m, e.formulario_id) || !podeAvaliado(m, e.avaliado_id))
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

  // "responder uma vez por avaliado": o servidor impõe o valor já conhecido, mesmo que o aparelho mande outro
  const fixas = ultimasRespostas(s, versao.definicao, e.formulario_id, e.avaliado_id, e.client_uuid);
  for (const q of questoesPreenchidas(versao.definicao)) {
    if (q.preenchimento_unico && fixas[q.key]) e = { ...e, respostas: { ...e.respostas, [q.key]: { ...e.respostas[q.key], ...fixas[q.key] } } };
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
    ocorrencia_id: e.status === "completa" ? cumprirOcorrencia(s, m, e, existente?.id) : null,
  };
  // aprovação: as etapas vêm da versão (congeladas); o aplicador nunca escolhe o status final
  const etapas = versao.definicao.config.aprovacao?.etapas ?? [];
  const status: Inspecao["status"] = e.status === "completa" && etapas.length ? "em_aprovacao" : e.status;
  Object.assign(base, { status, aprovacao_etapa: status === "em_aprovacao" ? 1 : null });
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
  const oc = base.ocorrencia_id ? s.ocorrencias.find((o) => o.id === base.ocorrencia_id) : undefined;
  if (oc) oc.inspecao_id = id;
  if (e.status === "completa") log(s, id, m.id, "finalizada", { nota_pct: ev.nota_pct, ncs: ev.nao_conformidades.length }, e.finalizada_em ?? agora);
  if (status === "em_aprovacao") { log(s, id, null, "enviada_aprovacao", { etapa: 1, de: etapas.length }, agora); avisarAprovadores(s, id); }
  return { client_uuid: e.client_uuid, ok: true, id, nota_pct: ev.nota_pct, classificacao: ev.classificacao?.nome ?? null };
}

export function pode(m: Membro, acao: Membro["acoes"][number]): boolean {
  return m.is_master || m.acoes.includes(acao);
}
function podeFormulario(m: Membro, formId: ID): boolean {
  return pode(m, "gerenciar_formularios") || m.formularios_permitidos === "todos" || m.formularios_permitidos.includes(formId);
}
function podeAvaliado(m: Membro, avId: ID): boolean {
  return m.avaliados_permitidos === "todos" || m.avaliados_permitidos.includes(avId);
}
/** = policy inspecoes_ler: as próprias, todas (com a ação) ou as de quem a pessoa acompanha. */
export function podeVerInspecao(m: Membro, i: Pick<Inspecao, "responsavel_id">): boolean {
  return pode(m, "ver_todas_inspecoes") || i.responsavel_id === m.id || m.ve_inspecoes_de.includes(i.responsavel_id);
}
function exigir(m: Membro, acao: Membro["acoes"][number]): void {
  const atual = membrosCache().find((x) => x.id === m.id) ?? m;
  if (!atual.ativo || !pode(atual, acao)) throw new Error("Você não tem permissão para isso.");
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
    const st = await load();
    const m = resolverMembros(st.membros, st.funcoes, st.equipes).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!m || senha.length < 4) throw new Error("E-mail ou senha incorretos.");
    if (!m.ativo) throw new Error("Este acesso foi desativado. Fale com o administrador da conta.");
    localStorage.setItem(SESSAO_KEY, m.id);
    emitChange("sessao");
    return m;
  },
  sessao(): Membro | null {
    const id = localStorage.getItem(SESSAO_KEY);
    const m = id ? membrosCache().find((x) => x.id === id) : undefined;
    return m && m.ativo ? m : null;
  },
  sair(): void {
    localStorage.removeItem(SESSAO_KEY);
    emitChange("sessao");
  },
  org(): Organizacao { return ORG; },
  membros(): Membro[] { return membrosCache(); },

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
    const nomeM = new Map(membrosCache().map((m) => [m.id, m.nome]));
    return clone(s.inspecoes.filter((i) => {
      if (!podeVerInspecao(quem, i) && !ehAprovador(s, quem, i)) return false; // = policy inspecoes_ler
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
    const s = await load();
    const i = s.inspecoes.find((x) => x.id === id);
    if (!i || (!podeVerInspecao(quem, i) && !ehAprovador(s, quem, i))) throw new Error("Inspeção não encontrada.");
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
    await rodarAgenda();
    const s = await load();
    const m = membroEm(s, membroId);
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
    const avaliados = clone(s.avaliados.filter((a) => a.ativo && podeAvaliado(m, a.id)));
    const hoje = hojeNaOrg();
    const janelaDe = new Date(Date.parse(somarDiasAg(hoje, -7) + "T00:00:00Z")).toISOString();
    const agenda: OcorrenciaPacote[] = s.ocorrencias
      .filter((o) => o.status === "pendente" && o.previsto_em >= janelaDe)
      .flatMap((o) => {
        const a = s.agendamentos.find((x) => x.id === o.agendamento_id);
        if (!a || !a.responsaveis.includes(m.id) || !formularios.some((f) => f.formulario_id === a.formulario_id) || !avaliados.some((x) => x.id === a.avaliado_id)) return [];
        return [{ id: o.id, formulario_id: a.formulario_id, avaliado_id: a.avaliado_id, previsto_em: o.previsto_em, dia_inteiro: a.dia_inteiro, limite: limiteDaOcorrencia(o.previsto_em, a), descricao: descreverRegra(a) }];
      })
      .sort((x, y) => x.previsto_em.localeCompare(y.previsto_em));
    const ultimas: Record<string, Answers> = {};
    for (const f of formularios) for (const a of avaliados) {
      const u = ultimasRespostas(s, f.versao.definicao, f.formulario_id, a.id);
      if (Object.keys(u).length) ultimas[`${f.formulario_id}|${a.id}`] = u;
    }
    return { cursor: nowISO(), membro: m, org: ORG, formularios, avaliados, anteriores: anterioresMap, ultimas, agenda };
  },
  async enviarAnexo(membroId: ID, client_uuid: string, dataUrl: string): Promise<void> {
    requireOnline();
    membroEm(await load(), membroId);
    await latency();
    if (dataUrl.length > 15 * 1024 * 1024 * 1.37) throw new Error("Arquivo acima de 15 MB.");
    await kv.set("srv:anexo:" + client_uuid, dataUrl); // put idempotente por client_uuid
  },
  async enviarInspecoes(membroId: ID, lote: InspecaoEnvio[]): Promise<ResultadoEnvio[]> {
    requireOnline();
    const m = membroEm(await load(), membroId);
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
        return !!i && podeVerInspecao(quem, i);
      })
      .map((p) => ({
        ...clone(p),
        situacao: situacao(p, hoje),
        avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "Formulário removido",
      }))
      .filter((p) => (!filtro.situacao || p.situacao === filtro.situacao)
        && (!busca || [p.avaliado, p.modelo_snapshot.nome, p.responsavel_email, p.formulario].join(" ").toLowerCase().includes(busca)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.modelo_snapshot.nome.localeCompare(b.modelo_snapshot.nome, "pt-BR"));
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
    const todas = v.definicao.topicos.flatMap((t) => t.questoes); // numeração global, como no formulário
    const nc = p.questao_keys.map((k) => {
      const pos = todas.findIndex((x) => x.key === k);
      const q = pos >= 0 ? todas[pos]! : null;
      return { key: k, numero: pos + 1, titulo: q?.titulo ?? "Questão", resposta: i.respostas[k], questao: q, reincidente: !!i.resultado.questoes[k]?.reincidente };
    });
    return {
      plano: { ...clone(p), situacao: situacao(p, hojeNaOrg()) },
      org: ORG,
      avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "",
      formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "",
      inspecao: { finalizada_em: i.finalizada_em, nota_pct: i.nota_pct, classificacao: i.classificacao, responsavel: s.membros.find((m) => m.id === i.responsavel_id)?.nome ?? "" },
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

  // ---- aprovações (S32) ----
  /** O que espera a decisão desta pessoa (etapa atual inclui ela entre os aprovadores). */
  async aprovacoesPendentes(quem: Membro) {
    await latency();
    const s = await load();
    return s.inspecoes.filter((i) => i.status === "em_aprovacao" && aprovadoresDaEtapa(s, i).includes(quem.id) && i.responsavel_id !== quem.id)
      .map((i) => ({ ...clone(i), etapas: etapasDe(s, i).length,
        avaliado: s.avaliados.find((a) => a.id === i.avaliado_id)?.nome ?? "", formulario: s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "",
        responsavel: s.membros.find((m) => m.id === i.responsavel_id)?.nome ?? "" }))
      .sort((a, b) => (a.finalizada_em ?? "").localeCompare(b.finalizada_em ?? ""));
  },
  async decisoesDe(quem: Membro) {
    await latency();
    const s = await load();
    return s.aprovacoes.filter((a) => a.aprovador_id === quem.id).map((a) => {
      const i = s.inspecoes.find((x) => x.id === a.inspecao_id);
      return { ...clone(a), status: i?.status ?? "completa", avaliado: s.avaliados.find((x) => x.id === i?.avaliado_id)?.nome ?? "", formulario: s.formularios.find((f) => f.id === i?.formulario_id)?.nome ?? "", nota_pct: i?.nota_pct ?? null };
    }).sort((a, b) => b.em.localeCompare(a.em));
  },
  /** Etapas, quem aprova cada uma e o que já foi decidido. */
  async aprovacaoDaInspecao(id: ID) {
    const s = await load();
    const i = s.inspecoes.find((x) => x.id === id);
    if (!i) throw new Error("Inspeção não encontrada.");
    const nome = (mid: ID) => s.membros.find((m) => m.id === mid)?.nome ?? "—";
    return etapasDe(s, i).map((e, k) => ({
      etapa: k + 1, aprovadores: e.aprovadores.map((a) => ({ id: a, nome: nome(a) })),
      decisao: s.aprovacoes.filter((a) => a.inspecao_id === id && a.etapa === k + 1).map((a) => ({ ...clone(a), aprovador: nome(a.aprovador_id) }))[0] ?? null,
      atual: i.status === "em_aprovacao" && i.aprovacao_etapa === k + 1,
    }));
  },
  /** = POST /api/aprovacoes. Reprovar exige comentário; aprovar a última etapa fecha como aprovada. */
  decidir(quem: Membro, inspecao_id: ID, decisao: "aprovada" | "reprovada", comentario = ""): Promise<Inspecao["status"]> {
    exigir(quem, "aprovar");
    return mutate("inspecoes", (s) => {
      const i = s.inspecoes.find((x) => x.id === inspecao_id);
      if (!i) throw new Error("Inspeção não encontrada.");
      if (i.status !== "em_aprovacao") throw new Error("Esta inspeção não está esperando aprovação.");
      if (i.responsavel_id === quem.id) throw new Error("Quem aplicou não aprova a própria inspeção.");
      if (!aprovadoresDaEtapa(s, i).includes(quem.id)) throw new Error("Esta etapa não é sua.");
      if (decisao === "reprovada" && comentario.trim().length < 3) throw new Error("Diga o motivo da reprovação.");
      const etapa = i.aprovacao_etapa ?? 1;
      if (s.aprovacoes.some((a) => a.inspecao_id === i.id && a.etapa === etapa)) throw new Error("Esta etapa já foi decidida.");
      s.aprovacoes.push({ id: uuid(), org_id: ORG.id, inspecao_id: i.id, etapa, aprovador_id: quem.id, decisao, comentario: comentario.trim() || undefined, em: nowISO() });
      const total = etapasDe(s, i).length;
      if (decisao === "reprovada") { i.status = "reprovada"; i.aprovacao_etapa = null; }
      else if (etapa >= total) { i.status = "aprovada"; i.aprovacao_etapa = null; }
      else { i.aprovacao_etapa = etapa + 1; avisarAprovadores(s, i.id); }
      i.updated_at = nowISO();
      log(s, i.id, quem.id, decisao, { etapa, de: total, comentario: comentario.trim() || undefined });
      return i.status;
    });
  },

  // ---- painel de indicadores ----
  /** Preenche 12 semanas de histórico fictício (marcado "demo") para o painel ter o que mostrar. Idempotente. */
  gerarDadosDemo(quem: Membro): Promise<number> {
    if (!quem.is_master) return Promise.reject(new Error("Só o dono da conta pode gerar dados de exemplo."));
    return mutate("inspecoes", (s) => {
      let n = 0;
      for (const h of historicoDemo(hojeNaOrg())) {
        if (s.inspecoes.some((i) => i.client_uuid === h.client_uuid)) continue;
        const r = processar(s, membroEm(s, h.responsavel_id), { ...h, respostas: h.respostas as Answers, status: "completa", anexos: [], device_id: "demo" }, h.finalizada_em);
        if (r.ok) n++;
      }
      return n;
    });
  },
  async painel(quem: Membro, filtro: { de: string; ate: string; formulario_id?: ID }) {
    if (!pode(quem, "ver_painel")) throw new Error("Você não tem acesso ao painel.");
    await latency();
    const s = await load();
    const dia = (iso: string) => dataNaOrg(iso);
    const dur = (Date.parse(filtro.ate) - Date.parse(filtro.de)) / 864e5 + 1;
    const antDe = somarDiasAg(filtro.de, -dur), antAte = somarDiasAg(filtro.de, -1);
    const base = s.inspecoes.filter((i) => i.status !== "rascunho" && i.finalizada_em && podeVerInspecao(quem, i)
      && (!filtro.formulario_id || i.formulario_id === filtro.formulario_id));
    const no = (de: string, ate: string) => base.filter((i) => { const d = dia(i.finalizada_em!); return d >= de && d <= ate; });
    const atual = no(filtro.de, filtro.ate), anterior = no(antDe, antAte);
    const media = (xs: Inspecao[]) => { const v = xs.map((i) => i.nota_pct).filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const ncPor = (xs: Inspecao[]) => (xs.length ? xs.reduce((a, i) => a + i.qtd_nao_conformidades, 0) / xs.length : null);

    // agenda no período: cumpridas × atrasadas (as pendentes no prazo ainda não contam)
    const agora = Date.now();
    const ocs = s.ocorrencias.flatMap((o) => {
      const a = s.agendamentos.find((x) => x.id === o.agendamento_id);
      if (!a || !podeVerAgendamento(quem, a) || (filtro.formulario_id && a.formulario_id !== filtro.formulario_id)) return [];
      const d = dia(o.previsto_em);
      return d >= filtro.de && d <= filtro.ate ? [situacaoOcorrencia(o, a, agora)] : [];
    });
    const cumpridas = ocs.filter((x) => x === "completa").length, atrasadas = ocs.filter((x) => x === "atrasada").length;

    // série semanal (semana começa na segunda)
    const segunda = (d: string) => somarDiasAg(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7));
    const semanas: { semana: string; nota: number | null; qtd: number }[] = [];
    for (let w = segunda(filtro.de); w <= filtro.ate; w = somarDiasAg(w, 7)) {
      const xs = atual.filter((i) => segunda(dia(i.finalizada_em!)) === w);
      semanas.push({ semana: w, nota: media(xs), qtd: xs.length });
    }

    const porAvaliado = [...new Set(atual.map((i) => i.avaliado_id))].map((id) => {
      const xs = atual.filter((i) => i.avaliado_id === id);
      return { id, nome: s.avaliados.find((a) => a.id === id)?.nome ?? "Avaliado removido", nota: media(xs), qtd: xs.length, ncs: xs.reduce((a, i) => a + i.qtd_nao_conformidades, 0) };
    }).sort((a, b) => (a.nota ?? 101) - (b.nota ?? 101) || a.nome.localeCompare(b.nome, "pt-BR"));

    const titulos = new Map<string, string>();
    const ncCont = new Map<string, { n: number; aplicaveis: number; formulario: string }>();
    for (const i of atual) {
      const v = s.versoes.find((x) => x.id === i.formulario_versao_id);
      const form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "";
      for (const q of v?.definicao.topicos.flatMap((t) => t.questoes) ?? []) titulos.set(i.formulario_id + "|" + q.key, q.titulo);
      for (const [k, r] of Object.entries(i.resultado.questoes)) {
        if (r.conforme === null) continue;
        const c = ncCont.get(i.formulario_id + "|" + k) ?? { n: 0, aplicaveis: 0, formulario: form };
        c.aplicaveis++;
        if (r.conforme === false) c.n++;
        ncCont.set(i.formulario_id + "|" + k, c);
      }
    }
    const topNcs = [...ncCont.entries()].filter(([, c]) => c.n > 0)
      .map(([k, c]) => ({ chave: k, titulo: titulos.get(k) ?? "Questão", formulario: c.formulario, n: c.n, pct: (c.n / c.aplicaveis) * 100 }))
      .sort((a, b) => b.n - a.n || b.pct - a.pct).slice(0, 8);

    return {
      periodo: { de: filtro.de, ate: filtro.ate, anterior: { de: antDe, ate: antAte } },
      kpis: {
        inspecoes: { atual: atual.length, anterior: anterior.length },
        nota: { atual: media(atual), anterior: media(anterior) },
        ncs_por_inspecao: { atual: ncPor(atual), anterior: ncPor(anterior) },
        agenda: { cumpridas, atrasadas, pct: cumpridas + atrasadas ? (cumpridas / (cumpridas + atrasadas)) * 100 : null },
        planos_em_atraso: s.planos.filter((p) => situacao(p, hojeNaOrg()) === "em_atraso" && (!filtro.formulario_id || p.formulario_id === filtro.formulario_id)
          && base.some((i) => i.id === p.inspecao_id)).length,
      },
      semanas, porAvaliado, topNcs,
      formularios: s.formularios.filter((f) => !f.arquivado).map((f) => ({ id: f.id, nome: f.nome })),
    };
  },

  // ---- agendamentos (S05–S07) ----
  /** = cron materializar-ocorrencias; aqui roda sob demanda (listar, pacote). Idempotente. */
  async rodarAgenda(): Promise<number> { return rodarAgenda(); },
  async listarOcorrencias(quem: Membro, filtro: { de?: string; ate?: string; situacao?: OcorrenciaSituacao | ""; busca?: string } = {}) {
    await rodarAgenda();
    await latency();
    const s = await load();
    const agora = Date.now();
    const busca = (filtro.busca ?? "").trim().toLowerCase();
    const nomeM = new Map(s.membros.map((x) => [x.id, x.nome]));
    return s.ocorrencias.flatMap((o) => {
      const a = s.agendamentos.find((x) => x.id === o.agendamento_id);
      if (!a || !podeVerAgendamento(quem, a)) return [];
      const dia = dataNaOrg(o.previsto_em, a.fuso_horario);
      if (filtro.de && dia < filtro.de) return [];
      if (filtro.ate && dia > filtro.ate) return [];
      const situacao = situacaoOcorrencia(o, a, agora);
      if (filtro.situacao && situacao !== filtro.situacao) return [];
      const row = {
        ...clone(o), situacao, agendamento: clone(a), descricao: descreverRegra(a),
        formulario: s.formularios.find((f) => f.id === a.formulario_id)?.nome ?? "Formulário removido",
        avaliado: s.avaliados.find((x) => x.id === a.avaliado_id)?.nome ?? "Avaliado removido",
        responsaveis: a.responsaveis.map((id) => nomeM.get(id) ?? "—"),
      };
      if (busca && ![row.formulario, row.avaliado, ...row.responsaveis].join(" ").toLowerCase().includes(busca)) return [];
      return [row];
    }).sort((x, y) => x.previsto_em.localeCompare(y.previsto_em) || x.avaliado.localeCompare(y.avaliado, "pt-BR"));
  },
  async obterAgendamento(id: ID): Promise<Agendamento> {
    const a = (await load()).agendamentos.find((x) => x.id === id);
    if (!a) throw new Error("Agendamento não encontrado.");
    return clone(a);
  },
  /** Cria ou edita. Na edição, as ocorrências futuras ainda pendentes são refeitas pela regra nova. */
  async salvarAgendamento(quem: Membro, dados: RegraAgenda & { id?: ID; formulario_id: ID; avaliado_id: ID; responsaveis: ID[] }): Promise<{ agendamento: Agendamento; geradas: number }> {
    exigir(quem, "gerenciar_agendamentos");
    await latency();
    const out = await mutate("agenda", (s) => {
      const regra: RegraAgenda = {
        data_inicio: dados.data_inicio, horarios: dados.dia_inteiro ? [] : [...new Set(dados.horarios)].sort(), dia_inteiro: dados.dia_inteiro,
        fuso_horario: ORG.fuso_horario, recorrencia: dados.recorrencia,
        dias_semana: dados.recorrencia === "semanal" ? [...new Set(dados.dias_semana ?? [])].sort() : undefined,
        termino: dados.recorrencia === "nenhuma" ? "nunca" : dados.termino,
        termino_data: dados.termino === "data" ? dados.termino_data : undefined,
        termino_qtd: dados.termino === "quantidade" ? dados.termino_qtd : undefined,
      };
      const problemas = validarRegra(regra);
      const f = s.formularios.find((x) => x.id === dados.formulario_id && !x.arquivado);
      if (!f) problemas.push("Escolha um formulário.");
      else if (!f.versao_publicada_id) problemas.push("Este formulário ainda não foi publicado.");
      if (!s.avaliados.some((x) => x.id === dados.avaliado_id)) problemas.push("Escolha o avaliado.");
      else if (f && f.avaliados_vinculados.length && !f.avaliados_vinculados.includes(dados.avaliado_id)) problemas.push("Este formulário não vale para o avaliado escolhido.");
      if (!dados.responsaveis.length) problemas.push("Escolha quem vai aplicar.");
      const efetivos = resolverMembros(s.membros, s.funcoes, s.equipes);
      for (const id of dados.responsaveis) {
        const r = efetivos.find((x) => x.id === id);
        if (!r || !r.ativo) problemas.push("Uma das pessoas escolhidas não está mais ativa.");
        else if (!pode(r, "aplicar") || !podeFormulario(r, dados.formulario_id) || !podeAvaliado(r, dados.avaliado_id))
          problemas.push(`${r.nome} não tem acesso a este formulário ou avaliado. Libere em Permissões.`);
      }
      if (problemas.length) throw new Error(problemas.join(" "));
      let a: Agendamento;
      if (dados.id) {
        const atual = s.agendamentos.find((x) => x.id === dados.id);
        if (!atual) throw new Error("Agendamento não encontrado.");
        const agora = nowISO();
        s.ocorrencias = s.ocorrencias.filter((o) => !(o.agendamento_id === atual.id && o.status === "pendente" && o.previsto_em > agora));
        Object.assign(atual, regra, { formulario_id: dados.formulario_id, avaliado_id: dados.avaliado_id, responsaveis: [...dados.responsaveis], ativo: true, updated_at: agora });
        delete (atual as Partial<Agendamento>).dias_semana; if (regra.dias_semana) atual.dias_semana = regra.dias_semana;
        a = atual;
      } else {
        a = { ...regra, id: uuid(), org_id: ORG.id, formulario_id: dados.formulario_id, avaliado_id: dados.avaliado_id, responsaveis: [...dados.responsaveis],
          ativo: true, materializado_ate: null, criado_por: quem.id, created_at: nowISO(), updated_at: nowISO() };
        s.agendamentos.push(a);
      }
      const geradas = materializar(s, a);
      return { agendamento: clone(a), geradas };
    });
    return out;
  },
  /** S07: só esta ou esta e as seguintes (encerra o agendamento). Justificativa obrigatória. */
  inativarOcorrencia(quem: Membro, id: ID, escopo: "esta" | "seguintes", justificativa: string): Promise<number> {
    return mutate("agenda", (s) => {
      const o = s.ocorrencias.find((x) => x.id === id);
      if (!o) throw new Error("Ocorrência não encontrada.");
      const a = s.agendamentos.find((x) => x.id === o.agendamento_id)!;
      if (!pode(quem, "gerenciar_agendamentos") && !a.responsaveis.includes(quem.id)) throw new Error("Você não tem permissão para isso.");
      if (justificativa.trim().length < 3) throw new Error("Escreva o motivo.");
      if (o.status !== "pendente") throw new Error("Só dá para inativar o que ainda está pendente.");
      const alvo = escopo === "esta" ? [o] : s.ocorrencias.filter((x) => x.agendamento_id === a.id && x.status === "pendente" && x.previsto_em >= o.previsto_em);
      for (const x of alvo) Object.assign(x, { status: "inativa", justificativa: justificativa.trim(), inativada_por: quem.id, updated_at: nowISO() });
      if (escopo === "seguintes") { a.ativo = false; a.updated_at = nowISO(); }
      return alvo.length;
    });
  },

  // ---- S30/S31: pessoas, funções e equipes (exige gerenciar_permissoes) ----
  async listarPessoas(): Promise<MembroRegistro[]> {
    await latency();
    return clone((await load()).membros).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
  },
  convidarPessoa(quem: Membro, dados: { nome: string; email: string; funcao_id: ID }): Promise<MembroRegistro> {
    exigir(quem, "gerenciar_permissoes");
    const nome = dados.nome.trim(), email = dados.email.trim().toLowerCase();
    if (!nome) return Promise.reject(new Error("Informe o nome."));
    if (!/^\S+@\S+\.\S+$/.test(email)) return Promise.reject(new Error("Informe um e-mail válido."));
    return mutate("membros", (s) => {
      if (s.membros.some((m) => m.email.toLowerCase() === email)) throw new Error("Já existe uma pessoa com esse e-mail.");
      if (!s.funcoes.some((f) => f.id === dados.funcao_id)) throw new Error("Escolha uma função.");
      const m: MembroRegistro = { id: uuid(), org_id: ORG.id, nome, email, funcao_id: dados.funcao_id, is_master: false, ativo: true, acesso: clone(ACESSO_PESSOA_NOVA), created_at: nowISO() };
      s.membros.push(m);
      filaEmail(s, { idem_key: `convite:${m.id}`, para: email, assunto: `Você foi convidado para ${ORG.nome} no Inspeta`,
        texto: `${quem.nome} liberou seu acesso como ${s.funcoes.find((f) => f.id === m.funcao_id)?.nome}. Entre com este e-mail e crie sua senha no primeiro acesso.`,
        link: `${location.origin}${location.pathname}#/entrar` });
      return clone(m);
    });
  },
  salvarPessoa(quem: Membro, id: ID, patch: Partial<Pick<MembroRegistro, "nome" | "funcao_id" | "ativo" | "acesso">>): Promise<MembroRegistro> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const m = s.membros.find((x) => x.id === id);
      if (!m) throw new Error("Pessoa não encontrada.");
      if (m.is_master && (patch.funcao_id !== undefined && patch.funcao_id !== m.funcao_id || patch.ativo === false))
        throw new Error("O dono da conta é sempre Administrador e não pode ser desativado.");
      if (patch.ativo === false && id === quem.id) throw new Error("Você não pode desativar o seu próprio acesso.");
      if (patch.funcao_id && !s.funcoes.some((f) => f.id === patch.funcao_id)) throw new Error("Função não encontrada.");
      if (patch.nome !== undefined && !patch.nome.trim()) throw new Error("Informe o nome.");
      if (patch.acesso) patch = { ...patch, acesso: limparAcesso(s, patch.acesso, id) };
      Object.assign(m, clone(patch));
      return clone(m);
    });
  },
  async listarFuncoes(): Promise<(Funcao & { qtd_pessoas: number })[]> {
    await latency();
    const s = await load();
    return s.funcoes.map((f) => ({ ...clone(f), qtd_pessoas: s.membros.filter((m) => m.ativo && m.funcao_id === f.id).length }));
  },
  criarFuncao(quem: Membro, nome: string, copiarDe?: ID): Promise<Funcao> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const n = nome.trim();
      if (!n) throw new Error("Dê um nome à função.");
      if (s.funcoes.some((f) => f.nome.toLowerCase() === n.toLowerCase())) throw new Error("Já existe uma função com esse nome.");
      const base = s.funcoes.find((f) => f.id === copiarDe);
      const f: Funcao = { id: uuid(), nome: n, acoes: base ? [...base.acoes] : ["aplicar"] };
      s.funcoes.push(f);
      return clone(f);
    });
  },
  salvarFuncao(quem: Membro, f: Funcao): Promise<Funcao> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const atual = s.funcoes.find((x) => x.id === f.id);
      if (!atual) throw new Error("Função não encontrada.");
      if (atual.sistema) throw new Error("A função Administrador tem todas as ações e não pode ser alterada.");
      const n = f.nome.trim();
      if (!n) throw new Error("Dê um nome à função.");
      if (s.funcoes.some((x) => x.id !== f.id && x.nome.toLowerCase() === n.toLowerCase())) throw new Error("Já existe uma função com esse nome.");
      atual.nome = n;
      atual.acoes = [...new Set(f.acoes)];
      return clone(atual);
    });
  },
  excluirFuncao(quem: Membro, id: ID): Promise<void> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const f = s.funcoes.find((x) => x.id === id);
      if (!f) return;
      if (f.sistema) throw new Error("A função Administrador não pode ser excluída.");
      const n = s.membros.filter((m) => m.funcao_id === id).length;
      if (n) throw new Error(`Há ${n} ${n === 1 ? "pessoa" : "pessoas"} com esta função. Troque a função delas antes de excluir.`);
      s.funcoes = s.funcoes.filter((x) => x.id !== id);
    });
  },
  async listarEquipes(): Promise<Equipe[]> {
    await latency();
    return clone((await load()).equipes).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  criarEquipe(quem: Membro, nome: string): Promise<Equipe> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const n = nome.trim();
      if (!n) throw new Error("Dê um nome à equipe.");
      if (s.equipes.some((e) => e.nome.toLowerCase() === n.toLowerCase())) throw new Error("Já existe uma equipe com esse nome.");
      const e: Equipe = { id: uuid(), org_id: ORG.id, nome: n, membros: [], acesso: clone(ACESSO_EQUIPE_NOVA) };
      s.equipes.push(e);
      return clone(e);
    });
  },
  salvarEquipe(quem: Membro, e: Equipe): Promise<Equipe> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      const atual = s.equipes.find((x) => x.id === e.id);
      if (!atual) throw new Error("Equipe não encontrada.");
      const n = e.nome.trim();
      if (!n) throw new Error("Dê um nome à equipe.");
      if (s.equipes.some((x) => x.id !== e.id && x.nome.toLowerCase() === n.toLowerCase())) throw new Error("Já existe uma equipe com esse nome.");
      atual.nome = n;
      atual.membros = [...new Set(e.membros)].filter((id) => s.membros.some((m) => m.id === id));
      atual.acesso = limparAcesso(s, e.acesso);
      return clone(atual);
    });
  },
  excluirEquipe(quem: Membro, id: ID): Promise<void> {
    exigir(quem, "gerenciar_permissoes");
    return mutate("membros", (s) => {
      s.equipes = s.equipes.filter((e) => e.id !== id);
      for (const a of [...s.membros.map((m) => m.acesso), ...s.equipes.map((e) => e.acesso)]) a.ver_equipes = a.ver_equipes.filter((x) => x !== id);
    });
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

/** Tira referências a coisas que não existem mais e a própria pessoa da lista de acompanhados. */
function limparAcesso(s: State, a: Acesso, dono?: ID): Acesso {
  const fs = new Set(s.formularios.map((f) => f.id)), as = new Set(s.avaliados.map((x) => x.id));
  const ms = new Set(s.membros.map((m) => m.id)), es = new Set(s.equipes.map((e) => e.id));
  return {
    formularios: a.formularios === "todos" ? "todos" : [...new Set(a.formularios)].filter((x) => fs.has(x)),
    avaliados: a.avaliados === "todos" ? "todos" : [...new Set(a.avaliados)].filter((x) => as.has(x)),
    ver_membros: [...new Set(a.ver_membros)].filter((x) => ms.has(x) && x !== dono),
    ver_equipes: [...new Set(a.ver_equipes)].filter((x) => es.has(x)),
  };
}

/** Quem vê o agendamento: quem gerencia agendas, os responsáveis e quem acompanha os responsáveis. */
function podeVerAgendamento(m: Membro, a: Agendamento): boolean {
  return pode(m, "gerenciar_agendamentos") || pode(m, "ver_todas_inspecoes") || a.responsaveis.some((id) => id === m.id || m.ve_inspecoes_de.includes(id));
}
function dataNaOrg(iso: string, fuso = ORG.fuso_horario): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
}
/** Gera as ocorrências dos próximos 14 dias. unique(agendamento_id, previsto_em): rodar 2x não duplica. */
function materializar(s: State, a: Agendamento, agora = Date.now()): number {
  if (!a.ativo) return 0;
  const hoje = dataNaOrg(new Date(agora).toISOString(), a.fuso_horario);
  const ate = somarDiasAg(hoje, 14);
  let n = 0;
  for (const previsto_em of instantesDaRegra(a, hoje, ate)) {
    if (Date.parse(limiteDaOcorrencia(previsto_em, a)) <= agora) continue; // já passou: não nasce atrasada
    if (s.ocorrencias.some((o) => o.agendamento_id === a.id && o.previsto_em === previsto_em)) continue;
    s.ocorrencias.push({ id: uuid(), org_id: ORG.id, agendamento_id: a.id, previsto_em, status: "pendente", created_at: nowISO(), updated_at: nowISO() });
    n++;
  }
  a.materializado_ate = ate;
  return n;
}
/** Salva só se gerou algo (assim listar não dispara recarga em laço). */
function rodarAgenda(): Promise<number> {
  return serial(async () => {
    const s = await load();
    const hoje = hojeNaOrg();
    const pendentes = s.agendamentos.filter((a) => a.ativo && a.materializado_ate !== somarDiasAg(hoje, 14));
    let n = 0;
    for (const a of pendentes) n += materializar(s, a);
    if (pendentes.length) await save(s, n ? "agenda" : "agenda-silencioso");
    return n;
  });
}
/**
 * A primeira inspeção finalizada cumpre a ocorrência (= update … where status = 'pendente').
 * Se outra pessoa já cumpriu, ou a ocorrência foi inativada, esta vira avulsa.
 */
function cumprirOcorrencia(s: State, m: Membro, e: InspecaoEnvio, inspecaoId?: ID): ID | null {
  if (!e.ocorrencia_id) return null;
  const o = s.ocorrencias.find((x) => x.id === e.ocorrencia_id);
  const a = o && s.agendamentos.find((x) => x.id === o.agendamento_id);
  if (!o || !a || !a.responsaveis.includes(m.id) || a.formulario_id !== e.formulario_id || a.avaliado_id !== e.avaliado_id) return null;
  if (o.status === "completa" && o.inspecao_id && o.inspecao_id === inspecaoId) return o.id;
  if (o.status !== "pendente") return null;
  o.status = "completa";
  o.updated_at = nowISO();
  return o.id;
}

function etapasDe(s: State, i: Inspecao): { aprovadores: ID[] }[] {
  return s.versoes.find((v) => v.id === i.formulario_versao_id)?.definicao.config.aprovacao?.etapas ?? [];
}
function aprovadoresDaEtapa(s: State, i: Inspecao): ID[] {
  return i.status === "em_aprovacao" ? etapasDe(s, i)[(i.aprovacao_etapa ?? 1) - 1]?.aprovadores ?? [] : [];
}
/** Quem aprova alguma etapa enxerga a inspeção (mesmo sem acompanhar quem aplicou). */
function ehAprovador(s: State, m: Membro, i: Inspecao): boolean {
  return pode(m, "aprovar") && etapasDe(s, i).some((e) => e.aprovadores.includes(m.id));
}
function avisarAprovadores(s: State, inspecao_id: ID): void {
  const i = s.inspecoes.find((x) => x.id === inspecao_id)!;
  const av = s.avaliados.find((a) => a.id === i.avaliado_id)?.nome ?? "";
  const form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "";
  for (const mid of aprovadoresDaEtapa(s, i)) {
    const m = s.membros.find((x) => x.id === mid);
    if (!m?.ativo || mid === i.responsavel_id) continue;
    filaEmail(s, { idem_key: `aprovacao:${i.id}:${i.aprovacao_etapa}:${mid}`, para: m.email,
      assunto: `Aprovação pendente: ${form} — ${av}`,
      texto: `A inspeção em ${av} (nota ${i.nota_pct === null ? "—" : String(i.nota_pct).replace(".", ",") + "%"}) espera a sua decisão na etapa ${i.aprovacao_etapa} de ${etapasDe(s, i).length}.`,
      link: `${location.origin}${location.pathname}#/web/inspecoes/${i.id}` });
  }
}

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
/** Devolve true se entrou na fila; false se já existia (idem_key único = emails_saida no schema). */
function filaEmail(s: State, e: Omit<EmailSaida, "id" | "criado_em" | "status">): boolean {
  if (s.emails.some((x) => x.idem_key === e.idem_key)) return false;
  s.emails.push({ ...e, id: uuid(), criado_em: nowISO(), status: e.para ? "enviado" : "sem_destinatario" });
  return true;
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
    const novos: string[] = [];
    for (const para of destinos) {
      const entrou = filaEmail(s, {
        idem_key: `relatorio:${i.id}:${para}`, para,
        assunto: `Relatório: ${form} — ${av?.nome ?? ""} — ${i.nota_pct === null ? "sem nota" : String(i.nota_pct).replace(".", ",") + "%"}`,
        texto: `Segue o relatório da inspeção finalizada em ${new Date(i.finalizada_em ?? i.iniciada_em).toLocaleString("pt-BR", { timeZone: ORG.fuso_horario })}. ${i.qtd_nao_conformidades} não conformidade(s).`,
        anexo: { tipo: "relatorio_pdf", inspecao_id: i.id },
      });
      if (entrou) novos.push(para);
    }
    if (novos.length) log(s, i.id, null, "relatorio_enviado", { para: novos }); // reenvio não repete o evento
  });
}
