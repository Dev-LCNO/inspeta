// Critério de pronto do Marco 1 (architecture.md §5):
// "inspeção feita em modo avião aparece corretamente na web depois de reconectar,
//  sem duplicar ao reenviar" — e o PDF sai com fotos.
// Rodar: node tests/e2e-fatia.mjs  (com app/dist servido em :4173)
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
fs.mkdirSync(SHOTS, { recursive: true });

const foto = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 120, g: 160, b: 90 } } })
  .composite([{ input: Buffer.from('<svg width="2400" height="1800"><rect x="300" y="300" width="1200" height="900" fill="#c33"/></svg>') }])
  .jpeg({ quality: 90 }).toBuffer();
fs.writeFileSync("/tmp/foto-teste.jpg", foto);

const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
async function pagina(ctx) {
  // fontes do Google: a rede deste ambiente é bloqueada; responde vazio (o app cai na fonte do sistema)
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  return p;
}
async function shot(p, nome) { await p.waitForTimeout(250); await p.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: false }); }
async function lerKV(p, key) {
  return p.evaluate((k) => new Promise((res, rej) => {
    const r = indexedDB.open("inspeta", 1);
    r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); };
  }), key);
}
async function gravarKV(p, key, val) {
  return p.evaluate(([k, v]) => new Promise((res) => {
    const r = indexedDB.open("inspeta", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => { const t = r.result.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => { r.result.close(); res(); }; };
  }), [key, val]);
}

// ============ 1. aplicadora no celular ============
const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, acceptDownloads: true });
const p = await pagina(cel);
await p.goto(BASE + "#/entrar");
await shot(p, "S01-390");
await p.getByLabel("E-mail").fill("ana@exemplo.com");
await p.getByLabel("Senha").fill("ana12345");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL(/#\/campo$/);
await p.getByText("1 formulário disponível").waitFor({ timeout: 8000 }); // Ana só tem o Checklist FLV
passo("login da aplicadora + primeira sincronização baixou o pacote");
await shot(p, "M02-390");

// modo avião
await p.getByRole("switch", { name: /Modo avião/ }).check();
await p.getByText("Sem conexão").first().waitFor();
passo("modo avião ligado");

await p.getByRole("link", { name: /Nova inspeção/ }).click();
await p.getByRole("link", { name: /Checklist FLV/ }).click();
await shot(p, "M05-390");
await p.getByRole("button", { name: /Loja 01 — Bosque/ }).click();
await p.waitForURL(/#\/campo\/aplicar\//);
passo("inspeção criada offline");

// --- tópico 1: Área de venda
await p.getByRole("radio", { name: /Não, encontrei vencidos/ }).click();
await p.getByText("Repetiu a não conformidade da última inspeção").waitFor();
passo("reincidência detectada offline (anterior também era NC)");
await p.getByText("Falta para seguir").first().waitFor();
const q1 = p.locator("fieldset.q").first();
await q1.locator('input[type="file"]').setInputFiles("/tmp/foto-teste.jpg");
await q1.locator(".ph img").first().waitFor();
await q1.getByLabel(/Observação/).fill("Iogurte natural vencido de novo, lote 1002.");
await q1.locator(".need.done").nth(1).waitFor();
passo("NC exigiu foto + observação; as duas ficaram atendidas");
await shot(p, "M06-nc-390");
await p.getByRole("radio", { name: "Sim", exact: true }).first().click();
await p.getByRole("checkbox", { name: "Limpas" }).click();
await p.getByRole("checkbox", { name: "Abastecidas" }).click();
await p.getByRole("button", { name: "Próximo" }).click();

// --- tópico 2: Câmara fria
await p.locator("h1", { hasText: "Câmara fria" }).waitFor();
const temp = p.locator("input.numin");
await temp.fill("9");
await p.getByText(/Fora do limite/).waitFor();
await temp.fill("3,5");
await p.getByText(/Dentro do limite/).waitFor();
passo("limite numérico reage em tempo real (9 fora, 3,5 dentro)");
await p.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-teste.jpg");
await p.locator("fieldset.q").first().locator(".ph img").first().waitFor();
await p.getByRole("radio", { name: "Não", exact: true }).click();
await p.getByText("O que está causando a fresta?").waitFor();
passo("questão dependente apareceu ao marcar 'Não'");
await p.locator("fieldset.q").nth(2).locator("textarea").first().fill("Borracha da porta rasgada no canto inferior.");
await shot(p, "M06-390");
await p.getByRole("button", { name: "Próximo" }).click();

// --- tópico 3: Encerramento (assinatura)
await p.locator("h1", { hasText: "Encerramento" }).waitFor();
await p.getByRole("button", { name: "Revisar" }).click();
await p.getByText(/Falta 1 questão para finalizar/).waitFor();
passo("revisão bloqueia: falta a assinatura obrigatória");
await shot(p, "M06-revisao-pend-390");
await p.getByRole("button", { name: /Assinatura do responsável/ }).click();
await p.getByRole("button", { name: "Coletar assinatura" }).click();
const pad = p.locator("canvas.sigpad");
const bb = await pad.boundingBox();
await p.mouse.move(bb.x + 20, bb.y + bb.height * 0.6);
await p.mouse.down();
for (let k = 0; k < 12; k++) await p.mouse.move(bb.x + 20 + k * 20, bb.y + bb.height * (0.6 - 0.25 * Math.sin(k / 2)));
await p.mouse.up();
await shot(p, "M07-390");
await p.getByRole("button", { name: "Salvar assinatura" }).click();
await p.getByAltText("Assinatura coletada").waitFor();
passo("assinatura coletada");
await p.getByRole("button", { name: "Revisar" }).click();
await p.getByText("Tudo respondido").waitFor();
// nota prévia: área de venda (0+10+10)=20 × 0,5 desconto = 10/30; câmara 10+0 = 10/20 → 20/50 = 40%
await p.getByText("40,0% · Ruim").waitFor();
passo("nota prévia no aparelho: 40,0% Ruim (com desconto de 50% no tópico)");
await shot(p, "M06-revisao-390");
await p.getByRole("button", { name: "Finalizar" }).click();
await p.getByText("Guardada no aparelho").waitFor();
await p.getByText("1 aguardando internet").waitFor();
passo("finalizada offline: fica na fila do aparelho");
await shot(p, "M11-offline-390");

// servidor ainda não sabe de nada
let srv = await lerKV(p, "srv:state");
const antes = srv.inspecoes.length;
assert.equal(srv.inspecoes.filter((i) => i.avaliado_id === "a-bosque").length, 1, "só a inspeção de exemplo antes do sync");

// ============ 2. volta a internet ============
await p.getByRole("link", { name: /aguardando internet/ }).click();
await p.getByRole("switch", { name: /Modo avião/ }).uncheck();
await p.getByText("Tudo em dia").or(p.getByText(/Sincronizado agora/)).first().waitFor({ timeout: 10000 });
srv = await lerKV(p, "srv:state");
assert.equal(srv.inspecoes.length, antes + 1, "uma inspeção nova no servidor");
const nova = srv.inspecoes.find((i) => i.device_id !== "seed" && i.avaliado_id === "a-bosque");
assert.equal(nova.nota_pct, 40);
assert.equal(nova.classificacao, "Ruim");
assert.equal(nova.qtd_nao_conformidades, 2);
assert.equal(nova.resultado.questoes["q-vencidos"].reincidente, true);
assert.equal(nova.anexos.length, 3, "2 fotos + 1 assinatura");
passo("ao reconectar, o sync enviou sozinho; servidor recalculou 40% Ruim, 2 NCs, reincidente, 3 anexos");
const fotoSrv = await lerKV(p, "srv:anexo:" + nova.anexos.find((a) => a.tipo === "foto").client_uuid);
const dims = await sharp(Buffer.from(fotoSrv.split(",")[1], "base64")).metadata();
assert.ok(Math.max(dims.width, dims.height) <= 1600, "foto comprimida no aparelho");
passo(`foto 2400×1800 chegou comprimida para ${dims.width}×${dims.height}`);
await shot(p, "M03-390");

// ============ 3. reenvio não duplica ============
const dev = await lerKV(p, "dev:m-ana");
dev.inspecoes.forEach((i) => { if (i.client_uuid === nova.client_uuid) { i.estado = "na_fila"; i.fotos.forEach((f) => { f.enviada = false; }); } });
await gravarKV(p, "dev:m-ana", dev);
await p.reload();
await p.getByRole("button", { name: /Sincronizar agora/ }).click();
await p.getByText("1 inspeção enviada").waitFor({ timeout: 10000 });
srv = await lerKV(p, "srv:state");
assert.equal(srv.inspecoes.length, antes + 1, "reenvio NÃO criou outra inspeção");
assert.equal(srv.inspecoes.filter((i) => i.client_uuid === nova.client_uuid).length, 1);
passo("reenvio forçado (fila + fotos) não duplicou nada");

// ============ 4. gestor na web ============
const web = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const w = await pagina(web);
w.on("framenavigated", (f) => { if (f === w.mainFrame()) console.log("   (web navegou para", f.url() + ")"); });
w.on("crash", () => console.log("   (aba web travou)"));
// mesmo navegador = mesmo IndexedDB no servidor falso: copia o estado do celular
const estado = await lerKV(p, "srv:state");
const anexos = {};
for (const a of nova.anexos) anexos[a.client_uuid] = await lerKV(p, "srv:anexo:" + a.client_uuid);
await w.goto(BASE + "#/entrar");
await w.getByLabel("E-mail").waitFor();
await w.waitForLoadState("networkidle");
await gravarKV(w, "srv:state", estado);
for (const [k, v] of Object.entries(anexos)) await gravarKV(w, "srv:anexo:" + k, v);
await shot(w, "S01-1440");
await w.getByLabel("E-mail").fill("rogerio@exemplo.com");
await w.getByLabel("Senha").fill("demo1234");
await w.getByRole("button", { name: "Entrar" }).click();
await w.waitForURL(/#\/web\/inspecoes/);
await w.locator("tbody a.rowlink").first().waitFor();
assert.equal(await w.locator("tbody tr").count(), 3);
const linha = w.locator("tbody tr").first();
assert.match(await linha.innerText(), /Loja 01 — Bosque[\s\S]*40,0%/);
passo("histórico web mostra a inspeção no topo com 40,0%");
await shot(w, "S04-1440");
await w.getByLabel("Buscar").fill("doca");
await w.waitForFunction(() => document.querySelectorAll("tbody a.rowlink").length === 1);
assert.match(w.url(), /q=doca/);
passo("busca filtra e vai para a URL");
await w.getByRole("button", { name: "Limpar filtros" }).click();
await w.waitForFunction(() => document.querySelectorAll("tbody a.rowlink").length === 3);
await w.locator("tbody a.rowlink", { hasText: "Loja 01 — Bosque" }).first().click();
await w.getByText("Reincidente").first().waitFor();
await w.getByText("2 não conformidades").waitFor();
await w.getByText("Desconto de 50%").waitFor();
await w.locator(".thumbs img").first().waitFor();
passo("detalhe: nota, reincidente, 2 NCs, desconto e fotos");
await shot(w, "S12-1440");
const [dl] = await Promise.all([w.waitForEvent("download"), w.getByRole("button", { name: "Baixar PDF" }).click()]);
const pdfPath = "/tmp/relatorio-teste.pdf";
await dl.saveAs(pdfPath);
const pdf = fs.readFileSync(pdfPath);
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
assert.ok(pdf.length > 20_000, "PDF com imagens embutidas");
passo(`PDF gerado: ${dl.suggestedFilename()} (${Math.round(pdf.length / 1024)} KB)`);
await w.getByText("Relatório gerado").waitFor();
passo("geração do relatório registrada no histórico da inspeção");

// ============ 5. editor + publicar versão 2 ============
await w.goto(BASE + "#/web/formularios");
await w.getByRole("link", { name: "Checklist FLV e perecíveis" }).waitFor();
await shot(w, "S13-1440");
await w.getByRole("link", { name: "Checklist FLV e perecíveis" }).click();
await w.getByText("Escolha uma questão").or(w.getByText("Questão 1")).first().waitFor();
await shot(w, "S14-1440");
await w.getByRole("button", { name: "Nova questão" }).first().click();
await w.getByLabel("Pergunta").fill("Placas de oferta dentro da validade?");
await w.getByText("Rascunho salvo").waitFor({ timeout: 5000 });
await w.getByRole("button", { name: /Publicar v2/ }).click();
await w.getByText(/Versão 2 publicada/).waitFor();
passo("editor: nova questão + autosave + publicação da v2");
// publicar inválido é barrado
await w.getByRole("button", { name: "Nova questão" }).first().click();
await w.getByLabel("Pergunta").fill("");
await w.getByRole("button", { name: /Publicar v3/ }).click();
await w.getByText(/Corrija antes de publicar/).waitFor();
passo("publicação com questão sem título é barrada com a lista de problemas");
await w.goto(BASE + "#/web/formularios/f-flv?aba=configuracoes");
await w.getByText("Classificação da nota").waitFor();
await shot(w, "S15-1440");
await w.goto(BASE + "#/web/formularios/f-flv?aba=avaliados");
await shot(w, "S17-1440");
await w.goto(BASE + "#/web/avaliados");
await w.getByRole("cell", { name: "CD — Doca 3" }).waitFor();
await shot(w, "S21-1440");

// a inspeção antiga continua na versão 1 (imutável)
const est2 = await lerKV(w, "srv:state");
assert.equal(est2.inspecoes.find((i) => i.client_uuid === nova.client_uuid).formulario_versao_id, "fv-flv-1");
assert.equal(est2.versoes.filter((v) => v.formulario_id === "f-flv").length, 2);
passo("inspeção antiga segue presa à v1; formulário tem v1 e v2");

// ============ 6. telas no outro tamanho ============
await w.setViewportSize({ width: 390, height: 844 });
await w.goto(BASE + "#/web/inspecoes");
await w.locator(".list-card").first().waitFor();
await shot(w, "S04-390");
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto(BASE + "#/campo");
await shot(p, "M02-1440");

// acessibilidade básica: aplicadora não entra no editor
await p.goto(BASE + "#/web/formularios");
await p.getByText("Você não tem acesso a esta área").waitFor();
passo("aplicadora bloqueada no editor de formulários");

console.log(erros.length ? "\nERROS NO CONSOLE:\n" + erros.join("\n") : "\nconsole sem erros");
await browser.close();
if (erros.length) process.exit(1);
