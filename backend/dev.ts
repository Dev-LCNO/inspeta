// Servidor local que imita o Supabase para desenvolver e testar sem internet:
//   /auth/v1/*            → login de mentira (authLocal.ts)
//   /functions/v1/api     → a API de verdade (api.ts) sobre um Postgres local
//   /__dev/*              → atalhos de teste (zerar, ler e gravar o estado) — só com DEV=1
//   /*                    → arquivos do app (pasta APP_DIR)
// Uso: DATABASE_URL=postgres://... APP_DIR=app/dist-real bun backend/dev.ts
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { criarApi } from "./api";
import { authLocal, criarUsuarioLocal, duracaoLocal, limparAuthLocal } from "./authLocal";
import { enviarEmailsPendentes } from "./jobs";
import { provisionar } from "./provisionar";
import { ambientePg, anexosNoBanco, type Sql } from "./repo";
import type { Organizacao } from "../app/src/data/types";

const PORT = Number(process.env.PORT ?? 54321);
const DB = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5434/postgres";
const APP_DIR = process.env.APP_DIR ?? "app/dist-real";
const DEV = process.env.DEV === "1";
const BASE = `http://localhost:${PORT}`;
if (process.env.AUTH_LOCAL_DURACAO) duracaoLocal.s = Number(process.env.AUTH_LOCAL_DURACAO);

const sql = new Bun.SQL(DB) as unknown as Sql & { unsafe(q: string): Promise<unknown> };
await sql.unsafe(readFileSync(new URL("./supabase/migrations/20261014000000_inspeta.sql", import.meta.url), "utf8"));

const anexos = anexosNoBanco(sql);
const api = criarApi({ sql, authUrl: `${BASE}/auth/v1`, anonKey: "anon-local", serviceKey: "service-local", urlApp: `${BASE}/`, anexos });

let orgDemo: Organizacao | null = null;
async function zerar() {
  await sql.unsafe("truncate auditoria, anexos, registros, orgs restart identity cascade");
  limparAuthLocal();
  orgDemo = await provisionar(sql, { nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco", dono: { nome: "Rogério Marinho", email: "rogerio@exemplo.com" }, demo: true }, `${BASE}/`);
  for (const e of ["rogerio@exemplo.com", "ana@exemplo.com", "carlos@exemplo.com"]) criarUsuarioLocal(e, "demo1234");
}
await zerar();

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".map": "application/json" };

Bun.serve({
  port: PORT,
  maxRequestBodySize: 25 * 1024 * 1024,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith("/auth/v1/")) return authLocal(req, p.slice("/auth/v1/".length));
    if (p === "/functions/v1/api") return api(req);
    if (DEV && p.startsWith("/__dev/")) {
      const amb = ambientePg(sql, orgDemo!, { urlApp: `${BASE}/`, anexos });
      if (p === "/__dev/reset") { await zerar(); return Response.json({ ok: true }); }
      if (p === "/__dev/estado" && req.method === "GET") return Response.json(await amb.carregar());
      if (p === "/__dev/estado" && req.method === "PUT") { const s = await req.json(); await amb.exclusivo(async () => { await amb.carregar(); await amb.gravar(s as never); }); return Response.json({ ok: true }); }
      if (p === "/__dev/anexo") return Response.json({ data: (await anexos.get(orgDemo!.id, url.searchParams.get("id") ?? "")) ?? null });
      if (p === "/__dev/emails") return Response.json({ enviados: await enviarEmailsPendentes(sql, { enviar: async () => ({ ok: true }) }) });
    }
    // arquivos do app
    let f = join(APP_DIR, p === "/" ? "index.html" : decodeURIComponent(p));
    if (!f.startsWith(APP_DIR) || !existsSync(f) || statSync(f).isDirectory()) f = join(APP_DIR, "index.html");
    return new Response(readFileSync(f), { headers: { "Content-Type": MIME[extname(f)] ?? "application/octet-stream" } });
  },
});
console.log(`Inspeta local: ${BASE}  (banco ${DB.replace(/\/\/[^@]*@/, "//")})`);
