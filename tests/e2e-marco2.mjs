// Marco 2: planos de ação de ponta a ponta, e-mails, link público, prazos,
// e-mail do relatório e importação de avaliados (.xlsx e .csv).
import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = "replica/clone-screens";
const FIX = "tests/fixtures";
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync("/tmp/foto-teste.jpg", await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 90, g: 120, b: 160 } } }).jpeg().toBuffer());

const browser = await chromium.launch();
const erros = [];
const passo = (t) => console.log("✓", t);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
async function pagina(vp) {
  const p = await ctx.newPage();
  if (vp) await p.setViewportSize(vp);
  p.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  return p;
}
const shot = async (p, nome) => { await p.waitForTimeout(250); await p.screenshot({ path: `${SHOTS}/${nome}.png` }); };
const estado = (p) => p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("srv:state"); g.onsuccess = () => { r.result.close(); res(g.result); }; };
}));
const gravarEstado = (p, v) => p.evaluate((val) => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onsuccess = () => { const t = r.result.transaction("kv", "readwrite"); t.objectStore("kv").put(val, "srv:state"); t.oncomplete = () => { r.result.close(); res(); }; };
}), v);
async function entrar(p, email) {
  await p.goto(BASE + "#/entrar");
  await p.evaluate(() => localStorage.removeItem("inspeta:sessao")); // abas compartilham a sessão
  await p.reload();
  try { await p.getByLabel("E-mail").waitFor({ timeout: 5000 }); }
  catch (e) { await p.screenshot({ path: "/tmp/falha-login.png" }); console.log("URL na falha:", p.url(), "\nERROS:", erros.join("\n")); throw e; }
  await p.getByLabel("E-mail").fill(email);
  await p.getByLabel("Senha").fill("demo1234");
  await p.getByRole("button", { name: "Entrar" }).click();
}

// ================= 1. inspeção com 2 NCs ligadas a modelos diferentes =================
const cel = await pagina();
await entrar(cel, "ana@exemplo.com");
await cel.getByText("1 formulário disponível").waitFor();
await cel.getByRole("link", { name: /Nova inspeção/ }).click();
await cel.getByRole("link", { name: /Checklist FLV/ }).click();
await cel.getByRole("button", { name: /Loja 01 — Bosque/ }).click();
await cel.waitForURL(/aplicar/);
await cel.getByRole("radio", { name: /Não, encontrei vencidos/ }).click();
const q1 = cel.locator("fieldset.q").first();
await q1.locator('input[type="file"]').setInputFiles("/tmp/foto-teste.jpg");
await q1.locator(".ph img").waitFor();
await q1.getByLabel(/Observação/).fill("Requeijão vencido em 10/10.");
await cel.getByRole("radio", { name: "Sim", exact: true }).first().click();
await cel.getByRole("checkbox", { name: "Limpas" }).click();
await cel.getByRole("button", { name: "Próximo" }).click();
await cel.locator("input.numin").fill("2");
await cel.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-teste.jpg");
await cel.locator("fieldset.q").first().locator(".ph img").waitFor();
await cel.getByRole("radio", { name: "Não", exact: true }).click();
await cel.locator("fieldset.q").nth(2).locator("textarea").first().fill("Mola da porta solta.");
await cel.getByRole("button", { name: "Próximo" }).click();
await cel.getByRole("button", { name: "Coletar assinatura" }).click();
const bb = await cel.locator("canvas.sigpad").boundingBox();
await cel.mouse.move(bb.x + 30, bb.y + 60); await cel.mouse.down(); await cel.mouse.move(bb.x + 200, bb.y + 90); await cel.mouse.up();
await cel.getByRole("button", { name: "Salvar assinatura" }).click();
await cel.getByAltText("Assinatura coletada").waitFor();
await cel.getByRole("button", { name: "Revisar" }).click();
await cel.getByText("Tudo respondido").waitFor();
await cel.getByRole("button", { name: "Finalizar" }).click();
await cel.getByText("Enviada para o painel").waitFor({ timeout: 15000 });
passo("inspeção com 2 não conformidades finalizada e enviada (online)");

let s = await estado(cel);
const insp = s.inspecoes.find((i) => i.device_id !== "seed");
let planos = s.planos.filter((p) => p.inspecao_id === insp.id);
assert.equal(planos.length, 2, "dois planos: um por modelo");
const retirada = planos.find((p) => p.modelo_id === "pm-retirada");
const manut = planos.find((p) => p.modelo_id === "pm-manutencao");
assert.deepEqual(retirada.questao_keys, ["q-vencidos"]);
assert.equal(retirada.responsavel_email, "gerencia.lj01@exemplo.com", "destinatário = e-mail do avaliado");
assert.equal(manut.responsavel_email, "manutencao@exemplo.com", "destinatário fixo do modelo");
assert.notEqual(retirada.token_hash.length, 0);
assert.ok(!JSON.stringify(s).includes("#/p/" + retirada.token_hash), "o banco guarda só o hash do token");
passo("job pós-finalização criou 2 planos com destinatários certos; banco guarda só o hash do link");
const emails = s.emails;
assert.equal(emails.filter((e) => e.assunto.startsWith("Plano de ação")).length, 2);
assert.deepEqual(emails.filter((e) => e.assunto.startsWith("Relatório")).map((e) => e.para).sort(), ["gerencia.lj01@exemplo.com", "qualidade@exemplo.com"]);
passo("4 e-mails na fila: 2 planos + relatório para o avaliado e para qualidade@");

// ================= 2. reenvio não duplica planos nem e-mails =================
const antesPlanos = s.planos.length, antesEmails = s.emails.length;
await cel.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onsuccess = () => {
    const st = r.result.transaction("kv", "readwrite").objectStore("kv");
    const g = st.get("dev:m-ana");
    g.onsuccess = () => { const d = g.result; d.inspecoes.forEach((i) => { if (i.estado === "enviada") { i.estado = "na_fila"; } }); st.put(d, "dev:m-ana"); };
    st.transaction.oncomplete = () => { r.result.close(); res(); };
  };
}));
await cel.goto(BASE + "#/campo/sincronismo");
await cel.reload();
await cel.getByRole("button", { name: /Sincronizar agora/ }).click();
await cel.getByText(/inspeç(ão|ões) enviada/).waitFor({ timeout: 10000 });
s = await estado(cel);
assert.equal(s.planos.length, antesPlanos, "reenvio não criou plano repetido");
assert.equal(s.emails.length, antesEmails, "reenvio não mandou e-mail repetido");
passo("reenvio da inspeção não duplicou planos nem e-mails");

// ================= 3. gestor: caixa de saída e histórico de planos =================
const web = await pagina({ width: 1440, height: 900 });
await entrar(web, "rogerio@exemplo.com");
await web.waitForURL(/inspecoes/);
await web.goto(BASE + "#/web/emails");
await web.getByText("Plano de ação: Retirada e descarte — Loja 01 — Bosque").waitFor();
await shot(web, "emails-1440");
const linkRetirada = await web.locator("li", { hasText: "Plano de ação: Retirada e descarte" }).getByRole("link", { name: "Abrir link do plano" }).getAttribute("href");
const linkManutAntigo = await web.locator("li", { hasText: "Plano de ação: Manutenção corretiva" }).getByRole("link", { name: "Abrir link do plano" }).getAttribute("href");
assert.match(linkRetirada, /#\/p\/[0-9a-f]{48}$/);
passo("caixa de saída mostra os e-mails com o link do plano");

await web.goto(BASE + "#/web/planos");
await web.getByRole("cell", { name: "Retirada e descarte" }).waitFor();
assert.equal(await web.locator("tbody tr").count(), 2);
await web.getByText("2 abertos").waitFor();
await shot(web, "S24-1440");
passo("histórico de planos: 2 abertos");

// ================= 4. responsável responde pelo link, sem login =================
const resp = await pagina({ width: 390, height: 844 });
await resp.goto(linkRetirada);
await resp.getByText("Requeijão vencido em 10/10.", { exact: false }).waitFor();
await resp.getByRole("heading", { name: /^1\. A área de venda está livre de produtos vencidos\?/ }).waitFor();
await shot(resp, "S26-390");
await resp.getByRole("button", { name: "Enviar respostas" }).click();
await resp.getByText("Informe quem está respondendo.").waitFor();
await resp.getByText(/Responda esta pergunta e anexe uma foto/).waitFor();
passo("página pública barra o envio incompleto e mostra o que falta");
await resp.locator("fieldset.q").first().locator("textarea").fill("Retirados 6 potes e descartados. Gôndola conferida.");
await resp.locator("fieldset.q").first().locator('input[type="file"]').setInputFiles("/tmp/foto-teste.jpg");
await resp.locator("fieldset.q").first().locator(".ph img").waitFor();
await resp.getByRole("radio", { name: "Reposição fora do PVPS/FEFO" }).click();
await resp.locator("fieldset.q").nth(2).locator("textarea").fill("Marcos (repositor)");
await resp.getByLabel("Seu nome").fill("Júlia — gerente LJ01");
await resp.getByRole("button", { name: "Enviar respostas" }).click();
await resp.getByText("Respondido por").waitFor();
await resp.getByText("Reposição fora do PVPS/FEFO").waitFor();
await shot(resp, "S26-respondido-390");
passo("responsável respondeu com foto, sem login; a página vira somente leitura");

await web.reload();
await web.getByText("1 aberto ·", { exact: false }).waitFor();
await web.getByRole("row", { name: /Retirada e descarte/ }).getByText("Finalizado").waitFor();
passo("gestor vê o plano como finalizado");
await web.getByRole("row", { name: /Retirada e descarte/ }).getByRole("button", { name: "Loja 01 — Bosque" }).click();
await web.getByRole("dialog").getByText("Júlia — gerente LJ01", { exact: false }).waitFor();
await web.getByRole("dialog").getByAltText("Foto da correção").waitFor();
await shot(web, "S24-detalhe-1440");
await web.keyboard.press("Escape");
passo("detalhe do plano mostra respostas e foto da correção");

// ================= 5. novo link invalida o antigo; reenvio de e-mail =================
await web.getByRole("row", { name: /Manutenção corretiva/ }).getByRole("button").first().click();
const dlg = web.getByRole("dialog");
await dlg.getByRole("button", { name: "Gerar novo link" }).click();
const novoLink = await dlg.getByLabel("Link do plano").inputValue();
assert.notEqual(novoLink, linkManutAntigo);
await dlg.getByLabel("Reenviar por e-mail para").fill("chefe.manutencao@exemplo.com");
await dlg.getByRole("button", { name: "Reenviar" }).click();
await web.getByText(/E-mail reenviado para chefe.manutencao@exemplo.com/).waitFor();
await web.keyboard.press("Escape");
const velho = await pagina({ width: 390, height: 844 });
await velho.goto(linkManutAntigo);
await velho.getByText("Link indisponível").waitFor();
passo("gerar link novo invalida o anterior (link antigo mostra 'Link indisponível')");
s = await estado(web);
assert.ok(s.emails.some((e) => e.para === "chefe.manutencao@exemplo.com" && e.assunto.includes("Manutenção corretiva")));
passo("reenvio por e-mail entrou na caixa de saída");

// ================= 6. prazo vencido vira "em atraso" =================
s.planos.find((p) => p.modelo_id === "pm-manutencao" && p.inspecao_id === insp.id).prazo = "2026-10-01";
await gravarEstado(web, s);
await web.goto(BASE + "#/web/planos?situacao=em_atraso");
await web.getByRole("row", { name: /Manutenção corretiva/ }).getByText("Em atraso").waitFor();
assert.equal(await web.locator("tbody tr").count(), 1);
passo("plano com prazo vencido aparece como 'Em atraso' e o filtro funciona");

// ================= 7. detalhe da inspeção lista os planos =================
await web.goto(BASE + "#/web/inspecoes/" + insp.id);
await web.getByRole("link", { name: /Retirada e descarte.*Finalizado/ }).waitFor();
await web.getByRole("link", { name: /Manutenção corretiva.*Em atraso/ }).waitFor();
await web.getByText("Relatório enviado por e-mail (2)").waitFor();
passo("S12 mostra os dois planos com a situação e o envio do relatório no histórico");

// ================= 8. editor: ligação com plano e e-mail do relatório =================
await web.goto(BASE + "#/web/formularios/f-flv");
await web.locator("#q-q-porta").click();
assert.equal(await web.getByLabel("Quando não conforme, gerar plano de ação").inputValue(), "pm-manutencao");
passo("editor mostra a questão ligada ao modelo de plano");
await web.goto(BASE + "#/web/formularios/f-flv?aba=relatorio");
await web.getByLabel("Adicionar e-mail").fill("diretoria@");
await web.getByRole("button", { name: "Adicionar" }).click();
await web.getByText("Digite um e-mail completo.").waitFor();
await web.getByLabel("Adicionar e-mail").fill("diretoria@exemplo.com");
await web.getByRole("button", { name: "Adicionar" }).click();
await web.getByText("diretoria@exemplo.com").waitFor();
await shot(web, "S16-1440");
passo("aba Relatório valida e adiciona destinatários");
await web.goto(BASE + "#/web/planos/modelos/pm-retirada");
await web.getByLabel("Prazo para responder (dias)").fill("2");
await web.getByRole("button", { name: "Salvar" }).click();
await web.getByText(/Modelo salvo/).waitFor();
await shot(web, "S25-1440");
passo("editor de modelo de plano salva");

// ================= 9. importação de avaliados =================
await web.goto(BASE + "#/web/avaliados/importar");
await web.locator('input[type="file"]').setInputFiles(`${FIX}/avaliados-excel.xlsx`);
await web.getByText("5 linhas encontradas").waitFor();
assert.equal(await web.getByLabel("Campo para a coluna Loja").inputValue(), "nome");
assert.equal(await web.getByLabel("Campo para a coluna Cód. Filial").inputValue(), "codigo_externo");
assert.equal(await web.getByLabel("Campo para a coluna E-mail do gerente").inputValue(), "email");
assert.equal(await web.getByLabel("Campo para a coluna Endereço").inputValue(), "endereco");
assert.equal(await web.getByLabel("Campo para a coluna Observação interna").inputValue(), "");
passo("xlsx do Excel lido (textos compartilhados + rich text); colunas sugeridas pelo nome");
await web.getByText("2 novos").waitFor();
await web.getByText("1 atualizado").waitFor();
await web.getByText("2 com problema").waitFor();
await web.getByText("Linha 5: sem nome").waitFor();
await web.getByText(/Linha 6: código LJ05 repetido/).waitFor();
await shot(web, "S23-1440");
passo("prévia: 2 novos, 1 atualizado, 2 com problema (sem nome, código repetido)");
await web.getByRole("button", { name: "Importar 3 avaliados" }).click();
await web.getByText("Importação concluída").waitFor();
await web.getByRole("link", { name: "Ver avaliados" }).click();
await web.getByRole("cell", { name: "Loja 05 — Tucumã" }).waitFor();
await web.getByRole("cell", { name: "novo.gerente.lj01@exemplo.com" }).waitFor();
s = await estado(web);
assert.equal(s.avaliados.filter((a) => a.codigo_externo === "LJ01").length, 1, "LJ01 atualizado, não duplicado");
passo("importação criou 2 e atualizou o e-mail da LJ01 sem duplicar");

await web.goto(BASE + "#/web/avaliados/importar");
await web.locator('input[type="file"]').setInputFiles(`${FIX}/avaliados-win1252.csv`);
await web.getByText("Padaria São José").first().waitFor();
await web.getByText("Açougue Conceição").first().waitFor();
await web.getByText("2 novos").waitFor();
passo("CSV do Excel antigo (ponto e vírgula, Windows-1252) lido com acentos corretos");

await web.goto(BASE + "#/web/avaliados");
await web.getByRole("cell", { name: "Loja 05 — Tucumã" }).waitFor();
const [dl] = await Promise.all([web.waitForEvent("download"), web.getByRole("button", { name: "Exportar" }).click()]);
await dl.saveAs("/tmp/avaliados-export.csv");
const csv = fs.readFileSync("/tmp/avaliados-export.csv", "utf8");
assert.ok(csv.startsWith("﻿Nome;Código;CNPJ;E-mail"));
assert.ok(csv.includes("Loja 05 — Tucumã;LJ05"));
passo("exportação em CSV com cabeçalho e acentos");

// regressão: abrir o app numa aba nova já logado (redirecionamento inicial) não pode ficar em branco
const aba = await pagina({ width: 1440, height: 900 });
await aba.goto(BASE);
await aba.getByRole("heading", { name: "Inspeções", level: 1 }).waitFor({ timeout: 5000 });
passo("aba nova na raiz, já logado, cai direto em Inspeções (bug da tela em branco corrigido)");

console.log(erros.length ? "\nERROS NO CONSOLE:\n" + erros.join("\n") : "\nconsole sem erros");
await browser.close();
if (erros.length) process.exit(1);
