// Marco 3: aprovação de inspeção em etapas (S15 config, S12 decisão, S32 lista).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Rio_Branco" });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const pg = await ctx.newPage();
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));
async function entrar(email) {
  await pg.goto(BASE + "#/entrar");
  await pg.evaluate(() => localStorage.removeItem("inspeta:sessao"));
  await pg.reload();
  await pg.getByLabel("E-mail").fill(email);
  await pg.getByLabel("Senha").fill("demo1234");
  await pg.getByRole("button", { name: "Entrar" }).click();
  await pg.waitForURL(/#\/(web|campo)/);
}
const estado = () => pg.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("srv:state"); g.onsuccess = () => { r.result.close(); res(g.result); }; };
}));
const dlg = pg.getByRole("dialog");

// ================= configuração =================
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/permissoes/pessoas/m-ana");
await pg.getByRole("group", { name: "Formulários que aplica" }).getByRole("checkbox", { name: /Recebimento de refrigerados/ }).check();
await pg.getByRole("button", { name: "Salvar" }).click();
await pg.getByText("Permissões salvas.").waitFor();

await pg.goto(BASE + "#/web/formularios/f-receb?aba=configuracoes");
await pg.getByRole("switch", { name: /Exigir aprovação/ }).check();
await pg.getByRole("group", { name: "Etapa 1" }).getByRole("checkbox", { name: /Carlos Eduardo Lima/ }).check();
await pg.getByRole("button", { name: /Adicionar etapa/ }).click();
await pg.getByRole("button", { name: /Publicar v2/ }).click();
await pg.getByText(/etapa sem aprovador/).first().waitFor();
await pg.keyboard.press("Escape");
await pg.getByRole("group", { name: "Etapa 2" }).getByRole("checkbox", { name: /Rogério Marinho/ }).check();
await pg.waitForTimeout(900); // autosave
await pg.getByRole("button", { name: /Publicar v2/ }).click();
await pg.getByRole("button", { name: /Publicar v2/ }).waitFor({ state: "detached" });
let s = await estado();
const v2 = s.versoes.find((v) => v.formulario_id === "f-receb" && v.numero === 2);
assert.deepEqual(v2.definicao.config.aprovacao.etapas, [{ aprovadores: ["m-carlos"] }, { aprovadores: ["m-rogerio"] }]);
await pg.screenshot({ path: `${SHOTS}/S15-aprovacao.png`, fullPage: true });
passo("S15: duas etapas configuradas; etapa sem aprovador barra a publicação; v2 publicada com as etapas");

// ================= aplicadora faz duas inspeções =================
await pg.setViewportSize({ width: 390, height: 844 });
await entrar("ana@exemplo.com");
async function aplicar(temp) {
  await pg.goto(BASE + "#/campo/nova");
  await pg.getByRole("link", { name: /Recebimento de refrigerados/ }).click();
  await pg.getByRole("button", { name: /CD — Doca 3/ }).click();
  await pg.waitForURL(/aplicar/);
  await pg.locator("fieldset.q").first().locator("textarea").fill("000.512.900");
  await pg.getByRole("radio", { name: "Sim", exact: true }).click();
  await pg.getByRole("button", { name: "Próximo" }).click();
  await pg.locator("input.numin").nth(0).fill("14,2");
  await pg.locator("input.numin").nth(1).fill("0,6");
  await pg.locator("input.numin").nth(2).fill(temp);
  await pg.getByRole("button", { name: "Revisar" }).click();
  await pg.getByText("Tudo respondido").waitFor();
  await pg.getByRole("button", { name: "Finalizar" }).click();
  await pg.getByText("Enviada para o painel").waitFor({ timeout: 15000 });
}
await aplicar("5");
await aplicar("6");
s = await estado();
const minhas = s.inspecoes.filter((i) => i.responsavel_id === "m-ana" && i.formulario_id === "f-receb").sort((a, b) => a.finalizada_em.localeCompare(b.finalizada_em));
assert.equal(minhas.length, 2);
assert.ok(minhas.every((i) => i.status === "em_aprovacao" && i.aprovacao_etapa === 1));
assert.ok(s.emails.some((e) => e.para === "carlos@exemplo.com" && e.assunto.startsWith("Aprovação pendente")));
passo("finalizada vira 'em aprovação' na etapa 1 e o aprovador da etapa recebe e-mail");
const [A, B] = minhas;

// ================= etapa 1: Carlos =================
await pg.setViewportSize({ width: 1440, height: 900 });
await entrar("carlos@exemplo.com");
await pg.getByRole("button", { name: "Painel web" }).click();
await pg.getByRole("link", { name: "Aprovações" }).click();
await pg.locator("table a.rowlink").first().waitFor();
assert.equal(await pg.locator("table a.rowlink").count(), 2);
await pg.screenshot({ path: `${SHOTS}/S32.png` });
await pg.goto(BASE + "#/web/inspecoes/" + A.id);
await pg.getByRole("button", { name: "Aprovar" }).click();
await dlg.getByRole("button", { name: "Aprovar" }).click();
await pg.getByText("Etapa aprovada. Seguiu para a próxima.").waitFor();
await pg.getByText(/Etapa 1 · aprovada por Carlos Eduardo Lima/).waitFor();
assert.equal(await pg.getByRole("button", { name: "Aprovar" }).count(), 0, "etapa 2 não é dele");
await pg.goto(BASE + "#/web/inspecoes/" + B.id);
await pg.getByRole("button", { name: "Reprovar" }).click();
await dlg.getByRole("button", { name: "Reprovar" }).click();
await dlg.getByText("Diga o motivo da reprovação.").waitFor();
await dlg.getByLabel(/Motivo/).fill("Temperatura de 6 °C sem foto do termômetro.");
await dlg.getByRole("button", { name: "Reprovar" }).click();
await pg.getByText("Inspeção reprovada.").waitFor();
await pg.getByText(/Etapa 1 · reprovada por Carlos/).waitFor();
assert.equal(await pg.getByRole("button", { name: "Reprovar" }).count(), 0);
await pg.screenshot({ path: `${SHOTS}/S12-aprovacao.png` });
s = await estado();
assert.equal(s.inspecoes.find((i) => i.id === A.id).aprovacao_etapa, 2);
assert.equal(s.inspecoes.find((i) => i.id === B.id).status, "reprovada");
passo("etapa 1: aprovar leva para a etapa 2; reprovar exige motivo e encerra como reprovada");

await pg.goto(BASE + "#/web/aprovacoes?aba=decididas");
await pg.getByText(/Aprovou · etapa 1/).waitFor();
await pg.getByText(/Reprovou · etapa 1/).waitFor();
passo("S32 'Já decididas' lista as duas decisões do Carlos");

// ================= etapa 2: Rogério =================
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/aprovacoes");
await pg.locator("table a.rowlink").first().waitFor();
assert.equal(await pg.locator("table a.rowlink").count(), 1);
await pg.locator("table a.rowlink").first().click();
await pg.getByRole("button", { name: "Aprovar" }).click();
await dlg.getByLabel(/Comentário/).fill("Ok.");
await dlg.getByRole("button", { name: "Aprovar" }).click();
await pg.getByText("Inspeção aprovada.").waitFor();
await pg.getByText(/Aprovada · etapa 2 de 2/).waitFor();
s = await estado();
assert.equal(s.inspecoes.find((i) => i.id === A.id).status, "aprovada");
assert.deepEqual(s.aprovacoes.filter((a) => a.inspecao_id === A.id).map((a) => [a.etapa, a.aprovador_id]), [[1, "m-carlos"], [2, "m-rogerio"]]);
await pg.goto(BASE + "#/web/aprovacoes");
await pg.getByText("Nada esperando a sua decisão").waitFor();
passo("etapa 2 aprovada: inspeção fica 'Aprovada'; histórico mostra as duas etapas; fila esvazia");

await pg.goto(BASE + "#/web/inspecoes?status=aprovada");
await pg.locator("table a.rowlink").first().waitFor();
assert.equal(await pg.locator("table a.rowlink").count(), 1);
passo("histórico filtra por 'Aprovada'");

// aplicadora não decide
await entrar("ana@exemplo.com");
await pg.goto(BASE + "#/web/aprovacoes");
await pg.getByText("Você não tem acesso a esta área").waitFor();
passo("quem não tem a ação 'aprovar' não acessa Aprovações");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
