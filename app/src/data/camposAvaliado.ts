// S22 — regras dos campos personalizados de avaliados. Puro: a tela usa para mostrar, o servidor para validar.
import type { CampoAvaliado, ID } from "./types";

export function campoVisivel(c: CampoAvaliado, valores: Record<ID, string>): boolean {
  return !c.depende_de || (valores[c.depende_de.campo_id] ?? "") === c.depende_de.valor;
}

/** Normaliza (tira o que ficou escondido ou vazio) e devolve os problemas encontrados. */
export function validarCampos(campos: CampoAvaliado[], entrada: Record<ID, string> = {}): { valores: Record<ID, string>; erros: string[] } {
  const ord = [...campos].sort((a, b) => a.ordem - b.ordem);
  const valores: Record<ID, string> = {};
  for (const c of ord) {
    let v = (entrada[c.id] ?? "").trim();
    // grafia da lista é corrigida antes das dependências ("interior" libera o que depende de "Interior")
    if (v && c.tipo === "lista") v = (c.opcoes ?? []).find((o) => o.localeCompare(v, "pt-BR", { sensitivity: "base" }) === 0) ?? v;
    if (v) valores[c.id] = v;
  }
  const erros: string[] = [];
  // dependências em cadeia: repete até estabilizar (campo escondido some, e quem dependia dele também)
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const c of ord) if (valores[c.id] !== undefined && !campoVisivel(c, valores)) { delete valores[c.id]; mudou = true; }
  }
  for (const c of ord) {
    if (!campoVisivel(c, valores)) continue;
    const v = valores[c.id];
    if (!v) { if (c.obrigatorio) erros.push(`${c.nome} é obrigatório`); continue; }
    if (c.tipo === "lista" && !(c.opcoes ?? []).includes(v)) {
      erros.push(`${c.nome}: "${v}" não está entre as opções (${(c.opcoes ?? []).join(", ")})`);
    }
    if (c.tipo === "numero" && !Number.isFinite(Number(v.replace(/\./g, "").replace(",", ".")))) erros.push(`${c.nome}: "${v}" não é um número`);
    if (c.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
      if (m) valores[c.id] = `${m[3]}-${m[2]}-${m[1]}`; else erros.push(`${c.nome}: use a data como dd/mm/aaaa`);
    }
  }
  return { valores, erros };
}

/** Problemas na definição dos campos (nome repetido, lista sem opções, dependência inválida ou circular). */
export function validarDefinicaoCampos(campos: CampoAvaliado[]): string[] {
  const erros: string[] = [];
  const nomes = new Set<string>();
  for (const c of campos) {
    const n = c.nome.trim().toLowerCase();
    if (!n) erros.push("Há um campo sem nome.");
    else if (nomes.has(n)) erros.push(`Já existe um campo chamado "${c.nome}".`);
    nomes.add(n);
    if (["nome", "código", "codigo", "cnpj", "e-mail", "email", "telefone", "endereço", "endereco"].includes(n)) erros.push(`"${c.nome}" já é um campo padrão do cadastro.`);
    if (c.tipo === "lista" && (c.opcoes ?? []).filter((o) => o.trim()).length < 2) erros.push(`${c.nome}: a lista precisa de pelo menos 2 opções.`);
    if (c.depende_de) {
      const alvo = campos.find((x) => x.id === c.depende_de!.campo_id);
      if (!alvo || alvo.tipo !== "lista") erros.push(`${c.nome}: só pode depender de um campo do tipo lista.`);
      else if (!(alvo.opcoes ?? []).includes(c.depende_de.valor)) erros.push(`${c.nome}: "${c.depende_de.valor}" não é opção de ${alvo.nome}.`);
      // ciclo
      const vistos = new Set<ID>([c.id]);
      let cur = alvo;
      while (cur?.depende_de) {
        if (vistos.has(cur.id)) { erros.push(`${c.nome}: dependência circular.`); break; }
        vistos.add(cur.id);
        cur = campos.find((x) => x.id === cur!.depende_de!.campo_id);
        if (cur && vistos.has(cur.id)) { erros.push(`${c.nome}: dependência circular.`); break; }
      }
    }
  }
  return [...new Set(erros)];
}
