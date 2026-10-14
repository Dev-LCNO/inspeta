import { test } from "node:test";
import assert from "node:assert/strict";
import { datasDaRegra, descreverRegra, instantesDaRegra, limiteDaOcorrencia, localParaUTC, situacaoOcorrencia, validarRegra } from "../src/data/agenda";
import type { RegraAgenda } from "../src/data/types";

const base: RegraAgenda = { data_inicio: "2026-10-15", horarios: ["08:00"], dia_inteiro: false, fuso_horario: "America/Rio_Branco", recorrencia: "nenhuma", termino: "nunca" };

test("fuso: 08:00 em Rio Branco (UTC−5) e em São Paulo (UTC−3)", () => {
  assert.equal(localParaUTC("2026-10-15", "08:00", "America/Rio_Branco"), "2026-10-15T13:00:00.000Z");
  assert.equal(localParaUTC("2026-10-15", "08:00", "America/Sao_Paulo"), "2026-10-15T11:00:00.000Z");
  assert.equal(localParaUTC("2026-10-15", "22:30", "America/Rio_Branco"), "2026-10-16T03:30:00.000Z"); // vira o dia em UTC
});

test("fuso com horário de verão (Nova York, troca em 01/11/2026)", () => {
  assert.equal(localParaUTC("2026-10-31", "09:00", "America/New_York"), "2026-10-31T13:00:00.000Z");
  assert.equal(localParaUTC("2026-11-02", "09:00", "America/New_York"), "2026-11-02T14:00:00.000Z");
});

test("uma vez", () => {
  assert.deepEqual(datasDaRegra(base, "2026-10-01", "2026-12-31"), ["2026-10-15"]);
  assert.deepEqual(datasDaRegra(base, "2026-10-16", "2026-12-31"), []);
});

test("diária com término por quantidade conta desde o início, não desde a janela", () => {
  const r = { ...base, recorrencia: "diaria" as const, termino: "quantidade" as const, termino_qtd: 5 };
  assert.deepEqual(datasDaRegra(r, "2026-10-01", "2026-12-31"), ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"]);
  assert.deepEqual(datasDaRegra(r, "2026-10-18", "2026-12-31"), ["2026-10-18", "2026-10-19"]);
});

test("semanal segunda e quinta até uma data", () => {
  const r = { ...base, recorrencia: "semanal" as const, dias_semana: [1, 4], termino: "data" as const, termino_data: "2026-10-29" };
  // 15/10/2026 é quinta
  assert.deepEqual(datasDaRegra(r, "2026-10-01", "2026-12-31"), ["2026-10-15", "2026-10-19", "2026-10-22", "2026-10-26", "2026-10-29"]);
});

test("mensal no dia 31 cai no último dia dos meses curtos", () => {
  const r = { ...base, data_inicio: "2026-01-31", recorrencia: "mensal" as const };
  assert.deepEqual(datasDaRegra(r, "2026-01-01", "2026-05-31"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
});

test("vários horários e dia inteiro", () => {
  const r = { ...base, horarios: ["14:00", "08:00", "14:00"], recorrencia: "diaria" as const, termino: "quantidade" as const, termino_qtd: 2 };
  assert.deepEqual(instantesDaRegra(r, "2026-10-01", "2026-10-31"), [
    "2026-10-15T13:00:00.000Z", "2026-10-15T19:00:00.000Z", "2026-10-16T13:00:00.000Z", "2026-10-16T19:00:00.000Z",
  ]);
  assert.deepEqual(instantesDaRegra({ ...base, dia_inteiro: true, horarios: [] }, "2026-10-01", "2026-10-31"), ["2026-10-15T13:00:00.000Z"]);
});

test("atrasada: 2 h depois do horário, ou o fim do dia local quando é o dia inteiro", () => {
  const o = { status: "pendente" as const, previsto_em: "2026-10-15T13:00:00.000Z" };
  assert.equal(situacaoOcorrencia(o, base, Date.parse("2026-10-15T14:59:00Z")), "pendente");
  assert.equal(situacaoOcorrencia(o, base, Date.parse("2026-10-15T15:01:00Z")), "atrasada");
  const di = { ...base, dia_inteiro: true };
  assert.equal(limiteDaOcorrencia(o.previsto_em, di), "2026-10-16T05:00:00.000Z"); // meia-noite seguinte em Rio Branco
  assert.equal(situacaoOcorrencia(o, di, Date.parse("2026-10-16T04:00:00Z")), "pendente");
  assert.equal(situacaoOcorrencia({ ...o, status: "completa" }, base, Date.parse("2027-01-01")), "completa");
});

test("descrição em português", () => {
  assert.equal(descreverRegra(base), "Uma vez, em 15/10/2026, às 08:00");
  assert.equal(descreverRegra({ ...base, dia_inteiro: true }), "Uma vez, em 15/10/2026, o dia inteiro");
  assert.equal(descreverRegra({ ...base, recorrencia: "diaria", dia_inteiro: true }), "Todo dia, o dia inteiro, a partir de 15/10/2026");
  assert.equal(descreverRegra({ ...base, recorrencia: "semanal", dias_semana: [4, 1], horarios: ["14:00", "08:00"], termino: "data", termino_data: "2026-11-30" }),
    "Toda segunda e quinta às 08:00 e 14:00, a partir de 15/10/2026 até 30/11/2026");
  assert.equal(descreverRegra({ ...base, recorrencia: "semanal", dias_semana: [1, 2, 3, 4, 5] }), "De segunda a sexta às 08:00, a partir de 15/10/2026");
  assert.equal(descreverRegra({ ...base, recorrencia: "semanal", dias_semana: [6] }), "Todo sábado às 08:00, a partir de 15/10/2026");
  assert.equal(descreverRegra({ ...base, recorrencia: "mensal", dia_inteiro: true, termino: "quantidade", termino_qtd: 6 }), "Todo mês no dia 15, o dia inteiro, a partir de 15/10/2026, 6 vezes");
});

test("validação", () => {
  assert.deepEqual(validarRegra(base), []);
  assert.equal(validarRegra({ ...base, horarios: [] }).length, 1);
  assert.equal(validarRegra({ ...base, recorrencia: "semanal", dias_semana: [] }).length, 1);
  assert.equal(validarRegra({ ...base, termino: "data", termino_data: "2026-10-01" }).length, 1);
  assert.equal(validarRegra({ ...base, horarios: ["25:00"] }).length, 1);
});
