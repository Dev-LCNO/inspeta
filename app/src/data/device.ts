// ARMAZENAMENTO DO APARELHO + OUTBOX. Tudo que o aplicador faz é gravado aqui
// primeiro (funciona sem rede) e enviado depois por sincronizar().
//
// Regras do sync (architecture.md §4):
//  1. tudo nasce com client_uuid no aparelho;
//  2. fotos são comprimidas aqui (≤ 1600 px) e sobem separadas, cada uma idempotente;
//  3. a inspeção só sobe como "completa" depois de todas as fotos confirmadas;
//  4. o servidor recalcula a nota e é a fonte da verdade; reenviar não duplica.
import { evaluateForm, type Answer, type Evaluation, type FormDefinition } from "@app/form-engine";
import { emitChange, kv, onChange, serial } from "./kv";
import { net } from "./net";
import { server } from "./server";
import { OfflineError, type AnexoMeta, type ID, type InspecaoEnvio, type PacoteFormulario, type PacoteSync } from "./types";

export type EstadoLocal = "rascunho" | "na_fila" | "enviando" | "enviada" | "erro";

export interface FotoLocal { client_uuid: string; questao_key: string | null; tipo: AnexoMeta["tipo"]; mime: string; bytes: number; enviada: boolean }

export interface InspecaoLocal extends InspecaoEnvio {
  estado: EstadoLocal;
  erro?: string;
  server_id?: ID;
  nota_servidor?: number | null;
  classificacao_servidor?: string | null;
  fotos: FotoLocal[];
  atualizada_em: string;
  /** definição congelada da versão em que a inspeção começou (publicar de novo não muda esta inspeção) */
  definicao: FormDefinition;
  nome_formulario: string;
}

export interface EstadoAparelho {
  device_id: string;
  pacote: PacoteSync | null;
  sincronizado_em: string | null;
  inspecoes: InspecaoLocal[];
  ultimo_erro: string | null;
}

const key = (membroId: ID) => "dev:" + membroId;
const fotoKey = (id: string) => "dev:foto:" + id;
const nowISO = () => new Date().toISOString();

async function load(membroId: ID): Promise<EstadoAparelho> {
  return (await kv.get<EstadoAparelho>(key(membroId))) ?? {
    device_id: "web-" + crypto.randomUUID().slice(0, 8), pacote: null, sincronizado_em: null, inspecoes: [], ultimo_erro: null,
  };
}
function mutate<T>(membroId: ID, fn: (s: EstadoAparelho) => T): Promise<T> {
  return serial(async () => {
    const s = await load(membroId);
    const out = fn(s);
    await kv.set(key(membroId), s);
    emitChange("device");
    return out;
  });
}
function find(s: EstadoAparelho, client_uuid: string): InspecaoLocal {
  const i = s.inspecoes.find((x) => x.client_uuid === client_uuid);
  if (!i) throw new Error("Inspeção não encontrada neste aparelho.");
  return i;
}
function editavel(i: InspecaoLocal) {
  if (i.estado !== "rascunho") throw new Error("Inspeção finalizada não pode ser editada no app.");
}

/** Reduz para no máx. 1600 px no maior lado e recomprime em JPEG ~0,72. */
export async function comprimirImagem(file: Blob, max = 1600, qualidade = 0.72): Promise<{ dataUrl: string; bytes: number }> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const dataUrl = c.toDataURL("image/jpeg", qualidade);
  return { dataUrl, bytes: Math.round(((dataUrl.length - 23) * 3) / 4) };
}

export function formularioDoPacote(p: PacoteSync | null, formulario_id: ID): PacoteFormulario | undefined {
  return p?.formularios.find((f) => f.formulario_id === formulario_id);
}

export function avaliar(s: EstadoAparelho, i: InspecaoLocal): Evaluation {
  return evaluateForm(i.definicao, i.respostas, s.pacote?.anteriores[`${i.formulario_id}|${i.avaliado_id}`] ?? {});
}

let syncing: Promise<ResumoSync> | null = null;
export interface ResumoSync { enviadas: number; fotos: number; erros: number; offline: boolean; mensagem: string }

export const device = {
  estado: load,

  async novaInspecao(membroId: ID, formulario_id: ID, avaliado_id: ID, ocorrencia_id: ID | null = null): Promise<InspecaoLocal> {
    return mutate(membroId, (s) => {
      const f = formularioDoPacote(s.pacote, formulario_id);
      if (!f) throw new Error("Formulário não está neste aparelho. Sincronize.");
      const i: InspecaoLocal = {
        client_uuid: crypto.randomUUID(), formulario_id, formulario_versao_id: f.versao.id, avaliado_id,
        status: "rascunho", iniciada_em: nowISO(), finalizada_em: null, respostas: {}, anexos: [],
        device_id: s.device_id, estado: "rascunho", fotos: [], atualizada_em: nowISO(),
        definicao: f.versao.definicao, nome_formulario: f.nome, ocorrencia_id,
      };
      s.inspecoes.unshift(i);
      return structuredClone(i);
    });
  },

  responder(membroId: ID, client_uuid: string, questao_key: string, patch: Partial<Answer> | null): Promise<void> {
    return mutate(membroId, (s) => {
      const i = find(s, client_uuid);
      editavel(i);
      if (patch === null) { delete i.respostas[questao_key]; }
      else i.respostas[questao_key] = { ...i.respostas[questao_key], ...patch };
      i.atualizada_em = nowISO();
    });
  },

  async adicionarFoto(membroId: ID, client_uuid: string, questao_key: string | null, arquivo: Blob, tipo: AnexoMeta["tipo"] = "foto"): Promise<FotoLocal> {
    const { dataUrl, bytes } = tipo === "assinatura"
      ? await blobToDataUrl(arquivo).then((d) => ({ dataUrl: d, bytes: arquivo.size }))
      : await comprimirImagem(arquivo);
    const foto: FotoLocal = { client_uuid: crypto.randomUUID(), questao_key, tipo, mime: tipo === "assinatura" ? "image/png" : "image/jpeg", bytes, enviada: false };
    await kv.set(fotoKey(foto.client_uuid), dataUrl);
    await mutate(membroId, (s) => {
      const i = find(s, client_uuid);
      editavel(i);
      i.fotos.push(foto);
      if (questao_key) {
        const a = (i.respostas[questao_key] ??= {});
        if (tipo === "assinatura") a.assinatura = foto.client_uuid;
        else a.fotos = i.fotos.filter((f) => f.questao_key === questao_key && f.tipo === "foto").length;
      }
      i.atualizada_em = nowISO();
    });
    return foto;
  },

  async removerFoto(membroId: ID, client_uuid: string, foto_uuid: string): Promise<void> {
    await mutate(membroId, (s) => {
      const i = find(s, client_uuid);
      editavel(i);
      const f = i.fotos.find((x) => x.client_uuid === foto_uuid);
      i.fotos = i.fotos.filter((x) => x.client_uuid !== foto_uuid);
      if (f?.questao_key) {
        const a = i.respostas[f.questao_key];
        if (a) {
          if (f.tipo === "assinatura") delete a.assinatura;
          else a.fotos = i.fotos.filter((x) => x.questao_key === f.questao_key && x.tipo === "foto").length;
        }
      }
    });
    await kv.del(fotoKey(foto_uuid));
  },

  foto(foto_uuid: string): Promise<string | undefined> {
    return kv.get<string>(fotoKey(foto_uuid));
  },

  async finalizar(membroId: ID, client_uuid: string, geo?: { lat: number; lng: number } | null): Promise<{ ok: true } | { ok: false; pendentes: string[] }> {
    const res = await mutate(membroId, (s) => {
      const i = find(s, client_uuid);
      editavel(i);
      const ev = avaliar(s, i);
      if (ev.pendentes.length) return { ok: false as const, pendentes: ev.pendentes };
      i.status = "completa";
      i.finalizada_em = nowISO();
      i.geo_fim = geo ?? null;
      i.estado = "na_fila";
      i.atualizada_em = nowISO();
      return { ok: true as const };
    });
    if (res.ok && net.online) void device.sincronizar(membroId);
    return res;
  },

  descartar(membroId: ID, client_uuid: string): Promise<void> {
    return mutate(membroId, (s) => {
      const i = find(s, client_uuid);
      if (i.estado !== "rascunho") throw new Error("Só rascunhos podem ser descartados.");
      s.inspecoes = s.inspecoes.filter((x) => x.client_uuid !== client_uuid);
      for (const f of i.fotos) void kv.del(fotoKey(f.client_uuid));
    });
  },

  /** Uma sincronização por vez; chamadas concorrentes recebem a mesma promessa. */
  sincronizar(membroId: ID): Promise<ResumoSync> {
    if (!syncing) syncing = executarSync(membroId).finally(() => { syncing = null; });
    return syncing;
  },
};

async function executarSync(membroId: ID): Promise<ResumoSync> {
  const resumo: ResumoSync = { enviadas: 0, fotos: 0, erros: 0, offline: false, mensagem: "" };
  if (!net.online) return { ...resumo, offline: true, mensagem: "Sem conexão. Tudo fica salvo no aparelho." };
  try {
    const s = await load(membroId);
    const fila = s.inspecoes.filter((i) => i.estado === "na_fila" || i.estado === "erro");

    // 1. fotos
    for (const i of fila) for (const f of i.fotos.filter((x) => !x.enviada)) {
      const data = await kv.get<string>(fotoKey(f.client_uuid));
      if (!data) continue;
      await server.enviarAnexo(membroId, f.client_uuid, data);
      await mutate(membroId, (st) => {
        const ff = find(st, i.client_uuid).fotos.find((x) => x.client_uuid === f.client_uuid);
        if (ff) ff.enviada = true;
      });
      resumo.fotos++;
    }

    // 2. inspeções finalizadas com todas as fotos confirmadas, em lotes de 20
    const prontas = (await load(membroId)).inspecoes.filter(
      (i) => (i.estado === "na_fila" || i.estado === "erro") && i.fotos.every((f) => f.enviada),
    );
    for (let k = 0; k < prontas.length; k += 20) {
      const lote = prontas.slice(k, k + 20).map(toEnvio);
      await mutate(membroId, (st) => lote.forEach((e) => { find(st, e.client_uuid).estado = "enviando"; }));
      const resultados = await server.enviarInspecoes(membroId, lote);
      await mutate(membroId, (st) => {
        for (const r of resultados) {
          const i = find(st, r.client_uuid);
          if (r.ok) {
            i.estado = "enviada"; i.server_id = r.id; i.nota_servidor = r.nota_pct; i.classificacao_servidor = r.classificacao; delete i.erro;
            resumo.enviadas++;
          } else {
            i.estado = "erro"; i.erro = r.mensagem; resumo.erros++;
          }
        }
      });
    }

    // 3. pacote novo (formulários, avaliados, histórico para reincidência)
    const pacote = await server.pacote(membroId);
    await mutate(membroId, (st) => {
      st.pacote = pacote; st.sincronizado_em = nowISO(); st.ultimo_erro = null;
      // enviadas há mais de 7 dias saem do aparelho (fotos também)
      const corte = Date.now() - 7 * 864e5;
      const velhas = st.inspecoes.filter((i) => i.estado === "enviada" && Date.parse(i.atualizada_em) < corte);
      for (const v of velhas) for (const f of v.fotos) void kv.del(fotoKey(f.client_uuid));
      st.inspecoes = st.inspecoes.filter((i) => !velhas.includes(i));
    });
    resumo.mensagem = resumo.enviadas
      ? `${resumo.enviadas} ${resumo.enviadas === 1 ? "inspeção enviada" : "inspeções enviadas"}`
      : "Tudo em dia";
    if (resumo.erros) resumo.mensagem += ` · ${resumo.erros} com erro`;
    return resumo;
  } catch (e) {
    // volta "enviando" para a fila: nada se perde se a conexão cair no meio
    await mutate(membroId, (st) => {
      for (const i of st.inspecoes) if (i.estado === "enviando") i.estado = "na_fila";
      st.ultimo_erro = e instanceof OfflineError ? null : (e as Error).message;
    });
    if (e instanceof OfflineError) return { ...resumo, offline: true, mensagem: "A conexão caiu. Tentaremos de novo." };
    return { ...resumo, erros: resumo.erros + 1, mensagem: "Falha ao sincronizar: " + (e as Error).message };
  }
}

function toEnvio(i: InspecaoLocal): InspecaoEnvio {
  return {
    client_uuid: i.client_uuid, formulario_id: i.formulario_id, formulario_versao_id: i.formulario_versao_id,
    avaliado_id: i.avaliado_id, status: i.status, iniciada_em: i.iniciada_em, finalizada_em: i.finalizada_em,
    geo_inicio: i.geo_inicio ?? null, geo_fim: i.geo_fim ?? null, respostas: i.respostas,
    anexos: i.fotos.map(({ client_uuid, questao_key, tipo, mime, bytes }) => ({ client_uuid, questao_key, tipo, mime, bytes })),
    device_id: i.device_id, ocorrencia_id: i.ocorrencia_id ?? null,
  };
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

// sincroniza sozinho quando a conexão volta
export function autoSync(membroId: ID): () => void {
  let estavaOnline = net.online;
  const h = () => {
    const agora = net.online;
    if (agora && !estavaOnline) void device.sincronizar(membroId);
    estavaOnline = agora;
  };
  window.addEventListener("online", h);
  const off = onChange((t) => { if (t === "net") h(); }); // inclui o "modo avião" do app
  return () => { window.removeEventListener("online", h); off(); };
}
