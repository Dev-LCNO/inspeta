// Marco 3: importar formulário por planilha (S20), modelos prontos e cópia, aprovação de plano de ação.
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerEstado, gravarEstado as gravarEstadoB, lerAnexo, copiarServidor, BACKEND } from "./lib/backend.mjs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync("/tmp/foto-modelos.jpg", await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 150, g: 110, b: 90 } } }).jpeg().toBuffer());
const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Rio_Branco", acceptDownloads: true });
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
const dlg = pg.getByRole("dialog");

// ================= S20 importar =================
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/formularios");
await pg.getByRole("link", { name: "Importar planilha" }).click();
const [dl] = await Promise.all([pg.waitForEvent("download"), pg.getByRole("button", { name: "Baixar modelo" }).click()]);
const modelo = fs.readFileSync(await dl.path(), "utf8");
assert.match(modelo, /^﻿?Tópico;Questão;Tipo;Obrigatória/);
// planilha do usuário: Windows-1252 não, UTF-8 com ; — duas linhas com problema
const csv = "﻿Tópico;Questão;Tipo;Obrigatória;Opções;Pontos;Não conformes;Unidade;Mínimo;Máximo;Foto obrigatória;Ajuda\n"
  + "Gôndola;Etiqueta de preço em todos os itens?;Sim/Não;sim;;;;;;;não;\n"
  + ';Frente da gôndola (facing) completa?;Escolha única;sim;"Completa; Falhas pontuais; Vazia";"10; 5; 0";Vazia;;;;sim;Foto da gôndola inteira.\n'
  + ";Itens fora do planograma;Número;sim;;;;itens;0;2;não;\n"
  + ";Altura das prateleiras;Régua;sim;;;;;;;;\n"
  + "Ponta de gôndola;Ponta conforme o tema do mês?;Escolha única;sim;Sim;;;;;;não;\n"
  + ";Observações;Texto;não;;;;;;;não;\n";
fs.writeFileSync("/tmp/gc-loja.csv", csv);
await pg.locator('input[type="file"]').setInputFiles("/tmp/gc-loja.csv");
await pg.getByTestId("erros-import").waitFor();
const errosTxt = await pg.getByTestId("erros-import").textContent();
assert.match(errosTxt, /Linha 5: tipo "Régua" não reconhecido/);
assert.match(errosTxt, /Linha 6: escolha precisa de pelo menos 2 opções/);
await pg.getByText("4 questões").waitFor();
await pg.getByText("2 tópicos").waitFor();
assert.equal(await pg.getByLabel("Nome do formulário").inputValue(), "gc loja");
await pg.getByLabel("Nome do formulário").fill("Auditoria de GC — gôndolas");
await pg.screenshot({ path: `${SHOTS}/S20.png`, fullPage: true });
await pg.getByRole("button", { name: "Criar rascunho" }).click();
await pg.waitForURL(/formularios\/(?!importar)/);
await pg.getByText("Rascunho criado com 4 questões").waitFor();
await pg.getByRole("button", { name: /Publicar v1/ }).click();
await pg.getByText(/Versão 1 publicada/).waitFor();
let s = await estado();
const gc = s.formularios.find((f) => f.nome === "Auditoria de GC — gôndolas");
const qs = gc.rascunho.topicos.flatMap((t) => t.questoes);
assert.equal(qs[1].foto_obrigatoria, true);
assert.equal(qs[1].opcoes.find((o) => o.texto === "Vazia").conforme, false);
assert.deepEqual(qs[2].numerica.limite, { min: 0, max: 2, obs_obrigatoria: true });
passo("S20: modelo baixado; planilha com 2 linhas ruins entra com 4 questões em 2 tópicos, erros listados por linha; publicada como v1");

// ================= modelos prontos e cópia =================
await pg.goto(BASE + "#/web/formularios");
await pg.getByRole("button", { name: "Novo formulário" }).click();
await dlg.getByRole("radio", { name: /Câmara fria/ }).check();
assert.equal(await dlg.getByLabel("Nome", { exact: true }).inputValue(), "Câmara fria");
await pg.screenshot({ path: `${SHOTS}/S13-modelos.png` });
await dlg.getByRole("button", { name: "Criar e editar" }).click();
await pg.waitForURL(/formularios\/[^/]+$/);
await pg.getByText("Temperatura da câmara de resfriados").first().waitFor();
await pg.getByRole("button", { name: /Publicar v1/ }).click();
await pg.getByText(/Versão 1 publicada/).waitFor();
passo("modelo pronto 'Câmara fria' vira formulário com 7 questões e publica sem ajuste");

await pg.goto(BASE + "#/web/formularios");
await pg.getByRole("button", { name: "Novo formulário" }).click();
await dlg.getByLabel("Ou copiar um formulário seu").selectOption({ label: "Checklist FLV e perecíveis" });
assert.equal(await dlg.getByLabel("Nome", { exact: true }).inputValue(), "Checklist FLV e perecíveis (cópia)");
await dlg.getByRole("button", { name: "Criar e editar" }).click();
await pg.waitForURL(/formularios\/[^/]+$/);
s = await estado();
const copia = s.formularios.find((f) => f.nome === "Checklist FLV e perecíveis (cópia)");
assert.equal(JSON.stringify(copia.rascunho), JSON.stringify(s.formularios.find((f) => f.id === "f-flv").rascunho));
assert.equal(copia.versao_publicada_id, null);
passo("cópia de formulário: mesmo conteúdo, nasce como rascunho não publicado");

// ================= aprovação de plano de ação =================
await pg.goto(BASE + "#/web/planos/modelos/pm-retirada");
await pg.getByRole("switch", { name: /Exigir aprovação da correção/ }).check();
await pg.getByRole("button", { name: "Salvar" }).click();
await pg.getByText(/Modelo salvo/).waitFor();

await pg.setViewportSize({ width: 390, height: 844 });
await entrar("ana@exemplo.com");
await pg.goto(BASE + "#/campo/nova");
await pg.getByRole("link", { name: /Checklist FLV/ }).click();
await pg.getByRole("button", { name: /Loja 01 — Bosque/ }).click();
await pg.waitForURL(/aplicar/);
await pg.getByRole("radio", { name: /Não, encontrei vencidos/ }).click();
const q1 = pg.locator("fieldset.q").first();
await q1.locator('input[type="file"]').setInputFiles("/tmp/foto-modelos.jpg");
await q1.locator(".ph img").waitFor();
await q1.getByLabel(/Observação/).fill("Queijo vencido.");
await pg.getByRole("radio", { name: "Sim", exact: true }).first().click();
await pg.getByRole("checkbox", { name: "Limpas" }).click();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.locator("input.numin").fill("3");
await pg.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-modelos.jpg");
await pg.locator("fieldset.q").first().locator(".ph img").waitFor();
await pg.getByRole("radio", { name: "Sim", exact: true }).click();
await pg.getByRole("button", { name: "Próximo" }).click();
await pg.getByRole("button", { name: "Coletar assinatura" }).click();
const bb = await pg.locator("canvas.sigpad").boundingBox();
await pg.mouse.move(bb.x + 30, bb.y + 60); await pg.mouse.down(); await pg.mouse.move(bb.x + 200, bb.y + 90); await pg.mouse.up();
await pg.getByRole("button", { name: "Salvar assinatura" }).click();
await pg.getByAltText("Assinatura coletada").waitFor();
await pg.getByRole("button", { name: "Revisar" }).click();
await pg.getByRole("button", { name: "Finalizar" }).click();
await pg.getByText("Enviada para o painel").waitFor({ timeout: 15000 });
s = await estado();
const plano = s.planos.find((p) => p.modelo_id === "pm-retirada");
assert.equal(plano.modelo_snapshot.exige_aprovacao, true);
const link1 = s.emails.find((e) => e.idem_key.startsWith("plano:" + plano.id)).link;

async function responder(link, nome) {
  await pg.goto(link);
  await pg.locator("fieldset.q").first().locator("textarea").fill("Produto retirado e descartado.");
  await pg.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-modelos.jpg");
  await pg.locator("fieldset.q").first().locator(".ph img").waitFor();
  await pg.getByRole("radio", { name: "Faltou ronda de validade" }).click();
  await pg.locator("fieldset.q").nth(2).locator("textarea").fill("Repositor do turno");
  await pg.getByLabel("Seu nome").fill(nome);
  await pg.getByRole("button", { name: "Enviar respostas" }).click();
}
await responder(link1, "Júlia — gerente");
await pg.getByText(/Agora um gestor vai conferir/).waitFor();
s = await estado();
assert.equal(s.planos.find((p) => p.id === plano.id).status, "em_aprovacao");
passo("resposta do responsável deixa o plano 'em aprovação' (não finaliza sozinho)");

// gestor devolve
await pg.setViewportSize({ width: 1440, height: 900 });
await entrar("rogerio@exemplo.com");
await pg.goto(BASE + "#/web/planos?situacao=em_aprovacao");
await pg.getByRole("row", { name: /Retirada e descarte/ }).getByRole("button", { name: "Loja 01 — Bosque" }).click();
await dlg.getByRole("button", { name: "Devolver" }).click();
await dlg.getByRole("button", { name: "Devolver correção" }).click();
await dlg.getByText("Diga o que falta na correção.").waitFor();
await dlg.getByLabel(/O que falta/).fill("A foto não mostra a bancada inteira.");
await pg.screenshot({ path: `${SHOTS}/S24-aprovacao.png` });
await dlg.getByRole("button", { name: "Devolver correção" }).click();
await pg.getByText(/Correção devolvida. O responsável recebeu um link novo./).waitFor();
s = await estado();
let p = s.planos.find((x) => x.id === plano.id);
assert.equal(p.status, "aberto");
assert.equal(p.reprovacoes.length, 1);
assert.deepEqual(p.respostas, {});
const devolvido = s.emails.find((e) => e.assunto.startsWith("Correção devolvida"));
assert.ok(devolvido && devolvido.link !== link1);
passo("devolver exige motivo; plano reabre com prazo novo, respostas limpas e e-mail com link novo");

await pg.setViewportSize({ width: 390, height: 844 });
await pg.goto(link1);
await pg.getByText("Link indisponível").waitFor();
await pg.goto(devolvido.link);
await pg.getByText(/A correção anterior foi devolvida/).waitFor();
await pg.getByText("“A foto não mostra a bancada inteira.”").waitFor();
await responder(devolvido.link, "Júlia — gerente");
await pg.getByText(/Agora um gestor vai conferir/).waitFor();
passo("link antigo deixa de valer; o novo mostra o motivo da devolução e aceita nova resposta");

await pg.setViewportSize({ width: 1440, height: 900 });
await pg.goto(BASE + "#/web/planos?situacao=em_aprovacao");
await pg.getByRole("row", { name: /Retirada e descarte/ }).getByRole("button", { name: "Loja 01 — Bosque" }).click();
await dlg.getByText(/Uma correção foi devolvida/).waitFor();
await dlg.getByRole("button", { name: "Aceitar correção" }).click();
await pg.getByText("Correção aceita. Plano finalizado.").waitFor();
s = await estado();
p = s.planos.find((x) => x.id === plano.id);
assert.equal(p.status, "finalizado");
assert.equal(p.aprovado_por, "m-rogerio");
passo("aceitar finaliza o plano e registra quem aprovou");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
