// Segurança no banco e na API, contra o Postgres local:
//  - segunda barreira: no papel inspeta_api cada transação só enxerga/grava a própria organização;
//  - limite de pedidos (429) por IP, por pessoa, no link público e para quem erra token;
//  - bloqueio de senha (hook do Supabase Auth): 5 erros → 15 minutos bloqueado.
// Rodar: bun backend/seguranca.test.ts (com backend/scripts/pg-local.sh no ar)
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { criarApi } from "./api";
import { provisionar } from "./provisionar";
import { anexosNoBanco, escopoDaOrg, naOrg, servidorDaOrg, type Sql } from "./repo";

const sql = new Bun.SQL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5434/postgres") as unknown as Sql & { unsafe(q: string): Promise<unknown>; close(): Promise<void> };
const MIG = new URL("../supabase/migrations/", import.meta.url);
for (const f of readdirSync(MIG).filter((x) => x.endsWith(".sql")).sort()) await sql.unsafe(await Bun.file(new URL(f, MIG)).text());
const ok = (t: string) => console.log("✓ " + t);
const sufixo = Date.now();

// ---------- segunda barreira ----------
const A = await provisionar(sql, { nome: "Empresa A " + sufixo, dono: { nome: "Ana", email: `a+${sufixo}@exemplo.com` }, demo: true });
const B = await provisionar(sql, { nome: "Empresa B " + sufixo, dono: { nome: "Bia", email: `b+${sufixo}@exemplo.com` }, demo: true });
const anexos = anexosNoBanco(sql);
await anexos.set(B.id, "foto-b", "data:image/png;base64,AAAA");

const totalB = (await sql<{ n: number }>`select count(*)::int as n from registros where org_id = ${B.id}`)[0]!.n;
assert.ok(totalB > 10, "B tem dados");
await naOrg(sql, A.id, async (t) => {
  const deB = await t<{ n: number }>`select count(*)::int as n from registros where org_id = ${B.id}`;
  assert.equal(deB[0]!.n, 0, "papel da API em A não enxerga registros de B");
  const todas = await t<{ id: string }>`select id from orgs`;
  assert.deepEqual(todas.map((o) => o.id), [A.id], "só enxerga a própria organização");
  const ax = await t<{ n: number }>`select count(*)::int as n from anexos where org_id = ${B.id}`;
  assert.equal(ax[0]!.n, 0, "nem os anexos de B");
  const upd = await t`update registros set dados = dados where org_id = ${B.id}`;
  assert.equal((upd as unknown as { count: number }).count ?? 0, 0, "update em B não atinge nada");
});
await assert.rejects(naOrg(sql, A.id, async (t) => t`insert into registros (org_id, colecao, id, dados) values (${B.id}, 'avaliados', 'intruso', '{}'::jsonb)`),
  /row-level security|violates/i, "não grava linha com org de B");
await assert.rejects(naOrg(sql, A.id, async (t) => t`select * from interno.config`), /permission denied/i, "não lê a configuração interna");
await assert.rejects(naOrg(sql, A.id, async (t) => t`delete from orgs where id = ${A.id}`), /permission denied/i, "não apaga organização");
// papel sem organização declarada: não vê nada
await sql.begin(async (t) => {
  await t`set local role inspeta_api`;
  const n = await t<{ n: number }>`select count(*)::int as n from registros`;
  assert.equal(n[0]!.n, 0);
});
ok("segunda barreira: o papel da API só vê e grava a própria organização (registros, anexos, orgs); sem org declarada, nada");

// o servidor completo continua funcionando dentro da barreira (lê, grava com trava, anexos)
const { servidor } = servidorDaOrg(sql, A, { urlApp: "https://app/", anexos });
const forms = await servidor.listarFormularios();
assert.ok(forms.length >= 2);
const [dono] = (await servidor.listarPessoas()).filter((m) => m.is_master);
const av = await servidor.criarAvaliado({ nome: "Loja teste barreira", codigo_externo: "LTB" + sufixo });
assert.ok(av.id);
assert.equal(await anexos.get(A.id, "foto-b"), undefined, "A não lê a foto de B pelo id");
assert.equal(await anexos.get(B.id, "foto-b"), "data:image/png;base64,AAAA");
assert.ok(dono);
ok("núcleo roda inteiro dentro da barreira (ler, criar, trava por organização, anexos)");

// ---------- limite de pedidos ----------
const k = "teste:" + sufixo;
const res: boolean[] = [];
for (let i = 0; i < 4; i++) res.push((await sql<{ ok: boolean }>`select interno.consumir(${k}, 3, 60) as ok`)[0]!.ok);
assert.deepEqual(res, [true, true, true, false]);
assert.equal((await sql<{ n: number }>`select interno.contagem(${k}, 60) as n`)[0]!.n, 4);
ok("contador: 3 cabem, o 4º passa do limite");

// API com limites pequenos e um Auth de mentira
const auth = Bun.serve({ port: 0, fetch(req) {
  const tok = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  return tok === "token-bom" ? Response.json({ email: `a+${sufixo}@exemplo.com` }) : new Response("{}", { status: 401 });
} });
const api = criarApi({ sql, authUrl: `http://localhost:${auth.port}`, anonKey: "x", urlApp: "https://app/", anexos,
  limites: { porIp: 1000, porUsuario: 5, publicoPorIp: 3, falhasPorIp: 4, convitesPorOrg: 2 } });
const chamar = (ip: string, metodo: string, args: unknown[] = [], token?: string) => api(new Request("http://api/", {
  method: "POST", body: JSON.stringify({ metodo, args }),
  headers: { "Content-Type": "application/json", "x-forwarded-for": ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
}));
const IP1 = `10.0.${sufixo % 250}.1`, IP2 = `10.1.${sufixo % 250}.2`, IP3 = `10.2.${sufixo % 250}.3`;

const pub = [];
for (let i = 0; i < 4; i++) pub.push((await chamar(IP1, "planoPorToken", ["chute-" + i])).status);
assert.deepEqual(pub, [404, 404, 404, 429]);
const r429 = await chamar(IP1, "planoPorToken", ["x"]);
assert.equal(r429.status, 429);
assert.equal(r429.headers.get("Retry-After"), "60");
assert.match(((await r429.json()) as { erro: string }).erro, /Muitas tentativas/);
ok("link público: 3 chutes por minuto por IP, depois 429 com Retry-After");

const falhas = [];
for (let i = 0; i < 6; i++) falhas.push((await chamar(IP2, "listarFormularios", [], "token-falso")).status);
assert.deepEqual(falhas, [401, 401, 401, 401, 429, 429]);
assert.equal((await chamar(IP2, "listarFormularios", [], "token-bom")).status, 429, "IP bloqueado nem com token bom passa durante a janela");
assert.equal((await chamar(IP3, "listarFormularios", [], "token-bom")).status, 200, "outro IP segue normal");
ok("token inválido: 4 erros por IP em 10 min, depois 429 (nem consulta o Auth)");

const porUsuario = [];
const IP4 = `10.3.${sufixo % 250}.4`;
for (let i = 0; i < 5; i++) porUsuario.push((await chamar(i % 2 ? IP4 : IP3, "listarFormularios", [], "token-bom")).status);
assert.deepEqual(porUsuario, [200, 200, 200, 200, 429], "5 por minuto por pessoa (1 já usado acima)");
ok("por pessoa: passou do limite por minuto → 429, mesmo trocando de IP não muda a conta da pessoa");
auth.stop(true);

// ---------- bloqueio de senha (hook) ----------
const user = crypto.randomUUID();
const hook = async (valid: boolean) =>
  (await sql<{ r: Record<string, unknown> }>`select public.inspeta_hook_senha(${JSON.stringify({ user_id: user, valid })}::text::jsonb) as r`)[0]!.r;
const decisao = (r: unknown) => (typeof r === "string" ? JSON.parse(r) : r) as { decision?: string; error?: { http_code: number; message: string } };
for (let i = 0; i < 4; i++) assert.equal(decisao(await hook(false)).decision, "continue");
assert.equal(decisao(await hook(true)).decision, "continue", "acertou antes do 5º erro: zera");
for (let i = 0; i < 5; i++) assert.equal(decisao(await hook(false)).decision, "continue");
const bloq = decisao(await hook(true));
assert.equal(bloq.error?.http_code, 429, "5 erros seguidos: bloqueia até a senha certa");
assert.match(bloq.error!.message, /15 minutos/);
await sql`update interno.tentativas_senha set bloqueado_ate = now() - interval '1 second' where user_id = ${user}`;
assert.equal(decisao(await hook(true)).decision, "continue", "passou o bloqueio: entra");
assert.equal((await sql<{ n: number }>`select count(*)::int as n from interno.tentativas_senha where user_id = ${user}`)[0]!.n, 0);
ok("senha: 5 erros em 15 min bloqueiam a conta por 15 min (até com a senha certa); acerto zera o contador");

await sql.close();
void escopoDaOrg;
