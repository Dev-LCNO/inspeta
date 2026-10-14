// Marco 3: painel de indicadores (KPIs, linha semanal, barras, tabela, filtros, permissão).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerEstado, gravarEstado as gravarEstadoB, lerAnexo, copiarServidor, BACKEND } from "./lib/backend.mjs";

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
const estado = () => lerEstado(pg);

await entrar("rogerio@exemplo.com");
await pg.getByRole("link", { name: "Painel" }).click();
await pg.getByTestId("kpi-inspecoes").waitFor();
assert.equal(await pg.getByTestId("kpi-inspecoes").textContent(), "2");
await pg.getByRole("button", { name: /Gerar 12 semanas de exemplo/ }).click();
await pg.getByText(/72 inspeções de exemplo criadas/).waitFor();
await pg.waitForFunction(() => document.querySelector('[data-testid="kpi-inspecoes"]')?.textContent === "74");
await pg.getByRole("button", { name: /Gerar 12 semanas/ }).waitFor({ state: "detached" });
passo("dados de exemplo: 72 inspeções em 12 semanas; KPIs atualizam (2 → 74)");

// confere a nota média do KPI contra o banco
const s = await estado();
const fins = s.inspecoes.filter((i) => i.status !== "rascunho" && i.nota_pct !== null);
const media = fins.reduce((a, i) => a + i.nota_pct, 0) / fins.length;
const kpiNota = (await pg.getByTestId("kpi-nota").textContent()).replace("%", "").replace(",", ".");
assert.ok(Math.abs(Number(kpiNota) - media) < 0.051, `nota do KPI ${kpiNota} vs ${media}`);
passo(`nota média do KPI bate com o banco (${kpiNota}%)`);

// linha: 13 ou 14 semanas, hover mostra a semana; teclado também
const svg = pg.locator(".viz-plot svg");
await svg.waitFor();
const bb = await svg.boundingBox();
await pg.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height / 2);
await pg.locator(".viz-plot .viz-tip").getByText(/Semana de/).waitFor();
await pg.mouse.move(0, 0);
await svg.focus();
await pg.keyboard.press("ArrowRight");
await pg.locator(".viz-plot .viz-tip").getByText(/Semana de/).waitFor();
passo("linha semanal: crosshair no mouse e navegação por setas mostram a semana");

// barras por avaliado: do pior ao melhor; tabela
const nomes = await pg.locator("section.viz").nth(1).locator(".viz-bars li .lbl > span").allTextContents();
assert.equal(nomes.length, 3);
const notas = await pg.locator("section.viz").nth(1).locator(".viz-bars li .val").allTextContents();
const nums = notas.map((t) => Number(t.replace("%", "").replace(",", ".")));
assert.deepEqual([...nums].sort((a, b) => a - b), nums, "ordenado do pior para o melhor");
await pg.locator("section.viz").nth(2).getByText("Ver como tabela").click();
await pg.locator("section.viz").nth(2).locator("table tbody tr").first().waitFor();
const topNc = await pg.locator("section.viz").nth(2).locator(".viz-bars li .lbl > span").first().textContent();
assert.ok(topNc.length > 5);
await pg.locator("section.viz").nth(1).locator(".viz-bars li").first().hover();
await pg.locator("section.viz").nth(1).locator(".viz-tip").getByText(/inspeç/).waitFor();
await pg.mouse.move(0, 0);
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${SHOTS}/Painel.png`, fullPage: true });
passo(`por avaliado ordenado do pior ao melhor (${nums.join(" · ")}); NC mais frequente: "${topNc}"; tabela e dica funcionam`);

// filtro por formulário escopa tudo
await pg.getByLabel("Formulário").selectOption({ label: "Recebimento de refrigerados" });
await pg.waitForURL(/formulario=f-receb/);
await pg.waitForFunction(() => document.querySelectorAll("section.viz:nth-of-type(n) .viz-bars").length && document.querySelector('[data-testid="kpi-inspecoes"]')?.textContent !== "74");
const qtdReceb = s.inspecoes.filter((i) => i.formulario_id === "f-receb" && i.status !== "rascunho").length;
await pg.waitForFunction((n) => document.querySelector('[data-testid="kpi-inspecoes"]')?.textContent === String(n), qtdReceb);
assert.equal(await pg.locator("section.viz").nth(1).locator(".viz-bars li").count(), 1);
passo(`filtro por formulário escopa KPIs e gráficos (${qtdReceb} inspeções do recebimento, 1 avaliado)`);

// período curto
await pg.getByLabel("Período").selectOption("30");
await pg.waitForURL(/periodo=30/);
await pg.getByTestId("kpi-inspecoes").waitFor();
passo("filtro de período vai para a URL");

// mobile
await pg.setViewportSize({ width: 390, height: 844 });
await pg.goto(BASE + "#/web/painel");
await pg.locator(".viz-plot svg").waitFor();
const larg = await pg.evaluate(() => document.documentElement.scrollWidth);
if (larg > 390) { const largos = await pg.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > 392).slice(0, 8).map((e) => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right))); console.log(largos); }
assert.ok(larg <= 390, `rola na horizontal (${larg}px)`);
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${SHOTS}/Painel-390.png`, fullPage: true });
passo("390 px: sem rolagem horizontal");

// permissão: aplicadora não tem ver_painel
await pg.setViewportSize({ width: 1440, height: 900 });
await entrar("ana@exemplo.com");
await pg.goto(BASE + "#/web/painel");
await pg.getByText("Você não tem acesso a esta área").waitFor();
passo("quem não tem 'ver painel' não entra");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
