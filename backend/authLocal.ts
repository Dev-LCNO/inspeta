// Supabase Auth de mentira, só para desenvolvimento e testes locais (nunca em produção).
// Responde as mesmas rotas que o app usa: /token (senha e refresh), /user, /logout, /invite, /recover, /signup.
const usuarios = new Map<string, { id: string; email: string; senha: string }>();
const tokens = new Map<string, { email: string; expira: number }>();
const refresh = new Map<string, string>();
/** Validade do token local em segundos (os testes encurtam para exercitar a renovação). */
export const duracaoLocal = { s: 3600 };

export function criarUsuarioLocal(email: string, senha: string) {
  const e = email.toLowerCase();
  usuarios.set(e, { id: crypto.randomUUID(), email: e, senha });
}
export function limparAuthLocal() { usuarios.clear(); tokens.clear(); refresh.clear(); }

function emitir(email: string, duracaoS = 3600) {
  const access_token = "local." + crypto.randomUUID();
  const refresh_token = "r." + crypto.randomUUID();
  tokens.set(access_token, { email, expira: Date.now() + duracaoS * 1000 });
  refresh.set(refresh_token, email);
  return { access_token, refresh_token, expires_in: duracaoS, token_type: "bearer", user: { id: usuarios.get(email)?.id, email } };
}

export async function authLocal(req: Request, caminho: string): Promise<Response> {
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
  const url = new URL(req.url);
  const corpo = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, string>) : {};
  if (caminho === "token" && url.searchParams.get("grant_type") === "password") {
    const u = usuarios.get(String(corpo.email ?? "").toLowerCase());
    if (!u || u.senha !== corpo.password) return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    return json(200, emitir(u.email, duracaoLocal.s));
  }
  if (caminho === "token" && url.searchParams.get("grant_type") === "refresh_token") {
    const email = refresh.get(String(corpo.refresh_token ?? ""));
    if (!email) return json(400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
    refresh.delete(String(corpo.refresh_token));
    return json(200, emitir(email));
  }
  if (caminho === "user") {
    const t = tokens.get((req.headers.get("Authorization") ?? "").replace(/^Bearer /, ""));
    if (!t || t.expira < Date.now()) return json(401, { msg: "invalid JWT" });
    return json(200, { id: usuarios.get(t.email)?.id, email: t.email, email_confirmed_at: new Date().toISOString() });
  }
  if (caminho === "logout") { tokens.delete((req.headers.get("Authorization") ?? "").replace(/^Bearer /, "")); return new Response(null, { status: 204 }); }
  if (caminho === "invite") {
    // local: a pessoa convidada entra com a senha padrão de desenvolvimento
    const e = String(corpo.email ?? "").toLowerCase();
    if (!usuarios.has(e)) criarUsuarioLocal(e, "demo1234");
    return json(200, { id: usuarios.get(e)!.id, email: e });
  }
  if (caminho === "recover") return json(200, {});
  return json(404, { msg: "rota de auth local desconhecida: " + caminho });
}
