// Ambiente do núcleo sobre Postgres: o estado da organização vem de "registros" (uma linha por entidade)
// e volta só com o que mudou, dentro de uma transação com trava por organização.
// Funciona com Bun.SQL (testes locais) e com postgres.js (função no Supabase): os dois aceitam tagged templates.
import { criarServidor, type Ambiente, type State } from "../app/src/data/nucleo";
import type { Organizacao } from "../app/src/data/types";

export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): PromiseLike<T[]>;
  begin<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

export const COLECOES = ["formularios", "versoes", "avaliados", "inspecoes", "eventos", "planosModelo", "planos", "emails",
  "membros", "funcoes", "equipes", "agendamentos", "ocorrencias", "aprovacoes", "camposAvaliado"] as const;
type Colecao = (typeof COLECOES)[number];

export function estadoVazio(): State {
  return { v: 1, formularios: [], versoes: [], avaliados: [], inspecoes: [], eventos: [], eventoSeq: 0, planosModelo: [], planos: [], emails: [],
    membros: [], funcoes: [], equipes: [], agendamentos: [], ocorrencias: [], aprovacoes: [], camposAvaliado: [] };
}

/** Guarda anexos (fotos, assinaturas, logos). Padrão: tabela "anexos"; produção pode usar o Storage. */
export interface Anexos {
  get(orgId: string, id: string): Promise<string | undefined>;
  set(orgId: string, id: string, dataUrl: string): Promise<void>;
  presentes(orgId: string, ids: string[]): Promise<Set<string>>;
}

export function anexosNoBanco(sql: Sql): Anexos {
  return {
    async get(orgId, id) {
      const r = await sql<{ data_url: string }>`select data_url from anexos where org_id = ${orgId} and id = ${id}`;
      return r[0]?.data_url;
    },
    async set(orgId, id, dataUrl) {
      const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
      await sql`insert into anexos (org_id, id, data_url, bytes) values (${orgId}, ${id}, ${dataUrl}, ${bytes})
        on conflict (org_id, id) do nothing`; // idempotente: o aparelho pode reenviar a mesma foto
    },
    async presentes(orgId, ids) {
      if (!ids.length) return new Set();
      // lista como texto: o mesmo SQL funciona no Bun.SQL e no postgres.js
      const r = await sql<{ id: string }>`select id from anexos where org_id = ${orgId} and id = any(string_to_array(${ids.join(",")}, ','))`;
      return new Set(r.map((x) => x.id));
    },
  };
}

export interface OpcoesAmbiente { urlApp: string; anexos: Anexos; /** produção: e-mails entram "pendente" e saem pelo Resend */ enviaEmails?: boolean }

/** Um ambiente por requisição (guarda a transação e os avisos daquela chamada). */
export function ambientePg(sql: Sql, org: Organizacao, op: OpcoesAmbiente): Ambiente & { avisos: Set<string> } {
  let tx: Sql | null = null;
  let foto = new Map<string, string>(); // "colecao:id" -> json, do último carregamento
  let seqLido = 0;
  const q = () => tx ?? sql;
  const memoria = new Map<string, string>();
  const avisos = new Set<string>();

  return {
    org,
    avisos,
    enviaEmails: op.enviaEmails,
    async carregar() {
      const [linhas, orgs] = await Promise.all([
        q()<{ colecao: Colecao; id: string; dados: unknown }>`select colecao, id, dados from registros where org_id = ${org.id} order by seq`,
        q()<{ contadores: { eventoSeq?: number } }>`select contadores from orgs where id = ${org.id}`,
      ]);
      const s = estadoVazio();
      foto = new Map();
      for (const l of linhas) {
        const dados = typeof l.dados === "string" ? JSON.parse(l.dados) : l.dados;
        (s[l.colecao] as unknown[]).push(dados);
        foto.set(`${l.colecao}:${l.id}`, JSON.stringify(dados));
      }
      const c = orgs[0]?.contadores;
      s.eventoSeq = seqLido = Number((typeof c === "string" ? JSON.parse(c) : c)?.eventoSeq ?? 0);
      return s;
    },
    async gravar(s) {
      const vistos = new Set<string>();
      for (const col of COLECOES) {
        for (const item of s[col] as { id: string | number }[]) {
          const k = `${col}:${item.id}`;
          vistos.add(k);
          const json = JSON.stringify(item);
          if (foto.get(k) === json) continue;
          await q()`insert into registros (org_id, colecao, id, dados) values (${org.id}, ${col}, ${String(item.id)}, ${json}::text::jsonb)
            on conflict (org_id, colecao, id) do update set dados = excluded.dados, atualizado = now()`;
          foto.set(k, json);
        }
      }
      for (const k of [...foto.keys()]) {
        if (vistos.has(k)) continue;
        const i = k.indexOf(":");
        await q()`delete from registros where org_id = ${org.id} and colecao = ${k.slice(0, i)} and id = ${k.slice(i + 1)}`;
        foto.delete(k);
      }
      if (s.eventoSeq !== seqLido) {
        await q()`update orgs set contadores = jsonb_set(contadores, '{eventoSeq}', ${String(s.eventoSeq)}::text::jsonb) where id = ${org.id}`;
        seqLido = s.eventoSeq;
      }
    },
    async exclusivo(fn) {
      if (tx) return fn(); // já dentro de uma transação desta requisição
      return sql.begin(async (t) => {
        await t`select pg_advisory_xact_lock(hashtext(${org.id}))`;
        tx = t;
        try { return await fn(); } finally { tx = null; }
      });
    },
    estadoInicial: estadoVazio,
    anexo: (id) => op.anexos.get(org.id, id),
    guardarAnexo: (id, d) => op.anexos.set(org.id, id, d),
    anexosPresentes: (ids) => op.anexos.presentes(org.id, ids),
    urlApp: () => op.urlApp,
    atraso: async () => undefined,
    aviso: (t) => { avisos.add(t); },
    exigirRede: () => undefined,
    local: { get: (k) => memoria.get(k) ?? null, set: (k, v) => { memoria.set(k, v); }, del: (k) => { memoria.delete(k); }, limpar: async () => { memoria.clear(); } },
  };
}

export function servidorDaOrg(sql: Sql, org: Organizacao, op: OpcoesAmbiente) {
  const amb = ambientePg(sql, org, op);
  return { servidor: criarServidor(amb), avisos: amb.avisos };
}
