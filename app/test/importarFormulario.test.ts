import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateForm } from "@app/form-engine";
import { COLUNAS_MODELO, LINHAS_EXEMPLO, lerFormulario } from "../src/data/importarFormulario";

let n = 0;
const chave = () => "k" + ++n;

test("modelo de exemplo vira 3 tópicos e 6 questões válidas", () => {
  const r = lerFormulario([COLUNAS_MODELO, ...LINHAS_EXEMPLO], chave);
  assert.deepEqual(r.erros, []);
  assert.equal(r.topicos, 3);
  assert.equal(r.questoes, 6);
  const qs = r.definicao!.topicos.flatMap((t) => t.questoes);
  assert.equal(qs[0]!.opcoes!.length, 3); // Sim/Não/N/A
  assert.equal(qs[1]!.tipo, "escolha_multipla");
  assert.equal(qs[1]!.opcoes!.find((o) => o.texto === "Com avaria")!.conforme, false);
  assert.deepEqual(qs[2]!.numerica, { formato: "decimal", unidade: "°C", limite: { min: -2, max: 4, obs_obrigatoria: true } });
  assert.equal(qs[2]!.foto_obrigatoria, true);
  assert.equal(qs[4]!.obrigatoria, false);
  assert.equal(r.definicao!.topicos[0]!.titulo, "Área de venda"); // linha com tópico vazio herda o de cima
});

test("formulário importado roda no motor: nota e não conformidade", () => {
  const def = lerFormulario([COLUNAS_MODELO, ...LINHAS_EXEMPLO.slice(3, 4)], chave).definicao!;
  const q = def.topicos[0]!.questoes[0]!;
  const ruim = q.opcoes!.find((o) => o.texto === "Ruim")!;
  const ev = evaluateForm(def, { [q.key]: { opcoes: [ruim.key] } });
  assert.equal(ev.nota_pct, 0);
  assert.deepEqual(ev.nao_conformidades, [q.key]);
});

test("aceita colunas em outra ordem e sem acento; acusa erros por linha", () => {
  const cab = ["questao", "TIPO", "opcoes", "pontos", "nao conformes", "topico", "minimo", "maximo"];
  const r = lerFormulario([cab,
    ["Ok?", "sim/nao", "", "", "", "Geral", "", ""],
    ["Cor", "Escolha única", "Azul", "", "", "", "", ""],
    ["Peso", "Número", "", "", "", "", "10", "2"],
    ["Turno", "Escolha única", "Manhã; Tarde", "1; 2; 3", "", "", "", ""],
    ["Nota", "Estrelas", "", "", "", "", "", ""],
    ["Estado", "Escolha única", "Bom; Ruim", "", "Péssimo", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Temperatura", "Número", "", "", "", "", "-1,5", "4"],
  ], chave);
  assert.equal(r.questoes, 2);
  assert.deepEqual(r.erros.map((e) => e.linha), [3, 4, 5, 6, 7]);
  assert.match(r.erros[3]!.motivo, /Estrelas/);
  assert.equal(r.definicao!.topicos[0]!.questoes[1]!.numerica!.limite!.min, -1.5);
});

test("sem as colunas obrigatórias", () => {
  const r = lerFormulario([["Nome", "Descrição"], ["a", "b"]], chave);
  assert.equal(r.definicao, null);
  assert.equal(r.erros.length, 2);
});

test("todos os modelos prontos são válidos para o motor", async () => {
  const { MODELOS, definicaoDoModelo } = await import("../src/data/modelos");
  const { validateDefinition } = await import("@app/form-engine");
  for (const m of MODELOS) {
    const d = definicaoDoModelo(m.id);
    assert.deepEqual(validateDefinition(d), [], m.nome);
    assert.equal(d.topicos.flatMap((t) => t.questoes).length, m.linhas.length, m.nome);
  }
});
