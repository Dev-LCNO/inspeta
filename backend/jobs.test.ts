// Fila de e-mails contra o Postgres local: PDF anexado, link do plano apagado depois do envio, idempotência e erro.
// Rodar: bun backend/jobs.test.ts (com backend/scripts/pg-local.sh no ar)
import assert from "node:assert/strict";
import { criarServidor } from "../app/src/data/nucleo";
import { configurarAgendador, criarOrganizacao, enviarEmailsPendentes, type Mensagem } from "./jobs";
import { provisionar } from "./provisionar";
import { ambientePg, anexosNoBanco, type Sql } from "./repo";

const sql = new Bun.SQL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5434/postgres") as unknown as Sql & { unsafe(q: string): Promise<unknown>; close(): Promise<void> };
for (const f of ["20261014000000_inspeta.sql", "20261014000100_cron.sql"]) await sql.unsafe(await Bun.file(new URL("../supabase/migrations/" + f, import.meta.url)).text());
const org = await provisionar(sql, { nome: "Teste de e-mail " + Date.now(), dono: { nome: "Dono", email: `dono+${Date.now()}@exemplo.com` }, demo: true });
const amb = ambientePg(sql, org, { urlApp: "https://app.exemplo/", anexos: anexosNoBanco(sql), enviaEmails: true });
const srv = criarServidor(amb);

// uma inspeção com não conformidade no FLV gera plano + relatório por e-mail (o formulário pede)
const dono = (await srv._membrosResolvidos()).find((m) => m.is_master)!;
const pac = await srv.pacote(dono.id);
const f = pac.formularios.find((x) => x.formulario_id === "f-flv")!;
const res = await srv.enviarInspecoes(dono.id, [{
  client_uuid: crypto.randomUUID(), formulario_id: "f-flv", formulario_versao_id: f.versao.id, avaliado_id: "a-centro", status: "completa",
  iniciada_em: new Date().toISOString(), finalizada_em: new Date().toISOString(), anexos: [], device_id: "teste",
  respostas: { "q-vencidos": { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "vencido" }, "q-preco": { opcoes: ["q-preco-sim"] }, "q-gondola": { opcoes: ["q-gondola-limpa"] },
    "q-temp": { numero: 3, fotos: 1 }, "q-porta": { opcoes: ["q-porta-sim"] }, "q-ass": { assinatura: "x" } },
}]);
assert.ok(res[0]!.ok, JSON.stringify(res[0]));
let s = (await amb.carregar())!;
const pend = s.emails.filter((e) => e.status === "pendente");
assert.ok(pend.length >= 2, "plano + relatório na fila");
console.log(`✓ inspeção com NC deixou ${pend.length} e-mails "pendente" (o servidor não finge que enviou)`);

const enviadas: Mensagem[] = [];
const n = await enviarEmailsPendentes(sql, { enviar: async (m) => { enviadas.push(m); return { ok: true }; } });
assert.equal(n, pend.length);
const rel = enviadas.find((m) => m.assunto.startsWith("Relatório"))!;
assert.ok(rel.anexos?.[0]?.base64.startsWith("JVBER"), "relatório vai com PDF anexado");
const pl = enviadas.find((m) => m.assunto.startsWith("Plano de ação"))!;
assert.match(pl.html, /#\/p\//);
s = (await amb.carregar())!;
assert.ok(s.emails.every((e) => e.status !== "pendente"));
assert.ok(s.emails.filter((e) => e.assunto.startsWith("Plano de ação")).every((e) => !e.link), "banco não guarda mais o link com token");
console.log("✓ fila enviada: relatório com PDF, plano com link; depois do envio o link com token sai do banco");

assert.equal(await enviarEmailsPendentes(sql, { enviar: async () => ({ ok: true }) }), 0);
console.log("✓ rodar de novo não reenvia nada");

// falha do provedor fica registrada
await srv.novoLinkPlano(s.planos[0]!.id, dono, "outro@exemplo.com");
await enviarEmailsPendentes(sql, { enviar: async () => ({ ok: false, erro: "domínio não verificado" }) });
s = (await amb.carregar())!;
const falhou = s.emails.find((e) => e.status === "erro")!;
assert.equal(falhou.erro, "domínio não verificado");
console.log("✓ falha do provedor fica como 'erro' com o motivo, visível na caixa de saída");

// criar organização (workflow "Criar organização"): valida, recusa e-mail repetido, convida o dono
const convites: string[] = [];
const falso = (async (url: string, init: RequestInit) => { convites.push(url + " " + String(init.body)); return new Response("{}", { status: 200 }); }) as typeof fetch;
const op = { authUrl: "https://x.supabase.co/auth/v1", serviceKey: "srv", urlApp: "https://app.exemplo/", fetch: falso };
assert.equal((await criarOrganizacao(sql, { nome: "Sem dono" }, op)).status, 400);
const novoEmail = `Nova+${Date.now()}@Exemplo.com`;
const ok = await criarOrganizacao(sql, { nome: "Mercado Novo", dono_nome: "Maria", dono_email: novoEmail }, op);
assert.equal(ok.status, 200); assert.equal(ok.corpo.convite, "enviado");
assert.match(convites[0]!, /\/invite\?redirect_to=https%3A%2F%2Fapp\.exemplo%2F .*"email":"nova\+\d+@exemplo\.com"/);
const [m] = await sql<{ dados: { email: string; is_master: boolean } }>`select dados from registros where org_id = ${ok.corpo.org as string} and colecao = 'membros'`;
assert.ok(m!.dados.is_master && m!.dados.email === novoEmail.toLowerCase());
assert.equal((await criarOrganizacao(sql, { nome: "De novo", dono_nome: "Maria", dono_email: novoEmail }, op)).status, 409);
console.log("✓ criar organização: valida campos, dono vira master, convite enviado, e-mail repetido recusado");

await configurarAgendador(sql, "https://x.supabase.co/functions/v1/jobs", "s1");
await configurarAgendador(sql, "https://x.supabase.co/functions/v1/jobs", "s2");
const cfg = await sql<{ nome: string; valor: string }>`select nome, valor from interno.config order by nome`;
assert.deepEqual(cfg.map((r) => [r.nome, r.valor]), [["cron_secret", "s2"], ["url_jobs", "https://x.supabase.co/functions/v1/jobs"]]);
console.log("✓ agendador: migração do cron roda (sem pg_cron no local) e 'configurar' grava/atualiza endereço e segredo");
await sql.close();
