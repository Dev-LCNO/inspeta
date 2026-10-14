import { evaluate as evalFormula, FormulaError, references } from "./formula";
import type {
  Answer, Answers, Classificacao, Evaluation, FormDefinition, Option, Pendencia,
  Previous, Question, QuestionResult, Topic, TopicResult,
} from "./types";

// ---------------------------------------------------------------------------
// Regras (decisões do clone, documentadas em replica/build-log.md):
// 1. Nota = Σ pontos obtidos ÷ Σ pontos máximos das questões VISÍVEIS e RESPONDIDAS × 100.
//    "Não se aplica" e questões não respondidas saem do numerador e do denominador.
//    Quem precisa que uma questão conte deve marcá-la como obrigatória.
// 2. Escolha simples: pontos da opção; máximo = maior pontuação entre opções que não são N/A.
//    Escolha múltipla: soma das marcadas; máximo = soma das opções com pontos positivos.
//    Numérica: pontos da primeira faixa cujo `ate` (inclusivo) comporta o valor.
// 3. Desconto: cada opção marcada com desconto multiplica o fator do tópico ou do
//    formulário por (1 − pct/100). 100% zera. Descontos se compõem.
// 4. Conformidade: escolha → a regra da opção (qualquer opção NC marcada = NC);
//    numérica → dentro/fora do limite. Sem regra → null.
// 5. Questão escondida por dependência nunca é obrigatória e não pontua.
// ---------------------------------------------------------------------------

export function round(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.sign(v) * Math.round(Math.abs(v) * f + Number.EPSILON) / f;
}

export interface Indexed {
  questions: Map<string, { q: Question; topic: Topic; numero: number }>;
  byNumber: Map<number, Question>;
  topics: Map<string, Topic>;
  options: Map<string, { option: Option; question: Question }>;
}

export function index(def: FormDefinition): Indexed {
  const questions = new Map<string, { q: Question; topic: Topic; numero: number }>();
  const byNumber = new Map<number, Question>();
  const topics = new Map<string, Topic>();
  const options = new Map<string, { option: Option; question: Question }>();
  let n = 0;
  for (const t of def.topicos) {
    topics.set(t.key, t);
    for (const q of t.questoes) {
      n++;
      questions.set(q.key, { q, topic: t, numero: n });
      byNumber.set(n, q);
      for (const o of q.opcoes ?? []) options.set(o.key, { option: o, question: q });
    }
  }
  return { questions, byNumber, topics, options };
}

function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.na) return true;
  switch (q.tipo) {
    case "escolha_simples":
    case "escolha_multipla":
      return (a.opcoes?.length ?? 0) > 0;
    case "numerica":
      return typeof a.numero === "number" && Number.isFinite(a.numero);
    case "texto":
      return (a.texto ?? "").trim().length > 0;
    case "data_hora":
      return !!a.data;
    case "assinatura":
      return !!a.assinatura;
    case "calculo":
      return true; // calculada, nunca "pendente"
  }
}

function selected(q: Question, a: Answer | undefined): Option[] {
  if (!a?.opcoes?.length) return [];
  const keys = new Set(a.opcoes);
  return (q.opcoes ?? []).filter((o) => keys.has(o.key));
}

function faixaPontos(q: Question, v: number): number | null {
  const faixas = q.numerica?.faixas_nota;
  if (!faixas?.length) return null;
  for (const f of faixas) if (f.ate === null || v <= f.ate) return f.pontos;
  return faixas[faixas.length - 1]!.pontos;
}

function maxPontos(q: Question): number | null {
  switch (q.tipo) {
    case "escolha_simples": {
      const ps = (q.opcoes ?? []).filter((o) => !o.na && typeof o.pontos === "number").map((o) => o.pontos!);
      return ps.length ? Math.max(...ps) : null;
    }
    case "escolha_multipla": {
      const ps = (q.opcoes ?? []).filter((o) => !o.na && typeof o.pontos === "number").map((o) => o.pontos!);
      return ps.length ? ps.filter((p) => p > 0).reduce((s, p) => s + p, 0) : null;
    }
    case "numerica": {
      const fs = q.numerica?.faixas_nota;
      return fs?.length ? Math.max(...fs.map((f) => f.pontos)) : null;
    }
    default:
      return null;
  }
}

export function insideLimit(q: Question, v: number): boolean | null {
  const lim = q.numerica?.limite;
  if (!lim || (lim.min == null && lim.max == null)) return null;
  if (lim.min != null && v < lim.min) return false;
  if (lim.max != null && v > lim.max) return false;
  return true;
}

export function visibility(def: FormDefinition, answers: Answers, idx = index(def)): Set<string> {
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();

  const depOk = (dep: { questao: string; opcao: string } | undefined): boolean => {
    if (!dep) return true;
    if (!questionVisible(dep.questao)) return false;
    return (answers[dep.questao]?.opcoes ?? []).includes(dep.opcao);
  };
  const topicVisible = (key: string): boolean => {
    const id = "t:" + key;
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return false; // ciclo = escondido (validate() impede publicar)
    visiting.add(id);
    const v = depOk(idx.topics.get(key)?.depende_de);
    visiting.delete(id);
    memo.set(id, v);
    return v;
  };
  function questionVisible(key: string): boolean {
    const id = "q:" + key;
    if (memo.has(id)) return memo.get(id)!;
    const entry = idx.questions.get(key);
    if (!entry) return false;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const v = topicVisible(entry.topic.key) && depOk(entry.q.depende_de);
    visiting.delete(id);
    memo.set(id, v);
    return v;
  }
  const out = new Set<string>();
  for (const t of def.topicos) if (topicVisible(t.key)) out.add(t.key);
  for (const key of idx.questions.keys()) if (questionVisible(key)) out.add(key);
  return out;
}

export function evaluateForm(def: FormDefinition, answers: Answers, previous: Previous = {}): Evaluation {
  const idx = index(def);
  const vis = visibility(def, answers, idx);
  const casas = def.config.casas_decimais ?? 1;

  // valores das questões de cálculo (com proteção contra ciclos)
  const calcMemo = new Map<string, number | null>();
  const calcStack = new Set<string>();
  const numericValue = (n: number): number | null => {
    const q = idx.byNumber.get(n);
    if (!q || !vis.has(q.key)) return null;
    if (q.tipo === "numerica") {
      const v = answers[q.key]?.numero;
      return typeof v === "number" && !answers[q.key]?.na ? v : null;
    }
    if (q.tipo === "calculo") return calcValue(q);
    return null;
  };
  function calcValue(q: Question): number | null {
    if (calcMemo.has(q.key)) return calcMemo.get(q.key)!;
    if (calcStack.has(q.key) || !q.calculo?.formula) return null;
    calcStack.add(q.key);
    let v: number | null = null;
    const fallback = q.calculo.valor_se_vazio;
    try {
      v = evalFormula(q.calculo.formula, (n) => {
        const x = numericValue(n);
        return x === null && fallback != null ? fallback : x;
      });
    } catch {
      v = null;
    }
    calcStack.delete(q.key);
    calcMemo.set(q.key, v);
    return v;
  }

  const questoes: Record<string, QuestionResult> = {};
  const topicos: Record<string, TopicResult> = {};
  let formFactor = 1;
  let totalObtido = 0;
  let totalMax = 0;
  const ncs: string[] = [];
  const pendentes: string[] = [];
  let respondidas = 0;
  let visiveis = 0;

  for (const t of def.topicos) {
    let tPontos = 0;
    let tMax = 0;
    let tFactor = 1;

    for (const q of t.questoes) {
      const a = answers[q.key];
      const numero = idx.questions.get(q.key)!.numero;
      const visivel = vis.has(q.key);
      const res: QuestionResult = {
        key: q.key, numero, visivel, respondida: false, na: false,
        pontos: null, pontos_max: null, conforme: null, pendencias: [], reincidente: false,
      };
      questoes[q.key] = res;
      if (!visivel) continue;
      if (q.tipo !== "calculo") visiveis++;

      res.respondida = isAnswered(q, a);
      if (q.tipo !== "calculo" && res.respondida) respondidas++;
      const sel = selected(q, a);
      res.na = !!a?.na || (sel.length > 0 && sel.every((o) => o.na));

      if (q.tipo === "calculo") res.valor_calculado = calcValue(q);

      // pontuação e conformidade
      if (res.respondida && !res.na) {
        if (q.tipo === "escolha_simples" || q.tipo === "escolha_multipla") {
          const scored = sel.filter((o) => !o.na);
          const max = maxPontos(q);
          if (max !== null) {
            res.pontos_max = max;
            res.pontos = scored.reduce((s, o) => s + (o.pontos ?? 0), 0);
          }
          if (scored.some((o) => o.conforme === false)) res.conforme = false;
          else if (scored.some((o) => o.conforme === true)) res.conforme = true;
          for (const o of scored) {
            if (o.desconto && o.desconto.pct > 0) {
              const f = 1 - Math.min(100, o.desconto.pct) / 100;
              if (o.desconto.escopo === "formulario") formFactor *= f;
              else tFactor *= f;
            }
          }
        } else if (q.tipo === "numerica") {
          const v = a!.numero!;
          const p = faixaPontos(q, v);
          if (p !== null) { res.pontos = p; res.pontos_max = maxPontos(q); }
          res.conforme = insideLimit(q, v);
        }
      }

      if (res.pontos !== null && res.pontos_max !== null) {
        tPontos += res.pontos;
        tMax += res.pontos_max;
      }

      // pendências (bloqueiam finalizar)
      const pend: Pendencia[] = [];
      if (q.obrigatoria && !res.respondida && q.tipo !== "calculo") pend.push({ tipo: "obrigatoria" });
      if (res.respondida && !res.na) {
        const fotos = a?.fotos ?? 0;
        const obs = (a?.observacao ?? "").trim().length > 0;
        if (q.foto_obrigatoria && fotos < 1) pend.push({ tipo: "foto" });
        if (res.conforme === false) {
          if (q.nc_exige?.foto && fotos < 1 && !pend.some((p) => p.tipo === "foto")) pend.push({ tipo: "foto" });
          if (q.nc_exige?.observacao && !obs) pend.push({ tipo: "observacao" });
          if (q.tipo === "numerica" && q.numerica?.limite?.obs_obrigatoria && !obs && !pend.some((p) => p.tipo === "observacao"))
            pend.push({ tipo: "observacao" });
        }
      }
      res.pendencias = pend;
      if (pend.length) pendentes.push(q.key);
      if (res.conforme === false) {
        ncs.push(q.key);
        if (previous[q.key]?.conforme === false) res.reincidente = true;
      }
    }

    const tv = vis.has(t.key);
    const obtido = tPontos * tFactor;
    topicos[t.key] = {
      key: t.key, visivel: tv, pontos: obtido, pontos_max: tMax,
      desconto_pct: round((1 - tFactor) * 100, 2),
      pct: tMax > 0 ? round((obtido / tMax) * 100, casas) : null,
    };
    totalObtido += obtido;
    totalMax += tMax;
  }

  const obtidoFinal = totalObtido * formFactor;
  const calcular = def.config.calcular_nota !== false;
  const nota = calcular && totalMax > 0 ? round((obtidoFinal / totalMax) * 100, casas) : null;

  return {
    questoes, topicos,
    pontos: round(obtidoFinal, 2), pontos_max: round(totalMax, 2),
    nota_pct: nota,
    classificacao: nota === null ? null : classify(def.config.classificacoes ?? [], nota),
    nao_conformidades: ncs, pendentes, respondidas, visiveis,
  };
}

export function classify(cls: Classificacao[], pct: number): Classificacao | null {
  const hits = cls.filter((c) => pct >= c.min && pct <= c.max);
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.min > a.min ? b : a));
}

// ---------------------------------------------------------------------------
// Validação para PUBLICAR (o editor salva rascunhos inválidos; publicar não).
// ---------------------------------------------------------------------------

export interface DefinitionIssue { onde: string; problema: string }

export function validateDefinition(def: FormDefinition): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const idx = index(def);
  const seen = new Set<string>();
  const dup = (k: string, onde: string) => {
    if (seen.has(k)) issues.push({ onde, problema: `chave duplicada ${k}` });
    seen.add(k);
  };

  if (!def.topicos.length) issues.push({ onde: "formulário", problema: "precisa de pelo menos um tópico" });
  let total = 0;

  for (const t of def.topicos) {
    dup(t.key, `tópico "${t.titulo}"`);
    if (!t.titulo.trim()) issues.push({ onde: "tópico", problema: "tópico sem título" });
    if (!t.questoes.length) issues.push({ onde: `tópico "${t.titulo}"`, problema: "tópico sem questões" });
    checkDep(t.depende_de, `tópico "${t.titulo}"`);

    for (const q of t.questoes) {
      total++;
      const onde = `questão ${idx.questions.get(q.key)!.numero} "${q.titulo || "sem título"}"`;
      dup(q.key, onde);
      if (!q.titulo.trim()) issues.push({ onde, problema: "sem título" });
      checkDep(q.depende_de, onde);

      if (q.tipo === "escolha_simples" || q.tipo === "escolha_multipla") {
        const ops = q.opcoes ?? [];
        if (ops.length < 2) issues.push({ onde, problema: "precisa de pelo menos 2 opções" });
        for (const o of ops) {
          dup(o.key, onde);
          if (!o.texto.trim()) issues.push({ onde, problema: "opção sem texto" });
          if (o.desconto && (o.desconto.pct < 0 || o.desconto.pct > 100))
            issues.push({ onde, problema: "desconto deve estar entre 0 e 100%" });
        }
      }
      if (q.tipo === "numerica") {
        const fs = q.numerica?.faixas_nota ?? [];
        let last = -Infinity;
        fs.forEach((f, i) => {
          if (f.ate === null && i !== fs.length - 1) issues.push({ onde, problema: "só a última faixa pode ser \"acima\"" });
          if (f.ate !== null) {
            if (f.ate <= last) issues.push({ onde, problema: "faixas de nota precisam ser crescentes e não podem se cruzar" });
            last = f.ate;
          }
        });
        const lim = q.numerica?.limite;
        if (lim?.min != null && lim?.max != null && lim.min > lim.max)
          issues.push({ onde, problema: "limite mínimo maior que o máximo" });
      }
      if (q.tipo === "calculo") {
        try {
          const refs = references(q.calculo?.formula ?? "");
          if (!refs.length && !(q.calculo?.formula ?? "").trim()) issues.push({ onde, problema: "fórmula vazia" });
          for (const n of refs) {
            const target = idx.byNumber.get(n);
            if (!target) issues.push({ onde, problema: `a fórmula usa [${n}], que não existe` });
            else if (target.tipo !== "numerica" && target.tipo !== "calculo")
              issues.push({ onde, problema: `a fórmula usa [${n}], que não é numérica` });
            else if (target.key === q.key) issues.push({ onde, problema: "a fórmula se refere a ela mesma" });
          }
        } catch (e) {
          issues.push({ onde, problema: e instanceof FormulaError ? `fórmula: ${e.message}` : "fórmula inválida" });
        }
      }
    }
  }
  if (total === 0 && def.topicos.length) issues.push({ onde: "formulário", problema: "nenhuma questão" });

  // ciclos de dependência
  const edges = new Map<string, string>();
  for (const [k, { q, topic }] of idx.questions) {
    if (q.depende_de) edges.set(k, q.depende_de.questao);
    if (topic.depende_de) edges.set("t:" + topic.key, topic.depende_de.questao);
  }
  const parentOf = (k: string): string[] => {
    const out: string[] = [];
    const e = edges.get(k); if (e) out.push(e);
    const t = idx.questions.get(k)?.topic;
    if (t?.depende_de) out.push(t.depende_de.questao);
    return out;
  };
  for (const start of idx.questions.keys()) {
    const stack = [...parentOf(start)];
    const seenC = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === start) {
        issues.push({ onde: `questão ${idx.questions.get(start)!.numero}`, problema: "dependência circular" });
        break;
      }
      if (seenC.has(cur)) continue;
      seenC.add(cur);
      stack.push(...parentOf(cur));
    }
  }
  return issues;

  function checkDep(dep: { questao: string; opcao: string } | undefined, onde: string) {
    if (!dep) return;
    const target = idx.questions.get(dep.questao)?.q;
    if (!target) return issues.push({ onde, problema: "depende de uma questão que não existe" });
    if (target.tipo !== "escolha_simples" && target.tipo !== "escolha_multipla")
      return issues.push({ onde, problema: "só pode depender de questão de escolha" });
    if (!(target.opcoes ?? []).some((o) => o.key === dep.opcao))
      issues.push({ onde, problema: "depende de uma opção que não existe" });
  }
}
