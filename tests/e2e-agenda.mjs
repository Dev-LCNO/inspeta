// Marco 3: agendamentos (S05 S06 S07) e agenda do app de campo (M09).
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerEstado, gravarEstado as gravarEstadoB, lerAnexo, copiarServidor, BACKEND } from "./lib/backend.mjs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync("/tmp/foto-agenda.jpg", await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 140, b: 90 } } }).jpeg().toBuffer());

const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Rio_Branco" });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const pg = await ctx.newPage();
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));
const shot = async (nome) => { await pg.waitForTimeout(250); await pg.screenshot({ path: `${SHOTS}/${nome}.png` }); };
const estado = () => lerEstado(pg);
async function entrar(email) {
  await pg.goto(BASE + "#/entrar");
  await pg.evaluate(() => localStorage.removeItem("inspeta:sessao"));
  await pg.reload();
  await pg.getByLabel("E-mail").fill(email);
  await pg.getByLabel("Senha").fill("demo1234");
  await pg.getByRole("button", { name: "Entrar" }).click();
  await pg.waitForURL(/#\/(web|campo)/);
}
const fuso = "America/Rio_Branco";
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
const amanha = new Date(Date.parse(hoje + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
const rows = () => pg.locator("tr[data-ocorrencia]");

// ================= S05 com o que veio do seed =================
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/inspecoes?aba=agendamentos");
await rows().first().waitFor();
const centroHoje = rows().filter({ hasText: "Loja 02 — Centro" }).first();
await centroHoje.getByText("Dia inteiro", { exact: true }).waitFor();
await centroHoje.getByText("Pendente").waitFor();
await shot("S05");
passo("S05: agenda dos próximos 14 dias já materializada (Loja 02 hoje, o dia inteiro, pendente)");

// ================= S06 agendar =================
await pg.getByRole("button", { name: "Agendar", exact: true }).click();
const dlg = pg.getByRole("dialog");
await dlg.getByLabel("Formulário", { exact: true }).selectOption({ label: "Checklist FLV e perecíveis" });
await dlg.getByLabel("Avaliado", { exact: true }).selectOption({ label: "Loja 01 — Bosque" });
await dlg.getByLabel(/Começa em/).fill(amanha);
await dlg.getByLabel("Repetir").selectOption("semanal");
for (const d of ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]) {
  const c = dlg.getByRole("checkbox", { name: d, exact: true });
  if ((d === "segunda" || d === "quinta") !== (await c.isChecked())) await c.click({ force: true });
}
await dlg.getByRole("button", { name: "Horário" }).click();
await dlg.getByLabel("Termina").selectOption("quantidade");
await dlg.getByLabel(/Quantas vezes/).fill("4");
const br = amanha.split("-").reverse().join("/");
await dlg.getByTestId("resumo-regra").getByText(`Toda segunda e quinta às 08:00 e 14:00, a partir de ${br}, 4 vezes`).waitFor();
await dlg.getByRole("button", { name: "Agendar" }).click();
await dlg.getByText("Escolha quem vai aplicar.").waitFor();
await dlg.getByRole("checkbox", { name: /Ana Paula Souza/ }).check();
await shot("S06");
await dlg.getByRole("button", { name: "Agendar" }).click();
await pg.getByText("Agendado. 8 ocorrências geradas para os próximos 14 dias.").waitFor();
let s = await estado();
const agBosque = s.agendamentos.find((a) => a.avaliado_id === "a-bosque");
assert.deepEqual(agBosque.dias_semana, [1, 4]);
assert.equal(s.ocorrencias.filter((o) => o.agendamento_id === agBosque.id).length, 8);
passo("S06: semanal seg/qui, 2 horários, 4 vezes → 8 ocorrências; sem responsável é barrado; resumo em português");

// sem acesso: Carlos não aplica no CD — Doca 3
await pg.getByRole("button", { name: "Agendar", exact: true }).click();
await dlg.getByLabel("Formulário", { exact: true }).selectOption({ label: "Recebimento de refrigerados" });
await dlg.getByLabel("Avaliado", { exact: true }).selectOption({ label: "CD — Doca 3" });
assert.equal(await dlg.getByRole("checkbox", { name: /Carlos Eduardo Lima/ }).isDisabled(), true);
await dlg.getByRole("button", { name: "Cancelar" }).click();
passo("S06: quem não tem acesso ao formulário/avaliado aparece desabilitado");

// ================= filtros + S07 inativar só esta =================
await pg.getByLabel("Buscar").fill("Bosque");
await pg.getByLabel("Situação").selectOption("pendente");
await pg.waitForFunction(() => document.querySelectorAll("tr[data-ocorrencia]").length === 8);
await rows().first().getByRole("button", { name: /Inativar ocorrência/ }).click();
await dlg.getByRole("button", { name: "Inativar" }).click();
await dlg.getByText("Escreva o motivo.").waitFor();
await dlg.getByLabel(/Motivo/).fill("Loja fechada para dedetização");
await dlg.getByRole("button", { name: "Inativar" }).click();
await pg.getByText("Ocorrência inativada.").waitFor();
await pg.waitForFunction(() => document.querySelectorAll("tr[data-ocorrencia]").length === 7);
await pg.getByLabel("Situação").selectOption("inativa");
await pg.waitForFunction(() => document.querySelectorAll("tr[data-ocorrencia]").length === 1);
passo("S07: inativar só uma, com motivo obrigatório; filtros por situação e busca");

// ================= M09 agenda no app de campo =================
await pg.setViewportSize({ width: 390, height: 844 });
await entrar("ana@exemplo.com");
await pg.getByText(/1 para hoje/).waitFor();
await pg.getByRole("link", { name: /Agenda/ }).click();
await pg.getByRole("heading", { name: /Hoje/ }).waitFor();
await pg.getByRole("heading", { name: /Próximos dias/ }).waitFor();
assert.equal(await pg.getByRole("button", { name: /Loja 01 — Bosque/ }).count(), 7);
assert.equal(await pg.getByRole("heading", { name: "Hoje (1)" }).count(), 1);
await shot("M09");
passo("M09: agenda offline no aparelho (1 hoje; 7 da Loja 01 nos próximos dias — a inativada não aparece)");

await pg.getByRole("button", { name: /Loja 02 — Centro/ }).first().click();
await pg.waitForURL(/aplicar/);
await pg.getByRole("radio", { name: /Não, encontrei vencidos/ }).click();
const q1 = pg.locator("fieldset.q").first();
await q1.locator('input[type="file"]').setInputFiles("/tmp/foto-agenda.jpg");
await q1.locator(".ph img").waitFor();
await q1.getByLabel(/Observação/).fill("Iogurte vencido.");
await pg.getByRole("radio", { name: "Sim", exact: true }).first().click();
await pg.getByRole("checkbox", { name: "Limpas" }).click();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.locator("input.numin").fill("3");
await pg.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-agenda.jpg");
await pg.locator("fieldset.q").first().locator(".ph img").waitFor();
await pg.getByRole("radio", { name: "Sim", exact: true }).click();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.getByRole("button", { name: "Coletar assinatura" }).click();
const bb = await pg.locator("canvas.sigpad").boundingBox();
await pg.mouse.move(bb.x + 30, bb.y + 60); await pg.mouse.down(); await pg.mouse.move(bb.x + 200, bb.y + 90); await pg.mouse.up();
await pg.getByRole("button", { name: "Salvar assinatura" }).click();
await pg.getByAltText("Assinatura coletada").waitFor();
await pg.getByRole("button", { name: "Revisar" }).click();
try { await pg.getByText("Tudo respondido").waitFor({ timeout: 5000 }); } catch (e) { await pg.screenshot({ path: "/tmp/rev.png", fullPage: true }); throw e; }
await pg.getByRole("button", { name: "Finalizar" }).click();
await pg.getByText("Enviada para o painel").waitFor({ timeout: 15000 });
s = await estado();
const ocHoje = s.ocorrencias.find((o) => o.agendamento_id === "ag-flv-centro" && o.status === "completa");
assert.ok(ocHoje, "ocorrência de hoje ficou completa");
const inspAg = s.inspecoes.find((i) => i.id === ocHoje.inspecao_id);
assert.equal(inspAg.ocorrencia_id, ocHoje.id);
await pg.goto(BASE + "#/campo");
await pg.getByText(/0 para hoje/).waitFor();
passo("inspeção aberta pela agenda cumpre a ocorrência no servidor e some da agenda do aparelho");

// ================= web: completa + ver inspeção; editar; idempotência =================
await pg.setViewportSize({ width: 1440, height: 900 });
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/inspecoes?aba=agendamentos");
const linhaFeita = rows().filter({ hasText: "Loja 02 — Centro" }).filter({ hasText: "Completa" });
await linhaFeita.getByRole("link", { name: "Ver inspeção" }).click();
await pg.waitForURL(new RegExp("inspecoes/" + inspAg.id));
passo("S05 mostra a ocorrência como Completa com link para a inspeção");

await pg.goto(BASE + "#/web/inspecoes?aba=agendamentos");
await rows().filter({ hasText: "Loja 01 — Bosque" }).first().getByRole("button", { name: /Editar agendamento/ }).click();
await dlg.getByRole("button", { name: /Remover horário 2/ }).click();
await dlg.getByLabel("Horário 1").fill("09:00");
await dlg.getByRole("button", { name: "Salvar" }).click();
await pg.getByText(/Agendamento atualizado/).waitFor();
s = await estado();
const doBosque = s.ocorrencias.filter((o) => o.agendamento_id === agBosque.id);
assert.equal(doBosque.filter((o) => o.status === "pendente").length, 4, "4 dias × 1 horário");
assert.equal(doBosque.filter((o) => o.status === "inativa").length, 1, "a inativada continua inativa");
passo("editar refaz só as futuras pendentes pela regra nova; a inativada fica como estava");

for (let k = 0; k < 2; k++) { await pg.reload(); await rows().first().waitFor(); }
s = await estado();
const chaves = s.ocorrencias.map((o) => o.agendamento_id + "|" + o.previsto_em);
assert.equal(new Set(chaves).size, chaves.length, "nenhuma ocorrência duplicada");
passo("rodar a materialização de novo não duplica (agendamento + horário é único)");

// inativar "esta e as seguintes" encerra o agendamento diário
await pg.getByLabel("Buscar").fill("Centro");
await pg.getByLabel("Situação").selectOption("pendente");
await pg.waitForFunction(() => { const r = [...document.querySelectorAll("tr[data-ocorrencia]")]; return r.length > 0 && r.every((x) => x.textContent.includes("Centro") && x.textContent.includes("Pendente")); });
await rows().first().getByRole("button", { name: /Inativar ocorrência/ }).click();
await dlg.getByRole("radio", { name: /Esta e todas as seguintes/ }).check();
await dlg.getByLabel(/Motivo/).fill("Loja vai fechar");
await dlg.getByRole("button", { name: "Inativar" }).click();
await pg.getByText(/agendamento encerrado/).waitFor();
s = await estado();
assert.equal(s.agendamentos.find((a) => a.id === "ag-flv-centro").ativo, false);
assert.equal(s.ocorrencias.filter((o) => o.agendamento_id === "ag-flv-centro" && o.status === "pendente").length, 0);
passo("S07 'esta e as seguintes' inativa todas as pendentes e encerra o agendamento");

// supervisor vê a agenda da equipe, mas não agenda
await entrar("carlos@exemplo.com");
await pg.goto(BASE + "#/web/inspecoes?aba=agendamentos");
await pg.getByLabel("Situação").waitFor();
await rows().first().waitFor();
assert.equal(await pg.getByRole("button", { name: "Agendar", exact: true }).count(), 0);
assert.equal(await rows().filter({ hasText: "CD — Doca 3" }).count(), 0, "não vê agenda do admin");
passo("supervisor vê a agenda de quem acompanha, não a dos outros, e não pode agendar");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
