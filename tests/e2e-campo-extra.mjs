// Marco 3: preenchimento automático e único, incremento, geolocalização e tópico condicional.
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
const POS = { latitude: -9.974990, longitude: -67.824300, accuracy: 12 };
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Rio_Branco", geolocation: POS, permissions: ["geolocation"] });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const pg = await ctx.newPage();
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));
const estado = () => lerEstado(pg);
await pg.goto(BASE + "#/entrar");
await pg.getByLabel("E-mail").fill("rogerio@exemplo.com");
await pg.getByLabel("Senha").fill("demo1234");
await pg.getByRole("button", { name: "Entrar" }).click();
await pg.waitForURL(/#\/web/);

// ================= editor =================
await pg.goto(BASE + "#/web/formularios/f-receb");
const blocoQ = (t) => pg.locator(".qblock").filter({ hasText: t }).first();
await blocoQ("Temperatura do produto na chegada").click();
await pg.getByLabel(/Incremento/).fill("0,5");
await blocoQ("Tara da caixa").click();
await pg.getByRole("switch", { name: /Preencher com a última resposta/ }).check();
await pg.getByRole("button", { name: "Nova questão" }).first().click();
await pg.getByLabel("Pergunta").fill("A doca tem cobertura?");
await pg.getByRole("switch", { name: /Responder uma vez por avaliado/ }).check();
await pg.getByRole("button", { name: /Mostrar este tópico só sob condição/ }).last().click();
await pg.getByRole("group", { name: /Condição do tópico Conferência de peso/ }).waitFor();
await pg.goto(BASE + "#/web/formularios/f-receb?aba=configuracoes");
await pg.getByLabel(/Localização do aplicador/).selectOption("inicio_fim");
await pg.getByText("Rascunho salvo").waitFor({ timeout: 5000 });
await pg.getByRole("button", { name: /Publicar v2/ }).click();
try { await pg.getByText(/Versão 2 publicada/).waitFor({ timeout: 4000 }); } catch (e) { await pg.screenshot({ path: "/tmp/pub.png" }); throw e; }
let s = await estado();
const v2 = s.versoes.find((v) => v.formulario_id === "f-receb" && v.numero === 2).definicao;
const qs = v2.topicos.flatMap((t) => t.questoes);
const nova = qs.find((q) => q.titulo === "A doca tem cobertura?");
assert.equal(qs.find((q) => q.key === "r-temp").numerica.incremento, 0.5);
assert.equal(qs.find((q) => q.key === "r-tara").preenchimento_automatico, true);
assert.equal(nova.preenchimento_unico, true);
assert.deepEqual(v2.topicos[1].depende_de, { questao: "r-lacre", opcao: "r-lacre-sim" });
assert.equal(v2.config.geo, "inicio_fim");
await pg.screenshot({ path: `${SHOTS}/S14-condicao.png` });
passo("editor: incremento, preenchimento automático, resposta única, tópico condicional e GPS no início/fim publicados na v2");

// ================= campo: 1ª inspeção =================
await pg.setViewportSize({ width: 390, height: 844 });
async function abrir() {
  await pg.goto(BASE + "#/campo/sincronismo");
  await pg.getByRole("button", { name: /Sincronizar agora/ }).click();
  await pg.getByText(/Sincronizado agora/).first().waitFor();
  await pg.goto(BASE + "#/campo/nova");
  await pg.getByRole("link", { name: /Recebimento de refrigerados/ }).click();
  await pg.getByRole("button", { name: /CD — Doca 3/ }).click();
  await pg.waitForURL(/aplicar/);
}
await abrir();
await pg.locator("fieldset.q").first().locator("textarea").fill("000.777.001");
const lacre = pg.locator("fieldset.q").filter({ hasText: "O lacre do baú" });
const cobertura = pg.locator("fieldset.q").filter({ hasText: "A doca tem cobertura?" });
assert.equal(await pg.getByRole("button", { name: "Próximo" }).count() + await pg.getByRole("button", { name: "Revisar" }).count() > 0, true);
await lacre.getByRole("radio", { name: "Não", exact: true }).click();
await lacre.locator('input[type="file"]').setInputFiles({ name: "l.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync("/tmp/foto-agenda.jpg") });
await lacre.locator(".ph img").waitFor();
await pg.getByRole("button", { name: "Revisar" }).waitFor();
assert.equal(await pg.getByRole("button", { name: "Próximo" }).count(), 0, "com lacre 'Não' o tópico de peso some");
await lacre.getByRole("radio", { name: "Sim", exact: true }).click();
await pg.getByRole("button", { name: "Próximo" }).waitFor();
passo("tópico condicional: some com lacre 'Não' e volta com 'Sim'");
await cobertura.getByRole("radio", { name: "Sim", exact: true }).click();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.getByTestId("prefill-r-tara").waitFor();
assert.equal(await pg.locator("input.numin").nth(1).inputValue(), "0,6");
await pg.locator("input.numin").nth(0).fill("15");
for (let k = 0; k < 3; k++) await pg.getByRole("button", { name: "Aumentar 0,5" }).click();
await pg.getByRole("button", { name: "Diminuir 0,5" }).click();
assert.equal(await pg.locator("input.numin").nth(2).inputValue(), "1");
await pg.getByRole("button", { name: "Aumentar 0,5" }).click();
assert.equal(await pg.locator("input.numin").nth(2).inputValue(), "1,5");
await pg.screenshot({ path: `${SHOTS}/M06-incremento.png` });
passo("tara veio da última inspeção (0,6); botões −/+ andam de 0,5 em 0,5");
await pg.getByRole("button", { name: "Revisar" }).click();
await pg.getByText("Tudo respondido").waitFor();
await pg.getByRole("button", { name: "Finalizar" }).click();
await pg.getByText("Enviada para o painel").waitFor({ timeout: 15000 });

s = await estado();
const i1 = s.inspecoes.filter((i) => i.formulario_id === "f-receb" && i.formulario_versao_id === s.versoes.find((v) => v.formulario_id === "f-receb" && v.numero === 2).id)[0];
assert.equal(i1.respostas["r-temp"].numero, 1.5);
assert.ok(i1.geo_inicio && Math.abs(i1.geo_inicio.lat - POS.latitude) < 1e-5, "GPS do início");
assert.ok(i1.geo_fim && Math.abs(i1.geo_fim.lng - POS.longitude) < 1e-5, "GPS do fim");
assert.equal(i1.geo_fim.precisao_m, 12);
passo("GPS gravado no início e no fim, com precisão (±12 m)");

// ================= campo: 2ª inspeção =================
await abrir();
await cobertura.getByText("Respondida uma vez para este avaliado").waitFor();
assert.equal(await cobertura.getByRole("radio", { name: /^Sim/ }).getAttribute("aria-checked"), "true");
assert.equal(await cobertura.getByRole("radio", { name: /^Não/ }).isDisabled(), true);
passo("resposta única: 2ª inspeção já vem com 'Sim' e travada");
await pg.screenshot({ path: `${SHOTS}/M06-unico.png` });

// o servidor impõe o valor mesmo se o aparelho mandar outro
await pg.locator("fieldset.q").first().locator("textarea").fill("000.777.002");
await lacre.getByRole("radio", { name: "Sim", exact: true }).click();
const uuid = pg.url().split("/aplicar/")[1].split("?")[0];
await pg.evaluate(([u, k, o]) => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onsuccess = () => {
    const st = r.result.transaction("kv", "readwrite").objectStore("kv");
    const g = st.get("dev:m-rogerio");
    g.onsuccess = () => { const d = g.result; const i = d.inspecoes.find((x) => x.client_uuid === u); i.respostas[k] = { opcoes: [o] }; st.put(d, "dev:m-rogerio"); };
    st.transaction.oncomplete = () => { r.result.close(); res(); };
  };
}), [uuid, nova.key, nova.opcoes.find((o) => o.texto === "Não").key]);
await pg.reload();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.locator("input.numin").nth(0).fill("15");
await pg.locator("input.numin").nth(2).fill("4");
await pg.getByRole("button", { name: "Revisar" }).click();
await pg.getByRole("button", { name: "Finalizar" }).click();
try { await pg.getByText("Enviada para o painel").waitFor({ timeout: 6000 }); } catch (e) { await pg.waitForTimeout(3000); console.log(JSON.stringify(await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open("inspeta", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("dev:m-rogerio"); g.onsuccess = () => res(g.result.inspecoes.map((i) => [i.estado, i.erro, i.fotos.length, i.fotos.map((f) => f.enviada)])); }; })))); console.log(erros); throw e; }
s = await estado();
const i2 = s.inspecoes.find((i) => i.client_uuid === uuid);
assert.deepEqual(i2.respostas[nova.key].opcoes, nova.opcoes.filter((o) => o.texto === "Sim").map((o) => o.key));
passo("servidor impõe a resposta única mesmo que o aparelho mande outra");

// ================= web: local no detalhe =================
await pg.setViewportSize({ width: 1440, height: 900 });
await pg.goto(BASE + "#/web/inspecoes/" + i1.id);
const link = pg.getByRole("link", { name: /-9,97499; -67,82430 \(±12 m\)/ }).first();
await link.waitFor();
assert.match(await link.getAttribute("href"), /openstreetmap\.org\/\?mlat=-9\.97499&mlon=-67\.8243/);
passo("detalhe mostra o local do início e do fim com link para o mapa");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
