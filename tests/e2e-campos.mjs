// Marco 3: campos personalizados de avaliados (S22) — cadastro, dependência, edição, importação, filtros.
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
const estado = () => lerEstado(pg);
const dlg = pg.getByRole("dialog");
const linhas = () => pg.locator("table tbody tr");
await pg.goto(BASE + "#/entrar");
await pg.getByLabel("E-mail").fill("rogerio@exemplo.com");
await pg.getByLabel("Senha").fill("demo1234");
await pg.getByRole("button", { name: "Entrar" }).click();
await pg.waitForURL(/#\/web/);

// ================= lista com colunas e filtro =================
await pg.goto(BASE + "#/web/avaliados");
await pg.locator("thead th", { hasText: "Regional" }).waitFor();
await pg.locator("thead th", { hasText: "Formato" }).waitFor();
await pg.getByLabel("Formato").selectOption("Express");
await pg.waitForFunction(() => document.querySelectorAll("table tbody tr").length === 1);
await pg.getByRole("cell", { name: "Loja 02 — Centro" }).waitFor();
await pg.getByLabel("Formato").selectOption("");
passo("lista mostra Regional e Formato como colunas e filtra por Formato");

// ================= S22 editor =================
await pg.getByRole("tab", { name: /Campos/ }).or(pg.getByRole("link", { name: /Campos/ })).first().click();
await pg.getByRole("button", { name: "Novo campo" }).click();
const novo = pg.locator("section.card").last();
await novo.getByLabel("Nome do campo").fill("E-mail");
await pg.getByText('"E-mail" já é um campo padrão do cadastro.').waitFor();
assert.equal(await pg.getByRole("button", { name: "Salvar campos" }).isDisabled(), true);
await novo.getByLabel("Nome do campo").fill("Área de vendas (m²)");
await novo.getByLabel("Tipo").selectOption("numero");
await novo.getByRole("checkbox", { name: /Mostrar na lista/ }).check();
await pg.screenshot({ path: `${SHOTS}/S22.png`, fullPage: true });
await pg.getByRole("button", { name: "Salvar campos" }).click();
await pg.getByText("Campos salvos.").waitFor();
let s = await estado();
const area = s.camposAvaliado.find((c) => c.nome === "Área de vendas (m²)");
assert.equal(area.tipo, "numero");
passo("S22: campo novo (número, na lista); nome que já é campo padrão é barrado");

// ================= cadastro com dependência =================
await pg.goto(BASE + "#/web/avaliados");
await pg.getByRole("button", { name: "Novo avaliado" }).click();
await dlg.getByRole("textbox", { name: /^Nome/ }).fill("Loja 06 — Xapuri");
assert.equal(await dlg.getByLabel(/Cidade/).count(), 0, "Cidade escondida enquanto não for Interior");
await dlg.getByLabel("Regional").selectOption("Interior");
await dlg.getByLabel(/Cidade/).waitFor();
await dlg.getByRole("button", { name: "Cadastrar" }).click();
await dlg.getByText(/Cidade é obrigatório/).waitFor();
await dlg.getByLabel(/Cidade/).fill("Xapuri");
await dlg.getByLabel(/Área de vendas/).fill("850");
await dlg.getByRole("button", { name: "Cadastrar" }).click();
await pg.getByText("Loja 06 — Xapuri cadastrado.").waitFor();
s = await estado();
let l6 = s.avaliados.find((a) => a.nome === "Loja 06 — Xapuri");
assert.deepEqual(l6.campos, { "cp-regional": "Interior", "cp-cidade": "Xapuri", [area.id]: "850" });
passo("Cidade só aparece e só é exigida com Regional = Interior");

await pg.getByRole("button", { name: "Loja 06 — Xapuri" }).click();
await dlg.getByLabel("Regional").selectOption("Capital");
assert.equal(await dlg.getByLabel(/Cidade/).count(), 0);
await dlg.getByRole("button", { name: "Salvar" }).click();
await pg.getByText("Loja 06 — Xapuri atualizado.").waitFor();
s = await estado();
l6 = s.avaliados.find((a) => a.nome === "Loja 06 — Xapuri");
assert.equal(l6.campos["cp-cidade"], undefined, "valor escondido é descartado");
passo("editar avaliado: mudar a regional esconde e descarta a Cidade");

// ================= importação com campos =================
fs.writeFileSync("/tmp/avaliados-campos.csv", "﻿Nome;Código;Regional;Cidade;Formato\n"
  + "Loja 07 — Brasileia;LJ07;interior;Brasileia;Supermercado\n"
  + "Loja 08 — Sena;LJ08;Interior;;Express\n"
  + "Loja 09;LJ09;Norte;;\n");
await pg.goto(BASE + "#/web/avaliados/importar");
await pg.locator('input[type="file"]').setInputFiles("/tmp/avaliados-campos.csv");
await pg.getByText("1 novo").waitFor();
await pg.getByText("2 com problema").waitFor();
await pg.getByText(/Linha 3: Cidade é obrigatório/).waitFor();
await pg.getByText(/Linha 4: Regional: "Norte" não está entre as opções/).waitFor();
await pg.getByRole("button", { name: "Importar 1 avaliado" }).click();
await pg.getByText("Importação concluída").waitFor();
s = await estado();
assert.deepEqual(s.avaliados.find((a) => a.codigo_externo === "LJ07").campos, { "cp-regional": "Interior", "cp-cidade": "Brasileia", "cp-formato": "Supermercado" });
passo("importação associa colunas aos campos pelo nome, corrige 'interior' e valida obrigatório e opções por linha");

// ================= painel filtra por campo =================
await pg.goto(BASE + "#/web/painel");
await pg.getByTestId("kpi-inspecoes").waitFor();
assert.equal(await pg.getByTestId("kpi-inspecoes").textContent(), "2");
await pg.getByLabel("Formato").selectOption("Supermercado");
await pg.waitForURL(/c\.cp-formato=Supermercado/);
await pg.waitForFunction(() => document.querySelector('[data-testid="kpi-inspecoes"]')?.textContent === "1");
await pg.getByLabel("Regional").selectOption("Interior");
await pg.getByText("Nenhuma inspeção finalizada neste período").waitFor();
passo("painel filtra por Formato e Regional (filtros na URL)");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
