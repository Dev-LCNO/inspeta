// Segurança da API real (rodar com o backend local no ar: scripts/test-backend.sh tests/api-seguranca.mjs).
// Cada pessoa só vê e só faz o que a função e os acessos dela permitem; outra empresa não vê nada.
import assert from "node:assert/strict";

const B = process.env.BACKEND ?? "http://localhost:54321";
const passo = (t) => console.log("✓", t);
async function token(email) {
  const r = await fetch(`${B}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "demo1234" }) });
  return (await r.json()).access_token;
}
async function rpc(tk, metodo, args = []) {
  const r = await fetch(`${B}/functions/v1/api`, { method: "POST", headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ metodo, args }) });
  return { status: r.status, ...(await r.json()) };
}

const semToken = await rpc(null, "listarInspecoes", [{}, {}]);
assert.equal(semToken.status, 401);
const falso = await rpc("token-inventado", "listarInspecoes", [{}, {}]);
assert.equal(falso.status, 401);
passo("sem login ou com token falso: 401");

const rog = await token("rogerio@exemplo.com"), ana = await token("ana@exemplo.com");
const todas = (await rpc(rog, "listarInspecoes", [{}, {}])).valor;
assert.equal(todas.length, 2);
const daAna = todas.find((i) => i.responsavel_id === "m-ana"), doRog = todas.find((i) => i.responsavel_id === "m-rogerio");

const eu = (await rpc(rog, "eu")).valor.membro;
const vistasAna = (await rpc(ana, "listarInspecoes", [eu, {}])).valor; // manda o "quem" do dono de propósito
assert.deepEqual(vistasAna.map((i) => i.id), [daAna.id]);
passo("aplicadora que se passa pelo dono no argumento continua vendo só a própria inspeção");

for (const [m, args] of [["obterInspecao", [eu, doRog.id]], ["eventos", [doRog.id]], ["planosDaInspecao", [doRog.id]], ["aprovacaoDaInspecao", [doRog.id]]]) {
  const r = await rpc(ana, m, args);
  assert.equal(r.ok, false, m);
}
passo("leitura de inspeção alheia (detalhe, histórico, planos, aprovação) é negada");

for (const [m, args] of [["criarFormulario", ["Hack"]], ["painel", [eu, { de: "2026-01-01", ate: "2026-12-31" }]], ["caixaDeSaida", []], ["convidarPessoa", [eu, { nome: "X", email: "x@x.com", funcao_id: "fn-admin" }]],
  ["salvarPessoa", [eu, "m-ana", { funcao_id: "fn-admin" }]], ["gerarDadosDemo", [eu]], ["salvarCamposAvaliado", [eu, []]], ["decidir", [eu, daAna.id, "aprovada", ""]]]) {
  const r = await rpc(ana, m, args);
  assert.equal(r.status, 403, `${m} deveria ser 403 e foi ${r.status} (${r.erro})`);
}
passo("aplicadora não cria formulário, não vê painel nem e-mails, não convida nem se promove a administradora (403)");

const desconhecido = await rpc(rog, "_reset");
assert.equal(desconhecido.status, 404);
const sessao = await rpc(rog, "entrar", ["a", "b"]);
assert.equal(sessao.status, 404);
passo("métodos internos ou só do navegador (_reset, entrar) não existem na API");

// outra empresa
await fetch(`${B}/__dev/org`, { method: "POST", body: JSON.stringify({ nome: "Outra Empresa", email: "dona@outra.com" }) });
const dona = await token("dona@outra.com");
const euDona = (await rpc(dona, "eu")).valor;
assert.equal(euDona.org.nome, "Outra Empresa");
assert.equal((await rpc(dona, "listarInspecoes", [euDona.membro, {}])).valor.length, 0);
assert.equal((await rpc(dona, "listarFormularios")).valor.length, 0);
assert.equal((await rpc(dona, "listarAvaliados")).valor.length, 0);
assert.equal((await rpc(dona, "obterInspecao", [euDona.membro, doRog.id])).ok, false);
assert.equal((await rpc(dona, "anexo", ["qualquer"])).ok, false);
passo("outra empresa: não vê inspeções, formulários, avaliados nem anexos da primeira");

// corrida: o mesmo envio duas vezes ao mesmo tempo não duplica
const pac = (await rpc(ana, "pacote", ["m-ana"])).valor;
const f = pac.formularios[0];
const envio = { client_uuid: crypto.randomUUID(), formulario_id: f.formulario_id, formulario_versao_id: f.versao.id, avaliado_id: "a-centro", status: "rascunho",
  iniciada_em: new Date().toISOString(), finalizada_em: null, respostas: {}, anexos: [], device_id: "teste" };
const [r1, r2] = await Promise.all([rpc(ana, "enviarInspecoes", ["m-ana", [envio]]), rpc(ana, "enviarInspecoes", ["m-ana", [envio]])]);
assert.ok(r1.ok && r2.ok);
assert.equal(r1.valor[0].id, r2.valor[0].id);
const est = await (await fetch(`${B}/__dev/estado`)).json();
assert.equal(est.inspecoes.filter((i) => i.client_uuid === envio.client_uuid).length, 1);
passo("dois envios simultâneos da mesma inspeção viram uma só (trava por organização)");

// o envio feito em nome de outra pessoa é ignorado: o responsável é sempre quem está logado
const e2 = { ...envio, client_uuid: crypto.randomUUID() };
const r3 = await rpc(ana, "enviarInspecoes", ["m-rogerio", [e2]]);
const est2 = await (await fetch(`${B}/__dev/estado`)).json();
assert.equal(est2.inspecoes.find((i) => i.id === r3.valor[0].id).responsavel_id, "m-ana");
passo("não dá para enviar inspeção em nome de outra pessoa");

const plano = await rpc(null, "planoPorToken", ["token-que-nao-existe"]);
assert.equal(plano.status, 404);
passo("link público com token errado: 404, sem detalhe");
console.log("\nAPI segura nos cenários testados");
