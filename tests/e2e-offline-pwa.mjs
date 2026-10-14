// O app abre e funciona com o aparelho SEM internet (service worker + IndexedDB).
import { chromium } from "playwright";
import assert from "node:assert/strict";
const BASE = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const p = await ctx.newPage();
await p.goto(BASE + "#/entrar");
await p.getByLabel("E-mail").fill("ana@exemplo.com");
await p.getByLabel("Senha").fill("ana12345");
await p.getByRole("button", { name: "Entrar" }).click();
await p.getByText("1 formulário disponível").waitFor();
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForFunction(() => !!navigator.serviceWorker.controller || location.reload());
await p.getByText("1 formulário disponível").waitFor();
console.log("✓ online: logado, pacote baixado, service worker ativo");

await ctx.setOffline(true);                       // rede do aparelho cortada de verdade
await p.reload();
await p.getByText("Olá, Ana").waitFor();
await p.getByText("Sem conexão").first().waitFor();
console.log("✓ offline: app reabriu do cache e sabe que está sem rede");
await p.getByRole("link", { name: /Nova inspeção/ }).click();
await p.getByRole("link", { name: /Checklist FLV/ }).click();
await p.getByRole("button", { name: /Loja 02 — Centro/ }).click();
await p.waitForURL(/aplicar/);
await p.getByRole("radio", { name: "Sim, nada vencido" }).click();
console.log("✓ offline: iniciou inspeção e respondeu sem rede");
await p.goto(BASE + "#/campo");
await p.getByText("Continuar de onde parou").waitFor();
console.log("✓ offline: rascunho preservado ao sair e voltar");
await ctx.setOffline(false);
await b.close();
