// API do Inspeta: uma rota RPC que roda o núcleo (as mesmas regras do app) sobre o Postgres.
// É um handler `fetch` puro: roda no Bun (testes locais) e no Deno (função "api" do Supabase).
//
// Segurança:
//  - quem chama é sempre o membro do JWT validado no Supabase Auth — nunca o que o cliente mandou;
//  - cada método tem uma regra (ação exigida e/ou checagem do objeto) na tabela METODOS;
//  - métodos que só existem no navegador (entrar, sessao, _reset...) não são expostos;
//  - o link público do plano acha a organização pelo hash do token, sem login.
import { resolverMembros } from "../app/src/data/acesso";
import { pode, type ServerApi } from "../app/src/data/nucleo";
import type { Acao, Membro, Organizacao } from "../app/src/data/types";
import { servidorDaOrg, type Anexos, type Sql } from "./repo";

export interface ConfigApi {
  sql: Sql;
  /** Base do Supabase Auth, ex.: https://xyz.supabase.co/auth/v1 */
  authUrl: string;
  anonKey: string;
  /** Chave de serviço: só para convites (admin) — nunca vai para o navegador. */
  serviceKey?: string;
  urlApp: string;
  anexos: Anexos;
  /** Origens que podem chamar a API (CORS). Vazio = qualquer uma (só para desenvolvimento). */
  origens?: string[];
  agora?: () => number;
}

type Regra = {
  /** ação exigida da função do membro ("membro" = qualquer pessoa ativa da organização) */
  acao: Acao | "membro" | "dono";
  /** posição do argumento que é o próprio membro (substituído pelo autenticado) */
  quem?: number;
  /** posição do argumento que é o id do próprio membro (substituído pelo autenticado) */
  quemId?: number;
  /** checagem do objeto lido: o argumento na posição indicada precisa ser visível para quem chama */
  ver?: { tipo: "inspecao" | "anexo"; arg: number };
};

const M = (acao: Regra["acao"], extra: Omit<Regra, "acao"> = {}): Regra => ({ acao, ...extra });
export const METODOS: Partial<Record<keyof ServerApi, Regra>> = {
  listarFormularios: M("membro"), obterFormulario: M("membro"), obterVersao: M("membro"),
  criarFormulario: M("gerenciar_formularios"), salvarRascunho: M("gerenciar_formularios"), publicar: M("gerenciar_formularios", { quemId: 1 }),
  salvarLogo: M("gerenciar_formularios"), layoutRelatorio: M("membro"),
  listarAvaliados: M("membro"), listarCamposAvaliado: M("membro"),
  criarAvaliado: M("gerenciar_avaliados"), salvarAvaliado: M("gerenciar_avaliados"), importarAvaliados: M("gerenciar_avaliados"),
  salvarCamposAvaliado: M("gerenciar_avaliados", { quem: 0 }),
  listarInspecoes: M("membro", { quem: 0 }), obterInspecao: M("membro", { quem: 0 }),
  eventos: M("membro", { ver: { tipo: "inspecao", arg: 0 } }), aprovacaoDaInspecao: M("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  planosDaInspecao: M("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  registrarRelatorio: M("membro", { quemId: 1, ver: { tipo: "inspecao", arg: 0 } }),
  anexo: M("membro", { ver: { tipo: "anexo", arg: 0 } }),
  pacote: M("aplicar", { quemId: 0 }), enviarAnexo: M("aplicar", { quemId: 0 }), enviarInspecoes: M("aplicar", { quemId: 0 }),
  listarPlanosModelo: M("membro"), obterPlanoModelo: M("membro"),
  criarPlanoModelo: M("gerenciar_planos"), salvarPlanoModelo: M("gerenciar_planos"),
  listarPlanos: M("membro", { quem: 0 }), novoLinkPlano: M("gerenciar_planos", { quem: 1 }), decidirPlano: M("gerenciar_planos", { quem: 0 }),
  caixaDeSaida: M("gerenciar_planos"),
  aprovacoesPendentes: M("membro", { quem: 0 }), decisoesDe: M("membro", { quem: 0 }), decidir: M("aprovar", { quem: 0 }),
  gerarDadosDemo: M("dono", { quem: 0 }), painel: M("ver_painel", { quem: 0 }),
  rodarAgenda: M("membro"), listarOcorrencias: M("membro", { quem: 0 }), obterAgendamento: M("membro"),
  salvarAgendamento: M("gerenciar_agendamentos", { quem: 0 }), inativarOcorrencia: M("membro", { quem: 0 }),
  listarPessoas: M("membro"), listarFuncoes: M("membro"), listarEquipes: M("membro"),
  convidarPessoa: M("gerenciar_permissoes", { quem: 0 }), salvarPessoa: M("gerenciar_permissoes", { quem: 0 }),
  criarFuncao: M("gerenciar_permissoes", { quem: 0 }), salvarFuncao: M("gerenciar_permissoes", { quem: 0 }), excluirFuncao: M("gerenciar_permissoes", { quem: 0 }),
  criarEquipe: M("gerenciar_permissoes", { quem: 0 }), salvarEquipe: M("gerenciar_permissoes", { quem: 0 }), excluirEquipe: M("gerenciar_permissoes", { quem: 0 }),
};
/** Sem login: só com o token do link (a organização é achada pelo hash). */
const PUBLICOS = new Set(["planoPorToken", "responderPlano"]);

class ErroHttp extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function sha256(t: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function criarApi(cfg: ConfigApi): (req: Request) => Promise<Response> {
  const cacheUsuario = new Map<string, { email: string; ate: number }>();
  const agora = cfg.agora ?? Date.now;

  async function usuarioDoToken(jwt: string): Promise<string> {
    const c = cacheUsuario.get(jwt);
    if (c && c.ate > agora()) return c.email;
    const r = await fetch(`${cfg.authUrl}/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: cfg.anonKey } });
    if (!r.ok) throw new ErroHttp(401, "Sua sessão expirou. Entre de novo.");
    const u = (await r.json()) as { email?: string; email_confirmed_at?: string | null };
    if (!u.email) throw new ErroHttp(401, "Sessão sem e-mail.");
    if (cacheUsuario.size > 500) cacheUsuario.clear();
    cacheUsuario.set(jwt, { email: u.email.toLowerCase(), ate: agora() + 60_000 });
    return u.email.toLowerCase();
  }

  async function orgDoEmail(email: string): Promise<Organizacao> {
    const r = await cfg.sql<{ id: string; nome: string; fuso_horario: string }>`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'membros' and lower(r.dados->>'email') = ${email} and coalesce((r.dados->>'ativo')::boolean, true)
      order by o.criado_em limit 1`;
    if (!r[0]) throw new ErroHttp(403, "Este e-mail não tem acesso a nenhuma conta do Inspeta. Peça um convite ao administrador.");
    return { id: r[0].id, nome: r[0].nome, fuso_horario: r[0].fuso_horario };
  }

  async function orgDoToken(token: string): Promise<Organizacao> {
    const h = await sha256(String(token));
    const r = await cfg.sql<{ id: string; nome: string; fuso_horario: string }>`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'planos' and r.dados->>'token_hash' = ${h} limit 1`;
    if (!r[0]) throw new ErroHttp(404, "Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
    return { id: r[0].id, nome: r[0].nome, fuso_horario: r[0].fuso_horario };
  }

  async function convidar(email: string): Promise<void> {
    if (!cfg.serviceKey) return;
    // Supabase Auth manda o e-mail de convite (definir senha). Se a pessoa já tem conta, segue normalmente.
    const r = await fetch(`${cfg.authUrl}/invite`, {
      method: "POST", headers: { Authorization: `Bearer ${cfg.serviceKey}`, apikey: cfg.serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, data: {}, redirect_to: cfg.urlApp }),
    });
    if (!r.ok && r.status !== 422) console.error("convite falhou", r.status);
  }

  function cors(req: Request): Record<string, string> {
    const o = req.headers.get("Origin") ?? "";
    const ok = !cfg.origens?.length || cfg.origens.includes(o);
    return {
      "Access-Control-Allow-Origin": ok ? o || "*" : "null",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };
  }
  const json = (req: Request, status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) } });

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== "POST") return json(req, 405, { ok: false, erro: "Use POST." });
    let corpo: { metodo?: string; args?: unknown[] };
    try {
      const txt = await req.text();
      if (txt.length > 20 * 1024 * 1024) throw new ErroHttp(413, "Envio grande demais (máx. 20 MB).");
      corpo = JSON.parse(txt);
    } catch (e) { return json(req, e instanceof ErroHttp ? e.status : 400, { ok: false, erro: e instanceof ErroHttp ? e.message : "Corpo inválido." }); }
    const metodo = String(corpo.metodo ?? "");
    const args = Array.isArray(corpo.args) ? [...corpo.args] : [];

    try {
      // ---- público: link do plano de ação ----
      if (PUBLICOS.has(metodo)) {
        const org = await orgDoToken(String(args[0] ?? ""));
        const { servidor, avisos } = servidorDaOrg(cfg.sql, org, { urlApp: cfg.urlApp, anexos: cfg.anexos });
        const fn = servidor[metodo as "planoPorToken"] as (...a: unknown[]) => Promise<unknown>;
        const valor = await fn(...args);
        return json(req, 200, { ok: true, valor, avisos: [...avisos] });
      }

      // ---- autenticado ----
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) throw new ErroHttp(401, "Entre para continuar.");
      const email = await usuarioDoToken(auth.slice(7));
      const org = await orgDoEmail(email);
      const { servidor, avisos } = servidorDaOrg(cfg.sql, org, { urlApp: cfg.urlApp, anexos: cfg.anexos });
      const quem = await servidor._membroPorEmail(email);
      if (!quem || !quem.ativo) throw new ErroHttp(403, "Este acesso foi desativado. Fale com o administrador da conta.");

      if (metodo === "eu") {
        return json(req, 200, { ok: true, valor: { membro: quem, membros: await servidor._membrosResolvidos(), org } });
      }
      const regra = METODOS[metodo as keyof ServerApi];
      if (!regra) throw new ErroHttp(404, `Operação desconhecida: ${metodo}`);
      if (regra.acao === "dono" ? !quem.is_master : regra.acao !== "membro" && !pode(quem, regra.acao))
        throw new ErroHttp(403, "Você não tem permissão para isso.");
      if (regra.quem !== undefined) args[regra.quem] = quem;
      if (regra.quemId !== undefined) args[regra.quemId] = quem.id;
      if (regra.ver && !(await servidor._podeVer(quem, regra.ver.tipo, String(args[regra.ver.arg] ?? ""))))
        throw new ErroHttp(404, regra.ver.tipo === "inspecao" ? "Inspeção não encontrada." : "Arquivo não encontrado.");

      const fn = servidor[metodo as keyof ServerApi] as unknown as (...a: unknown[]) => Promise<unknown>;
      const valor = await fn.apply(servidor, args);

      if (metodo === "convidarPessoa" && valor && typeof valor === "object" && "email" in valor) await convidar(String((valor as { email: string }).email));
      if (avisos.size && metodo !== "rodarAgenda") {
        await cfg.sql`insert into auditoria (org_id, membro_id, metodo) values (${org.id}, ${quem.id}, ${metodo})`;
      }
      // quando muda gente/função/equipe, o cliente recebe a lista atualizada junto
      const extra = avisos.has("membros") ? { membros: await servidor._membrosResolvidos() } : {};
      return json(req, 200, { ok: true, valor: valor ?? null, avisos: [...avisos], ...extra });
    } catch (e) {
      if (e instanceof ErroHttp) return json(req, e.status, { ok: false, erro: e.message });
      const msg = e instanceof Error ? e.message : String(e);
      // erro de regra (mensagem para a pessoa) vs. erro inesperado (não vaza detalhe do banco)
      const interno = /syntax|relation|column|violates|connection|ECONN|timeout/i.test(msg);
      if (interno) console.error(metodo, e);
      return json(req, interno ? 500 : 400, { ok: false, erro: interno ? "Erro no servidor. Tente de novo em instantes." : msg });
    }
  };
}

/** Lista resolvida (função, equipes, acessos) — usada no provisionamento e nos testes. */
export { resolverMembros };
export type { Membro };
