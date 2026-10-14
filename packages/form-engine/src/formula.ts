// Avaliador seguro de fórmulas de cálculo: números, + - * /, parênteses e [n]
// (n = número global da questão). Sem eval, sem funções, sem variáveis.

type Tok =
  | { t: "num"; v: number }
  | { t: "ref"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

export class FormulaError extends Error {}

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "[") {
      const end = src.indexOf("]", i);
      if (end < 0) throw new FormulaError("colchete sem fechar");
      const n = Number(src.slice(i + 1, end).trim());
      if (!Number.isInteger(n) || n < 1) throw new FormulaError(`referência inválida: ${src.slice(i, end + 1)}`);
      out.push({ t: "ref", v: n });
      i = end + 1;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.,]/.test(src[j]!)) j++;
      const raw = src.slice(i, j).replace(",", ".");
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new FormulaError(`número inválido: ${raw}`);
      out.push({ t: "num", v });
      i = j;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "x" || c === "×") { out.push({ t: "op", v: "*" }); i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    throw new FormulaError(`caractere não permitido: "${c}"`);
  }
  return out;
}

/** Retorna os números de questão referenciados. */
export function references(src: string): number[] {
  return tokenize(src).filter((t): t is { t: "ref"; v: number } => t.t === "ref").map((t) => t.v);
}

/** Avalia. `resolve(n)` devolve o valor da questão n ou null se vazia. */
export function evaluate(src: string, resolve: (n: number) => number | null): number | null {
  const toks = tokenize(src);
  let p = 0;
  let missing = false;

  const peek = () => toks[p];
  function primary(): number {
    const t = toks[p++];
    if (!t) throw new FormulaError("fórmula incompleta");
    if (t.t === "num") return t.v;
    if (t.t === "ref") {
      const v = resolve(t.v);
      if (v === null || v === undefined || !Number.isFinite(v)) { missing = true; return 0; }
      return v;
    }
    if (t.t === "op" && t.v === "-") return -primary();
    if (t.t === "lp") {
      const v = expr();
      const r = toks[p++];
      if (!r || r.t !== "rp") throw new FormulaError("parêntese sem fechar");
      return v;
    }
    throw new FormulaError("termo inesperado");
  }
  function term(): number {
    let v = primary();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        p++;
        const r = primary();
        v = t.v === "*" ? v * r : v / r;
      } else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        p++;
        const r = term();
        v = t.v === "+" ? v + r : v - r;
      } else return v;
    }
  }
  const v = expr();
  if (p !== toks.length) throw new FormulaError("sobrou texto depois da fórmula");
  if (missing) return null;
  if (!Number.isFinite(v)) return null; // divisão por zero
  return v;
}
