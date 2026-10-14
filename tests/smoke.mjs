import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
p.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
await p.goto("http://localhost:4173/#/entrar");
await p.getByLabel("E-mail").fill("rogerio@exemplo.com");
await p.getByLabel("Senha").fill("demo1234");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL(/#\/web\/inspecoes/);
await p.getByRole("cell", { name: "CD — Doca 3" }).waitFor();
console.log("linhas:", await p.locator("tbody tr").count());
for (const path of ["/web/formularios", "/web/formularios/f-flv", "/web/formularios/f-flv?aba=configuracoes", "/web/avaliados", "/web/planos", "/campo", "/campo/nova", "/campo/nova/f-flv"]) {
  await p.goto("http://localhost:4173/#" + path);
  await p.waitForTimeout(700);
  console.log(path, "→", (await p.locator("h1").first().innerText()).slice(0, 50));
}
console.log("ERROS:", erros.length ? erros : "nenhum");
await b.close();
