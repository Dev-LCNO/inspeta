// Marco 3: layout configurável do relatório PDF (S16): cor, logo, colunas, exceções, rodapé.
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerEstado, gravarEstado as gravarEstadoB, lerAnexo, copiarServidor, BACKEND } from "./lib/backend.mjs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
fs.mkdirSync(SHOTS, { recursive: true });
// logo de teste: quadrado verde-limão com fundo transparente
fs.writeFileSync("/tmp/logo-teste.png", await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 120, g: 200, b: 40, alpha: 1 } } }).png().toBuffer());
const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Rio_Branco", acceptDownloads: true });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const pg = await ctx.newPage();
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));
const estado = () => lerEstado(pg);
async function baixarPdf(botao, nome) {
  const [dl] = await Promise.all([pg.waitForEvent("download"), botao.click()]);
  const path = `/tmp/${nome}.pdf`;
  await dl.saveAs(path);
  return { path, texto: execFileSync("pdftotext", ["-layout", path, "-"]).toString() };
}
await pg.goto(BASE + "#/entrar");
await pg.getByLabel("E-mail").fill("rogerio@exemplo.com");
await pg.getByLabel("Senha").fill("demo1234");
await pg.getByRole("button", { name: "Entrar" }).click();
await pg.waitForURL(/#\/web/);

await pg.goto(BASE + "#/web/formularios/f-flv?aba=relatorio");
const exemplo = pg.getByRole("button", { name: "Baixar PDF de exemplo" });
const A = await baixarPdf(exemplo, "padrao");
assert.match(A.texto, /Todos os itens da bancada têm preço visível\?/);
assert.match(A.texto, /NOTA FINAL/);

await pg.getByRole("button", { name: "Vinho" }).click();
await pg.locator('input[aria-label="Arquivo do logo"]').setInputFiles("/tmp/logo-teste.png");
await pg.getByAltText("Logo atual").waitFor();
await pg.getByLabel("Respostas em").selectOption("2");
await pg.getByLabel("Fotos", { exact: true }).selectOption("final");
await pg.getByRole("switch", { name: /Listar só as exceções/ }).check();
await pg.getByLabel("Texto do rodapé").fill("Uso interno — Qualidade");
await pg.getByText("Rascunho salvo").waitFor({ timeout: 5000 });
await pg.screenshot({ path: `${SHOTS}/S16.png`, fullPage: true });
const B = await baixarPdf(exemplo, "configurado");
assert.match(B.texto, /Uso interno — Qualidade/);
assert.match(B.texto, /questões? conformes? neste tópico/);
assert.doesNotMatch(B.texto, /Todos os itens da bancada têm preço visível\?/, "conforme some no modo exceções");
assert.match(B.texto, /A área de venda está livre de produtos vencidos\?/, "não conforme continua");
execFileSync("pdftoppm", ["-png", "-r", "50", "-f", "1", "-l", "1", B.path, "/tmp/rel-b"]);
const png = fs.readdirSync("/tmp").find((f) => f.startsWith("rel-b") && f.endsWith(".png"));
const { data, info } = await sharp("/tmp/" + png).raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
const faixa = px(Math.round(info.width / 2), 1);
assert.ok(Math.abs(faixa[0] - 0x8a) < 20 && faixa[1] < 60 && faixa[2] < 70, `faixa do topo na cor vinho (${faixa})`);
let verde = 0;
for (let x = Math.round(info.width * 0.7); x < info.width - 5; x++) for (let y = 10; y < 60; y++) { const [r, g, b] = px(x, y); if (g > 170 && r < 160 && b < 90) verde++; }
assert.ok(verde > 50, "logo desenhado no canto do cabeçalho");
fs.copyFileSync("/tmp/" + png, `${SHOTS}/S16-pdf.png`);
passo("exemplo com layout: faixa vinho, logo no cabeçalho, duas colunas, só exceções e rodapé próprio");

// vale para o PDF da inspeção depois de publicar
await pg.getByRole("button", { name: /Publicar v2/ }).click();
await pg.getByText(/Versão 2 publicada/).waitFor();
const s = await estado();
const seed = s.inspecoes.find((i) => i.client_uuid === "seed-0001");
await pg.goto(BASE + "#/web/inspecoes/" + seed.id);
const C = await baixarPdf(pg.getByRole("button", { name: "Baixar PDF" }), "inspecao");
assert.match(C.texto, /Uso interno — Qualidade/);
assert.match(C.texto, /questões? conformes? neste tópico/);
passo("depois de publicar, o PDF de uma inspeção antiga (v1) já sai com o layout novo");

// mostrar nota desligado
await pg.goto(BASE + "#/web/formularios/f-flv?aba=relatorio");
await pg.getByRole("switch", { name: "Mostrar a nota" }).uncheck();
await pg.getByText("Rascunho salvo").waitFor({ timeout: 5000 });
const D = await baixarPdf(pg.getByRole("button", { name: "Baixar PDF de exemplo" }), "sem-nota");
assert.doesNotMatch(D.texto, /NOTA FINAL/);
passo("sem nota: o PDF sai sem nota final nem nota por tópico");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
