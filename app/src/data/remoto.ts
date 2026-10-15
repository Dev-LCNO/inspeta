// Cliente do backend real. Mesmas assinaturas do núcleo: cada método vira uma chamada à API
// (função "api" no Supabase), com o token da sessão do Supabase Auth.
// Sessão, organização e lista de pessoas ficam em cache local para as telas lerem de forma síncrona.
import { emitChange } from "./kv";
import { net } from "./net";
import type { ServerApi } from "./nucleo";
import { OfflineError, type Membro, type Organizacao } from "./types";

const SESSAO = "inspeta:sessao";
const MEMBROS = "inspeta:membros";
const ORG = "inspeta:org";
const AUTH = process.env.INSPETA_AUTH ?? "";
const ANON = process.env.INSPETA_ANON_KEY ?? "";

interface Sessao { access_token: string; refresh_token: string; expira: number; membro_id: string }

const ler = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const gravar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const apagar = (k: string) => { try { localStorage.removeItem(k); } catch { /* idem */ } };

/** Tokens guardados (durante o login ainda sem membro_id). */
function sessaoValida(): Sessao | null {
  const s = ler<Sessao>(SESSAO);
  return s && typeof s === "object" && s.access_token ? s : null;
}

export function criarServidorRemoto(api: string): ServerApi {
  let renovando: Promise<Sessao | null> | null = null;

  async function auth(caminho: string, corpo: unknown): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    let r: Response;
    try {
      r = await fetch(`${AUTH}/${caminho}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    } catch { throw new OfflineError(); }
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; msg?: string };
    if (r.status === 429) throw new Error(j.msg && /tentativas/i.test(j.msg) ? j.msg : "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.");
    if (!r.ok || !j.access_token) {
      const m = j.error_description ?? j.msg ?? "";
      throw new Error(/confirm/i.test(m) ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : "E-mail ou senha incorretos.");
    }
    return { access_token: j.access_token, refresh_token: j.refresh_token ?? "", expires_in: j.expires_in ?? 3600 };
  }

  async function tokenAtual(): Promise<string> {
    const s = sessaoValida();
    if (!s) throw new Error("Entre para continuar.");
    if (s.expira - Date.now() > 60_000) return s.access_token;
    renovando ??= auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token })
      .then((t) => { const n = { ...s, access_token: t.access_token, refresh_token: t.refresh_token || s.refresh_token, expira: Date.now() + t.expires_in * 1000 }; gravar(SESSAO, n); return n; })
      .catch((e) => { if (!(e instanceof OfflineError)) encerrar(); throw e; })
      .finally(() => { renovando = null; });
    return (await renovando)!.access_token;
  }

  function encerrar() {
    apagar(SESSAO);
    emitChange("sessao");
  }

  function publicarMembros(lista: Membro[]) {
    const antes = localStorage.getItem(MEMBROS);
    gravar(MEMBROS, lista);
    if (antes !== localStorage.getItem(MEMBROS)) emitChange("sessao");
  }

  async function rpc(metodo: string, args: unknown[], publico = false): Promise<unknown> {
    if (!net.online) throw new OfflineError();
    const headers: Record<string, string> = { "Content-Type": "application/json", apikey: ANON };
    if (!publico) headers.Authorization = `Bearer ${await tokenAtual()}`;
    let r: Response;
    try {
      r = await fetch(api, { method: "POST", headers, body: JSON.stringify({ metodo, args }) });
    } catch { throw new OfflineError(); }
    const j = (await r.json().catch(() => ({ ok: false, erro: "Resposta inválida do servidor." }))) as { ok: boolean; valor?: unknown; erro?: string; avisos?: string[]; membros?: Membro[] };
    if (!j.ok) {
      if (!publico && (r.status === 401 || (r.status === 403 && /desativado|não tem acesso a nenhuma/i.test(j.erro ?? "")))) encerrar();
      throw new Error(j.erro ?? `Erro ${r.status}`);
    }
    if (j.membros) publicarMembros(j.membros);
    for (const t of j.avisos ?? []) emitChange(t);
    return j.valor;
  }

  // outra pessoa pode ter mudado algo: ao voltar para a aba, as telas recarregam
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && sessaoValida()) for (const t of ["inspecoes", "planos", "agenda", "formularios", "avaliados", "membros"]) emitChange(t);
    });
  }

  const locais = {
    async entrar(email: string, senha: string): Promise<Membro> {
      const t = await auth("token?grant_type=password", { email: email.trim(), password: senha });
      gravar(SESSAO, { access_token: t.access_token, refresh_token: t.refresh_token, expira: Date.now() + t.expires_in * 1000, membro_id: "" });
      try {
        const eu = (await rpc("eu", [])) as { membro: Membro; membros: Membro[]; org: Organizacao };
        gravar(ORG, eu.org);
        gravar(MEMBROS, eu.membros);
        gravar(SESSAO, { ...sessaoValida()!, membro_id: eu.membro.id });
        emitChange("sessao");
        return eu.membro;
      } catch (e) { apagar(SESSAO); throw e; }
    },
    sessao(): Membro | null {
      const s = sessaoValida();
      if (!s?.membro_id) return null;
      const m = (ler<Membro[]>(MEMBROS) ?? []).find((x) => x.id === s.membro_id);
      return m && m.ativo ? m : null;
    },
    sair(): void {
      const s = sessaoValida();
      if (s) void fetch(`${AUTH}/logout`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` } }).catch(() => undefined);
      encerrar();
    },
    async recuperarSenha(email: string): Promise<void> {
      try {
        await fetch(`${AUTH}/recover?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }) });
      } catch { throw new OfflineError(); }
    },
    async definirSenha(senha: string): Promise<Membro> {
      if (senha.length < 8) throw new Error("Use pelo menos 8 caracteres.");
      const s = sessaoValida();
      if (!s) throw new Error("O link expirou. Peça um novo na tela de entrar.");
      let r: Response;
      try {
        r = await fetch(`${AUTH}/user`, { method: "PUT", headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: senha }) });
      } catch { throw new OfflineError(); }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { msg?: string };
        throw new Error(/weak|short|least/i.test(j.msg ?? "") ? "Senha fraca: use letras e números, com pelo menos 8 caracteres." : "Não foi possível salvar a senha. Peça um novo link.");
      }
      const eu = (await rpc("eu", [])) as { membro: Membro; membros: Membro[]; org: Organizacao };
      gravar(ORG, eu.org); gravar(MEMBROS, eu.membros); gravar(SESSAO, { ...sessaoValida()!, membro_id: eu.membro.id });
      emitChange("sessao");
      return eu.membro;
    },
    capturarRetornoAuth(): "recovery" | "invite" | "signup" | null {
      const h = location.hash.replace(/^#/, "");
      if (!h.includes("access_token=")) return null;
      const p = new URLSearchParams(h);
      const tipo = p.get("type");
      gravar(SESSAO, { access_token: p.get("access_token") ?? "", refresh_token: p.get("refresh_token") ?? "", expira: Date.now() + Number(p.get("expires_in") ?? 3600) * 1000, membro_id: "" });
      history.replaceState(null, "", location.pathname + "#/definir-senha");
      return tipo === "invite" || tipo === "signup" ? tipo : "recovery";
    },
    org(): Organizacao { return ler<Organizacao>(ORG) ?? { id: "", nome: "", fuso_horario: "America/Sao_Paulo" }; },
    membros(): Membro[] { return ler<Membro[]>(MEMBROS) ?? []; },
    async _reset(): Promise<void> { encerrar(); },
    planoPorToken: (token: string) => rpc("planoPorToken", [token], true),
    responderPlano: (token: string, dados: unknown) => rpc("responderPlano", [token, dados], true),
  };

  return new Proxy(locais, {
    get(alvo, nome) {
      if (typeof nome !== "string" || nome === "then") return undefined;
      if (nome in alvo) return alvo[nome as keyof typeof alvo];
      return (...args: unknown[]) => rpc(nome, args);
    },
  }) as unknown as ServerApi;
}
