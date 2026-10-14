import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateForm, validateDefinition, evaluateFormula, classify, type FormDefinition, type Question,
} from "../src/index";

const cls = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 59.99 },
  { nome: "Médio", cor: "rank-mid", min: 60, max: 79.99 },
  { nome: "Bom", cor: "rank-good", min: 80, max: 100 },
];

const simNao = (key: string, extra: Partial<Question> = {}): Question => ({
  key, titulo: key, tipo: "escolha_simples",
  opcoes: [
    { key: key + "_ok", texto: "Conforme", pontos: 10, conforme: true },
    { key: key + "_nc", texto: "Não conforme", pontos: 0, conforme: false },
    { key: key + "_na", texto: "N/A", na: true },
  ],
  ...extra,
});

const temp: Question = {
  key: "temp", titulo: "Temperatura", tipo: "numerica",
  numerica: {
    formato: "decimal", unidade: "°C",
    limite: { min: -2, max: 4, obs_obrigatoria: true },
    faixas_nota: [{ ate: 4, pontos: 10 }, { ate: 8, pontos: 5 }, { ate: null, pontos: 0 }],
  },
};

const base = (): FormDefinition => ({
  config: { calcular_nota: true, casas_decimais: 1, classificacoes: cls },
  topicos: [
    { key: "t1", titulo: "Área de venda", questoes: [simNao("q1"), simNao("q2"), temp] },
    { key: "t2", titulo: "Estoque", questoes: [simNao("q3")] },
  ],
});

test("nota: soma pontos / máximo das respondidas", () => {
  const r = evaluateForm(base(), {
    q1: { opcoes: ["q1_ok"] }, q2: { opcoes: ["q2_nc"] }, temp: { numero: 3 }, q3: { opcoes: ["q3_ok"] },
  });
  // 10 + 0 + 10 + 10 = 30 de 40
  assert.equal(r.pontos, 30);
  assert.equal(r.pontos_max, 40);
  assert.equal(r.nota_pct, 75);
  assert.equal(r.classificacao?.nome, "Médio");
  assert.deepEqual(r.nao_conformidades, ["q2"]);
});

test("N/A sai do numerador e do denominador", () => {
  const r = evaluateForm(base(), {
    q1: { opcoes: ["q1_ok"] }, q2: { opcoes: ["q2_na"] }, temp: { numero: 3 }, q3: { opcoes: ["q3_ok"] },
  });
  assert.equal(r.pontos_max, 30);
  assert.equal(r.nota_pct, 100);
  assert.equal(r.questoes.q2!.na, true);
  assert.equal(r.questoes.q2!.conforme, null);
});

test("não respondida não conta; sem respostas a nota é nula", () => {
  assert.equal(evaluateForm(base(), {}).nota_pct, null);
  const r = evaluateForm(base(), { q1: { opcoes: ["q1_ok"] } });
  assert.equal(r.nota_pct, 100);
  assert.equal(r.respondidas, 1);
  assert.equal(r.visiveis, 4);
});

test("faixa numérica: limite superior inclusivo nas fronteiras", () => {
  const at = (v: number) => evaluateForm(base(), { temp: { numero: v, observacao: "x" } }).questoes.temp!;
  assert.equal(at(4).pontos, 10);
  assert.equal(at(4.01).pontos, 5);
  assert.equal(at(8).pontos, 5);
  assert.equal(at(8.5).pontos, 0);
  assert.equal(at(4).conforme, true);
  assert.equal(at(-2).conforme, true);
  assert.equal(at(-2.1).conforme, false);
  assert.equal(at(4.01).conforme, false);
});

test("numérica fora do limite exige observação quando configurado", () => {
  const sem = evaluateForm(base(), { temp: { numero: 9 } });
  assert.deepEqual(sem.questoes.temp!.pendencias, [{ tipo: "observacao" }]);
  const com = evaluateForm(base(), { temp: { numero: 9, observacao: "porta aberta" } });
  assert.deepEqual(com.questoes.temp!.pendencias, []);
});

test("desconto de 100% no tópico zera só o tópico", () => {
  const def = base();
  def.topicos[0]!.questoes[0]!.opcoes![1]!.desconto = { pct: 100, escopo: "topico" };
  const r = evaluateForm(def, {
    q1: { opcoes: ["q1_nc"] }, q2: { opcoes: ["q2_ok"] }, temp: { numero: 3 }, q3: { opcoes: ["q3_ok"] },
  });
  assert.equal(r.topicos.t1!.pontos, 0);
  assert.equal(r.topicos.t1!.desconto_pct, 100);
  assert.equal(r.topicos.t2!.pontos, 10);
  assert.equal(r.nota_pct, 25); // 10 de 40
});

test("desconto de 50% no formulário se aplica ao total", () => {
  const def = base();
  def.topicos[1]!.questoes[0]!.opcoes![1]!.desconto = { pct: 50, escopo: "formulario" };
  const r = evaluateForm(def, {
    q1: { opcoes: ["q1_ok"] }, q2: { opcoes: ["q2_ok"] }, temp: { numero: 3 }, q3: { opcoes: ["q3_nc"] },
  });
  assert.equal(r.pontos, 15); // (30) * 0.5
  assert.equal(r.nota_pct, 37.5);
});

test("descontos se compõem", () => {
  const def = base();
  def.topicos[0]!.questoes[0]!.opcoes![1]!.desconto = { pct: 50, escopo: "topico" };
  def.topicos[0]!.questoes[1]!.opcoes![1]!.desconto = { pct: 50, escopo: "topico" };
  const r = evaluateForm(def, { q1: { opcoes: ["q1_nc"] }, q2: { opcoes: ["q2_nc"] }, temp: { numero: 3 } });
  assert.equal(r.topicos.t1!.desconto_pct, 75);
  assert.equal(r.topicos.t1!.pontos, 2.5);
});

test("escolha múltipla: soma das marcadas, máximo = soma das positivas, NC se alguma NC", () => {
  const def: FormDefinition = {
    config: {},
    topicos: [{ key: "t", titulo: "t", questoes: [{
      key: "m", titulo: "Itens", tipo: "escolha_multipla",
      opcoes: [
        { key: "a", texto: "Limpo", pontos: 5, conforme: true },
        { key: "b", texto: "Organizado", pontos: 5, conforme: true },
        { key: "c", texto: "Com praga", pontos: 0, conforme: false },
      ],
    }] }],
  };
  const r = evaluateForm(def, { m: { opcoes: ["a", "c"] } });
  assert.equal(r.questoes.m!.pontos, 5);
  assert.equal(r.questoes.m!.pontos_max, 10);
  assert.equal(r.questoes.m!.conforme, false);
});

test("obrigatória pendente bloqueia; escondida por dependência não", () => {
  const def = base();
  def.topicos[1]!.questoes.push({
    key: "q4", titulo: "Motivo", tipo: "texto", obrigatoria: true,
    depende_de: { questao: "q3", opcao: "q3_nc" },
  });
  def.topicos[0]!.questoes[0]!.obrigatoria = true;
  let r = evaluateForm(def, { q3: { opcoes: ["q3_ok"] } });
  assert.deepEqual(r.pendentes, ["q1"]);
  assert.equal(r.questoes.q4!.visivel, false);
  r = evaluateForm(def, { q1: { opcoes: ["q1_ok"] }, q3: { opcoes: ["q3_nc"] } });
  assert.deepEqual(r.pendentes, ["q4"]);
  assert.equal(r.questoes.q4!.visivel, true);
});

test("dependência entre tópicos e em cadeia", () => {
  const def = base();
  def.topicos[1]!.depende_de = { questao: "q1", opcao: "q1_nc" };
  let r = evaluateForm(def, { q1: { opcoes: ["q1_ok"] }, q3: { opcoes: ["q3_nc"] } });
  assert.equal(r.topicos.t2!.visivel, false);
  assert.equal(r.questoes.q3!.visivel, false);
  assert.deepEqual(r.nao_conformidades, []); // q3 escondida não conta
  r = evaluateForm(def, { q1: { opcoes: ["q1_nc"] }, q3: { opcoes: ["q3_nc"] } });
  assert.equal(r.topicos.t2!.visivel, true);
  assert.deepEqual(r.nao_conformidades, ["q1", "q3"]);
});

test("NC exige foto e observação conforme configurado", () => {
  const def = base();
  def.topicos[0]!.questoes[0]!.nc_exige = { foto: true, observacao: true };
  let r = evaluateForm(def, { q1: { opcoes: ["q1_nc"] } });
  assert.deepEqual(r.questoes.q1!.pendencias, [{ tipo: "foto" }, { tipo: "observacao" }]);
  r = evaluateForm(def, { q1: { opcoes: ["q1_nc"], fotos: 1, observacao: "vencido 10/10" } });
  assert.deepEqual(r.questoes.q1!.pendencias, []);
});

test("reincidência: anterior NC + atual NC", () => {
  const r = evaluateForm(base(), { q1: { opcoes: ["q1_nc"] }, q2: { opcoes: ["q2_nc"] } }, {
    q1: { conforme: false }, q2: { conforme: true },
  });
  assert.equal(r.questoes.q1!.reincidente, true);
  assert.equal(r.questoes.q2!.reincidente, false);
});

test("cálculo: fórmula com referências, valor_se_vazio e sem eval", () => {
  const def: FormDefinition = {
    config: {},
    topicos: [{ key: "t", titulo: "Pesagem", questoes: [
      { key: "bruto", titulo: "Peso bruto", tipo: "numerica", numerica: { formato: "decimal" } },
      { key: "tara", titulo: "Tara", tipo: "numerica", numerica: { formato: "decimal" } },
      { key: "liq", titulo: "Líquido", tipo: "calculo", calculo: { formula: "[1] - [2]", valor_se_vazio: 0 } },
      { key: "pct", titulo: "% perda", tipo: "calculo", calculo: { formula: "([2] / [1]) * 100" } },
    ] }],
  };
  let r = evaluateForm(def, { bruto: { numero: 12.5 }, tara: { numero: 0.5 } });
  assert.equal(r.questoes.liq!.valor_calculado, 12);
  assert.equal(r.questoes.pct!.valor_calculado, 4);
  r = evaluateForm(def, { bruto: { numero: 10 } });
  assert.equal(r.questoes.liq!.valor_calculado, 10); // tara vazia → 0
  assert.equal(r.questoes.pct!.valor_calculado, null); // sem fallback → vazio
  assert.equal(evaluateFormula("1/0", () => 0), null);
  assert.throws(() => evaluateFormula("process.exit()", () => 0));
  assert.throws(() => evaluateFormula("[1] + ", () => 1));
  assert.equal(evaluateFormula("2 x (3 + 1,5)", () => 0), 9);
});

test("classificação: fronteiras e sobreposição escolhe a faixa mais alta", () => {
  assert.equal(classify(cls, 59.99)?.nome, "Ruim");
  assert.equal(classify(cls, 60)?.nome, "Médio");
  assert.equal(classify(cls, 100)?.nome, "Bom");
  assert.equal(classify([{ nome: "A", cor: "x", min: 0, max: 80 }, { nome: "B", cor: "y", min: 80, max: 100 }], 80)?.nome, "B");
});

test("arredondamento respeita casas decimais", () => {
  const def = base();
  def.config.casas_decimais = 0;
  const r = evaluateForm(def, { q1: { opcoes: ["q1_ok"] }, q2: { opcoes: ["q2_ok"] }, q3: { opcoes: ["q3_nc"] } });
  assert.equal(r.nota_pct, 67); // 66,67
  def.config.casas_decimais = 2;
  assert.equal(evaluateForm(def, { q1: { opcoes: ["q1_ok"] }, q2: { opcoes: ["q2_ok"] }, q3: { opcoes: ["q3_nc"] } }).nota_pct, 66.67);
});

test("validação de publicação pega os erros que o editor permite salvar", () => {
  assert.deepEqual(validateDefinition(base()), []);
  const def = base();
  def.topicos[0]!.questoes[2]!.numerica!.faixas_nota = [{ ate: 8, pontos: 5 }, { ate: 4, pontos: 10 }];
  def.topicos[1]!.questoes.push({ key: "c", titulo: "Calc", tipo: "calculo", calculo: { formula: "[1] + [9]" } });
  def.topicos[1]!.questoes.push({ key: "d", titulo: "Dep", tipo: "texto", depende_de: { questao: "temp", opcao: "x" } });
  const probs = validateDefinition(def).map((i) => i.problema);
  assert.ok(probs.some((p) => p.includes("crescentes")));
  assert.ok(probs.some((p) => p.includes("[1], que não é numérica")));
  assert.ok(probs.some((p) => p.includes("[9], que não existe")));
  assert.ok(probs.some((p) => p.includes("só pode depender de questão de escolha")));
});

test("validação detecta dependência circular", () => {
  const def = base();
  def.topicos[0]!.questoes[0]!.depende_de = { questao: "q2", opcao: "q2_ok" };
  def.topicos[0]!.questoes[1]!.depende_de = { questao: "q1", opcao: "q1_ok" };
  assert.ok(validateDefinition(def).some((i) => i.problema === "dependência circular"));
  // e o motor não trava: as duas ficam escondidas
  const r = evaluateForm(def, {});
  assert.equal(r.questoes.q1!.visivel, false);
});

test("formulário sem cálculo de nota não gera nota", () => {
  const def = base();
  def.config.calcular_nota = false;
  const r = evaluateForm(def, { q1: { opcoes: ["q1_nc"] } });
  assert.equal(r.nota_pct, null);
  assert.deepEqual(r.nao_conformidades, ["q1"]); // NC continua valendo
});

test("validação: etapa de aprovação sem aprovador", () => {
  const def = { config: { aprovacao: { etapas: [{ aprovadores: ["m1"] }, { aprovadores: [] }] } }, topicos: [{ key: "t", titulo: "T", questoes: [{ key: "q", titulo: "Q", tipo: "texto" as const }] }] };
  const issues = validateDefinition(def);
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.onde, /etapa 2/);
});
