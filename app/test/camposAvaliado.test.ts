import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCampos, validarDefinicaoCampos } from "../src/data/camposAvaliado";
import type { CampoAvaliado } from "../src/data/types";

const reg: CampoAvaliado = { id: "reg", nome: "Regional", tipo: "lista", opcoes: ["Capital", "Interior"], obrigatorio: false, na_lista: true, ordem: 1 };
const cid: CampoAvaliado = { id: "cid", nome: "Cidade", tipo: "texto", obrigatorio: true, na_lista: false, depende_de: { campo_id: "reg", valor: "Interior" }, ordem: 2 };
const area: CampoAvaliado = { id: "area", nome: "Área (m²)", tipo: "numero", obrigatorio: false, na_lista: false, ordem: 3 };
const inaug: CampoAvaliado = { id: "inaug", nome: "Inauguração", tipo: "data", obrigatorio: false, na_lista: false, ordem: 4 };
const C = [reg, cid, area, inaug];

test("dependente só é exigido quando visível; escondido é descartado", () => {
  assert.deepEqual(validarCampos(C, { reg: "Capital", cid: "Xapuri" }), { valores: { reg: "Capital" }, erros: [] });
  assert.deepEqual(validarCampos(C, { reg: "Interior" }).erros, ["Cidade é obrigatório"]);
  assert.deepEqual(validarCampos(C, { reg: "interior", cid: " Xapuri " }), { valores: { reg: "Interior", cid: "Xapuri" }, erros: [] });
});

test("lista, número e data", () => {
  assert.match(validarCampos(C, { reg: "Norte" }).erros[0]!, /não está entre as opções/);
  assert.match(validarCampos(C, { area: "grande" }).erros[0]!, /não é um número/);
  assert.equal(validarCampos(C, { area: "1.250,5" }).erros.length, 0);
  assert.equal(validarCampos(C, { inaug: "15/03/2019" }).valores.inaug, "2019-03-15");
  assert.match(validarCampos(C, { inaug: "março" }).erros[0]!, /dd\/mm\/aaaa/);
});

test("definição: nome repetido, padrão, lista vazia, dependência inválida e circular", () => {
  assert.deepEqual(validarDefinicaoCampos(C), []);
  const ruins: CampoAvaliado[] = [
    { ...reg }, { ...reg, id: "r2" },
    { ...area, id: "x", nome: "E-mail" },
    { ...reg, id: "l", nome: "Bandeira", opcoes: ["Só uma"] },
    { ...cid, id: "d", nome: "Bairro", depende_de: { campo_id: "area", valor: "1" } },
    { ...reg, id: "a1", nome: "A", depende_de: { campo_id: "a2", valor: "Capital" } }, { ...reg, id: "a2", nome: "B", depende_de: { campo_id: "a1", valor: "Capital" } },
  ];
  const e = validarDefinicaoCampos(ruins).join(" | ");
  assert.match(e, /Já existe um campo chamado "Regional"/);
  assert.match(e, /"E-mail" já é um campo padrão/);
  assert.match(e, /Bandeira: a lista precisa/);
  assert.match(e, /Bairro: só pode depender de um campo do tipo lista/);
  assert.match(e, /circular/);
});
