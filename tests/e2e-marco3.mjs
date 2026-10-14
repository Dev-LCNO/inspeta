// Marco 3: funções (S31), permissões de pessoas e equipes (S30) e o efeito delas
// no app de campo e na visibilidade das inspeções.
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Rio_Branco" });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
async function pagina(vp) {
  const p = await ctx.newPage();
  if (vp) await p.setViewportSize(vp);
  p.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  return p;
}
const shot = async (p, nome) => { await p.waitForTimeout(250); await p.screenshot({ path: `${SHOTS}/${nome}.png` }); };
const estado = (p) => lerEstado(p);
async function entrar(p, email, { espera = true } = {}) {
  await p.goto(BASE + "#/entrar");
  await p.evaluate(() => localStorage.removeItem("inspeta:sessao"));
  await p.reload();
  await p.getByLabel("E-mail").waitFor();
  await p.getByLabel("E-mail").fill(email);
  await p.getByLabel("Senha").fill("demo1234");
  await p.getByRole("button", { name: "Entrar" }).click();
  if (espera) await p.waitForURL(/#\/(web|campo)/);
}

// ================= limpa tudo =================
const adm = await pagina();
await adm.goto(BASE);
await adm.evaluate(() => new Promise((res) => { localStorage.clear(); const r = indexedDB.deleteDatabase("inspeta"); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
await entrar(adm, "rogerio@exemplo.com");

// ================= S31 funções =================
await adm.getByRole("link", { name: "Funções" }).click();
await adm.getByRole("table").waitFor();
assert.equal(await adm.getByRole("checkbox", { name: "Administrador: Gerenciar pessoas e permissões" }).isDisabled(), true);
assert.equal(await adm.getByRole("checkbox", { name: "Administrador: Aplicar inspeções" }).isChecked(), true);
assert.equal(await adm.getByRole("checkbox", { name: "Aplicador: Ver todas as inspeções" }).isChecked(), false);
await shot(adm, "S31");
passo("S31: matriz de ações × funções; Administrador travado com tudo marcado");

await adm.getByRole("button", { name: "Nova função" }).click();
await adm.getByRole("dialog").getByRole("textbox", { name: /Nome/ }).fill("Aplicador");
await adm.getByRole("dialog").getByRole("button", { name: "Criar" }).click();
await adm.getByText("Já existe uma função com esse nome.").waitFor();
await adm.getByRole("dialog").getByRole("textbox", { name: /Nome/ }).fill("Auditor externo");
await adm.getByRole("dialog").getByLabel("Começar com as ações de").selectOption({ label: "Aplicador" });
await adm.getByRole("dialog").getByRole("button", { name: "Criar" }).click();
await adm.getByRole("checkbox", { name: "Auditor externo: Ver painel de indicadores" }).click();
await adm.waitForFunction(() => true);
await adm.waitForTimeout(400);
let s = await estado(adm);
const auditor = s.funcoes.find((f) => f.nome === "Auditor externo");
assert.deepEqual([...auditor.acoes].sort(), ["aplicar", "ver_painel"]);
passo("nova função copiando as ações de outra; nome repetido barrado; marcação salva na hora");

// ================= S30 pessoas =================
await adm.getByRole("link", { name: "Permissões" }).click();
await adm.locator("table a.rowlink").first().waitFor();
assert.equal(await adm.locator("table a.rowlink").count(), 3);
await shot(adm, "S30");
await adm.getByRole("button", { name: "Convidar pessoa" }).click();
const dlg = adm.getByRole("dialog");
await dlg.getByLabel("Nome").fill("Bruna Teixeira");
await dlg.getByLabel("E-mail").fill("ana@exemplo.com");
await dlg.getByLabel("Função").selectOption({ label: "Auditor externo" });
await dlg.getByRole("button", { name: "Enviar convite" }).click();
await dlg.getByText("Já existe uma pessoa com esse e-mail.").waitFor();
await dlg.getByLabel("E-mail").fill("bruna@exemplo.com");
await dlg.getByRole("button", { name: "Enviar convite" }).click();
await adm.waitForURL(/permissoes\/pessoas\//);
await adm.getByRole("heading", { name: "Bruna Teixeira" }).waitFor();
assert.equal((await adm.getByTestId("ef-form").textContent()).trim(), "Nenhum");
s = await estado(adm);
const bruna = s.membros.find((m) => m.email === "bruna@exemplo.com");
assert.ok(s.emails.some((e) => e.idem_key === `convite:${bruna.id}` && e.para === "bruna@exemplo.com"));
passo("convite: e-mail repetido barrado; pessoa criada sem formulários; e-mail de convite na fila");

await adm.getByRole("group", { name: "Formulários que aplica" }).getByRole("checkbox", { name: /Checklist FLV/ }).check();
const grpAv = adm.getByRole("group", { name: "Avaliados" });
await grpAv.getByRole("switch", { name: "Todos os avaliados" }).uncheck();
await grpAv.getByRole("checkbox", { name: /Loja 02 — Centro/ }).check();
await adm.getByText("Alterações não salvas").waitFor();
await adm.getByRole("button", { name: "Salvar" }).click();
await adm.getByText("Permissões salvas.").waitFor();
assert.equal((await adm.getByTestId("ef-form").textContent()).trim(), "Checklist FLV e perecíveis");
await shot(adm, "S30-pessoa");
passo("acesso da Bruna: 1 formulário e só a Loja 02; resumo do acesso efetivo atualizado");

// ================= efeito no app de campo =================
// (todas as abas do mesmo navegador dividem a sessão, então troca-se de pessoa na mesma aba)
const cel = adm;
await cel.setViewportSize({ width: 390, height: 844 });
await entrar(cel, "bruna@exemplo.com");
await cel.getByText("1 formulário disponível").waitFor();
await cel.getByRole("link", { name: /Nova inspeção/ }).click();
await cel.getByRole("link", { name: /Checklist FLV/ }).click();
await cel.getByRole("button", { name: /Loja 02 — Centro/ }).waitFor();
assert.equal(await cel.getByRole("button", { name: /Loja 01 — Bosque/ }).count(), 0);
passo("app de campo da Bruna: só o formulário liberado e só a Loja 02 (o formulário vale para Loja 01 e 02)");

// ================= equipes e visibilidade =================
await adm.setViewportSize({ width: 1440, height: 900 });
await entrar(adm, "carlos@exemplo.com");
await adm.goto(BASE + "#/web/inspecoes");
await adm.locator("table a.rowlink").first().waitFor();
assert.equal(await adm.locator("table a.rowlink").count(), 1, "Carlos vê só a inspeção da Ana (equipe que acompanha)");
assert.equal(await adm.getByRole("link", { name: "Permissões" }).count(), 0);
passo("supervisor vê as inspeções da equipe que acompanha (1 da Ana), não as do admin, e não vê o menu de permissões");

await entrar(adm, "rogerio@exemplo.com");
await adm.goto(BASE + "#/web/permissoes?aba=equipes");
await adm.getByRole("link", { name: "Equipe de lojas" }).click();
await adm.getByTestId("acompanham").filter({ hasText: "Carlos Eduardo Lima" }).waitFor();
const membrosEq = adm.getByRole("group", { name: "Pessoas na equipe" });
await membrosEq.getByRole("checkbox", { name: /Ana Paula Souza/ }).uncheck();
await membrosEq.getByRole("checkbox", { name: /Bruna Teixeira/ }).check();
await adm.getByRole("button", { name: "Salvar" }).click();
await adm.getByText("Equipe salva.").waitFor();
await shot(adm, "S30-equipe");

// ================= regras =================
await adm.goto(BASE + "#/web/funcoes");
await adm.getByRole("button", { name: "Renomear ou excluir Auditor externo" }).click();
await adm.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
await adm.getByText(/Há 1 pessoa com esta função/).waitFor();
await adm.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
passo("função em uso não pode ser excluída");

await adm.goto(BASE + "#/web/permissoes/pessoas/m-rogerio");
await adm.getByRole("heading", { name: "Rogério Marinho" }).waitFor();
assert.equal(await adm.getByLabel("Função").isDisabled(), true);
assert.equal(await adm.getByRole("button", { name: "Desativar" }).count(), 0);
passo("dono da conta: função travada e sem opção de desativar");

await adm.goto(BASE + "#/web/permissoes/pessoas/" + bruna.id);
await adm.getByRole("button", { name: "Desativar" }).click();
await adm.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
await adm.getByText("Acesso de Bruna Teixeira desativado.").waitFor();

await entrar(adm, "carlos@exemplo.com");
await adm.goto(BASE + "#/web/inspecoes");
await adm.getByText(/Nenhuma inspeção/).first().waitFor();
assert.equal(await adm.locator("table a.rowlink").count(), 0);
passo("tirar a Ana da equipe some com a inspeção dela para o supervisor");

// sessão gravada de quem foi desativado não vale mais
await adm.evaluate((id) => localStorage.setItem("inspeta:sessao", id), bruna.id);
await adm.goto(BASE + "#/campo");
await adm.reload();
await adm.waitForURL(/#\/entrar/);
await entrar(adm, "bruna@exemplo.com", { espera: false });
await adm.getByText(/Este acesso foi desativado/).waitFor();
passo("desativar derruba a sessão da Bruna e bloqueia o login");

await entrar(adm, "ana@exemplo.com");
await adm.goto(BASE + "#/web/permissoes");
await adm.getByText("Você não tem acesso a esta área").waitFor();
passo("aplicadora não acessa Permissões nem por URL");

await entrar(adm, "rogerio@exemplo.com");
// mobile da tela de funções
await adm.setViewportSize({ width: 390, height: 844 });
await adm.goto(BASE + "#/web/funcoes");
await adm.getByRole("table").waitFor();
const larg = await adm.evaluate(() => document.documentElement.scrollWidth);
assert.ok(larg <= 390, `página rola na horizontal (${larg}px)`);
passo("S31 em 390px: a tabela rola dentro do quadro, a página não");

await browser.close();
const reais = erros.filter((e) => !/Failed to load resource/.test(e));
if (reais.length) { console.log("ERROS NO CONSOLE:\n" + reais.join("\n")); process.exit(1); }
console.log("\nconsole sem erros");
