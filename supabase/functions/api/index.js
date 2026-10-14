// backend/funcao-api.ts
import postgres from "npm:postgres@3.4.5";

// app/src/data/acesso.ts
var SEM_FUNCAO = { id: "", nome: "Sem função", acoes: [] };
function unir(a, b) {
  if (a === "todos" || b === "todos")
    return "todos";
  return [.../* @__PURE__ */ new Set([...a, ...b])];
}
function resolverMembros(regs, funcoes, equipes) {
  let membrosDa = (eqIds) => equipes.filter((e) => eqIds.includes(e.id)).flatMap((e) => e.membros);
  return regs.map((r) => {
    let f = funcoes.find((x) => x.id === r.funcao_id) ?? SEM_FUNCAO, minhas = equipes.filter((e) => e.membros.includes(r.id)), acessos = [r.acesso, ...minhas.map((e) => e.acesso)], formularios = acessos.reduce((acc, a) => unir(acc, a.formularios), []), avaliados = acessos.reduce((acc, a) => unir(acc, a.avaliados), []), ve = /* @__PURE__ */ new Set;
    for (let a of acessos) {
      for (let id of a.ver_membros)
        ve.add(id);
      for (let id of membrosDa(a.ver_equipes))
        ve.add(id);
    }
    return ve.delete(r.id), {
      id: r.id,
      org_id: r.org_id,
      nome: r.nome,
      email: r.email,
      funcao_id: f.id,
      funcao: f.nome,
      acoes: r.is_master ? [.../* @__PURE__ */ new Set([...f.acoes])] : [...f.acoes],
      is_master: r.is_master,
      ativo: r.ativo,
      equipes: minhas.map((e) => e.id),
      formularios_permitidos: formularios,
      avaliados_permitidos: avaliados,
      ve_inspecoes_de: [...ve]
    };
  });
}
var ACESSO_PESSOA_NOVA = { formularios: [], avaliados: "todos", ver_membros: [], ver_equipes: [] }, ACESSO_EQUIPE_NOVA = { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] };
// packages/form-engine/src/formula.ts
class FormulaError extends Error {
}
function tokenize(src) {
  let out = [], i = 0;
  while (i < src.length) {
    let c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "[") {
      let end = src.indexOf("]", i);
      if (end < 0)
        throw new FormulaError("colchete sem fechar");
      let n = Number(src.slice(i + 1, end).trim());
      if (!Number.isInteger(n) || n < 1)
        throw new FormulaError(`referência inválida: ${src.slice(i, end + 1)}`);
      out.push({ t: "ref", v: n }), i = end + 1;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.,]/.test(src[j]))
        j++;
      let raw = src.slice(i, j).replace(",", "."), v = Number(raw);
      if (!Number.isFinite(v))
        throw new FormulaError(`número inválido: ${raw}`);
      out.push({ t: "num", v }), i = j;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ t: "op", v: c }), i++;
      continue;
    }
    if (c === "x" || c === "×") {
      out.push({ t: "op", v: "*" }), i++;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lp" }), i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rp" }), i++;
      continue;
    }
    throw new FormulaError(`caractere não permitido: "${c}"`);
  }
  return out;
}
function references(src) {
  return tokenize(src).filter((t) => t.t === "ref").map((t) => t.v);
}
function evaluate(src, resolve) {
  let toks = tokenize(src), p = 0, missing = !1, peek = () => toks[p];
  function primary() {
    let t = toks[p++];
    if (!t)
      throw new FormulaError("fórmula incompleta");
    if (t.t === "num")
      return t.v;
    if (t.t === "ref") {
      let v = resolve(t.v);
      if (v === null || v === void 0 || !Number.isFinite(v))
        return missing = !0, 0;
      return v;
    }
    if (t.t === "op" && t.v === "-")
      return -primary();
    if (t.t === "lp") {
      let v = expr(), r = toks[p++];
      if (!r || r.t !== "rp")
        throw new FormulaError("parêntese sem fechar");
      return v;
    }
    throw new FormulaError("termo inesperado");
  }
  function term() {
    let v = primary();
    for (;; ) {
      let t = peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        p++;
        let r = primary();
        v = t.v === "*" ? v * r : v / r;
      } else
        return v;
    }
  }
  function expr() {
    let v = term();
    for (;; ) {
      let t = peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        p++;
        let r = term();
        v = t.v === "+" ? v + r : v - r;
      } else
        return v;
    }
  }
  let v = expr();
  if (p !== toks.length)
    throw new FormulaError("sobrou texto depois da fórmula");
  if (missing)
    return null;
  if (!Number.isFinite(v))
    return null;
  return v;
}

// packages/form-engine/src/engine.ts
function round(v, casas) {
  let f = 10 ** casas;
  return Math.sign(v) * Math.round(Math.abs(v) * f + Number.EPSILON) / f;
}
function index(def) {
  let questions = /* @__PURE__ */ new Map, byNumber = /* @__PURE__ */ new Map, topics = /* @__PURE__ */ new Map, options = /* @__PURE__ */ new Map, n = 0;
  for (let t of def.topicos) {
    topics.set(t.key, t);
    for (let q of t.questoes) {
      n++, questions.set(q.key, { q, topic: t, numero: n }), byNumber.set(n, q);
      for (let o of q.opcoes ?? [])
        options.set(o.key, { option: o, question: q });
    }
  }
  return { questions, byNumber, topics, options };
}
function isAnswered(q, a) {
  if (!a)
    return !1;
  if (a.na)
    return !0;
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
      return !0;
  }
}
function selected(q, a) {
  if (!a?.opcoes?.length)
    return [];
  let keys = new Set(a.opcoes);
  return (q.opcoes ?? []).filter((o) => keys.has(o.key));
}
function faixaPontos(q, v) {
  let faixas = q.numerica?.faixas_nota;
  if (!faixas?.length)
    return null;
  for (let f of faixas)
    if (f.ate === null || v <= f.ate)
      return f.pontos;
  return faixas[faixas.length - 1].pontos;
}
function maxPontos(q) {
  switch (q.tipo) {
    case "escolha_simples": {
      let ps = (q.opcoes ?? []).filter((o) => !o.na && typeof o.pontos === "number").map((o) => o.pontos);
      return ps.length ? Math.max(...ps) : null;
    }
    case "escolha_multipla": {
      let ps = (q.opcoes ?? []).filter((o) => !o.na && typeof o.pontos === "number").map((o) => o.pontos);
      return ps.length ? ps.filter((p) => p > 0).reduce((s, p) => s + p, 0) : null;
    }
    case "numerica": {
      let fs = q.numerica?.faixas_nota;
      return fs?.length ? Math.max(...fs.map((f) => f.pontos)) : null;
    }
    default:
      return null;
  }
}
function insideLimit(q, v) {
  let lim = q.numerica?.limite;
  if (!lim || lim.min == null && lim.max == null)
    return null;
  if (lim.min != null && v < lim.min)
    return !1;
  if (lim.max != null && v > lim.max)
    return !1;
  return !0;
}
function visibility(def, answers, idx = index(def)) {
  let memo = /* @__PURE__ */ new Map, visiting = /* @__PURE__ */ new Set, depOk = (dep) => {
    if (!dep)
      return !0;
    if (!questionVisible(dep.questao))
      return !1;
    return (answers[dep.questao]?.opcoes ?? []).includes(dep.opcao);
  }, topicVisible = (key) => {
    let id = "t:" + key;
    if (memo.has(id))
      return memo.get(id);
    if (visiting.has(id))
      return !1;
    visiting.add(id);
    let v = depOk(idx.topics.get(key)?.depende_de);
    return visiting.delete(id), memo.set(id, v), v;
  };
  function questionVisible(key) {
    let id = "q:" + key;
    if (memo.has(id))
      return memo.get(id);
    let entry = idx.questions.get(key);
    if (!entry)
      return !1;
    if (visiting.has(id))
      return !1;
    visiting.add(id);
    let v = topicVisible(entry.topic.key) && depOk(entry.q.depende_de);
    return visiting.delete(id), memo.set(id, v), v;
  }
  let out = /* @__PURE__ */ new Set;
  for (let t of def.topicos)
    if (topicVisible(t.key))
      out.add(t.key);
  for (let key of idx.questions.keys())
    if (questionVisible(key))
      out.add(key);
  return out;
}
function evaluateForm(def, answers, previous = {}) {
  let idx = index(def), vis = visibility(def, answers, idx), casas = def.config.casas_decimais ?? 1, calcMemo = /* @__PURE__ */ new Map, calcStack = /* @__PURE__ */ new Set, numericValue = (n) => {
    let q = idx.byNumber.get(n);
    if (!q || !vis.has(q.key))
      return null;
    if (q.tipo === "numerica") {
      let v = answers[q.key]?.numero;
      return typeof v === "number" && !answers[q.key]?.na ? v : null;
    }
    if (q.tipo === "calculo")
      return calcValue(q);
    return null;
  };
  function calcValue(q) {
    if (calcMemo.has(q.key))
      return calcMemo.get(q.key);
    if (calcStack.has(q.key) || !q.calculo?.formula)
      return null;
    calcStack.add(q.key);
    let v = null, fallback = q.calculo.valor_se_vazio;
    try {
      v = evaluate(q.calculo.formula, (n) => {
        let x = numericValue(n);
        return x === null && fallback != null ? fallback : x;
      });
    } catch {
      v = null;
    }
    return calcStack.delete(q.key), calcMemo.set(q.key, v), v;
  }
  let questoes = {}, topicos = {}, formFactor = 1, totalObtido = 0, totalMax = 0, ncs = [], pendentes = [], respondidas = 0, visiveis = 0;
  for (let t of def.topicos) {
    let tPontos = 0, tMax = 0, tFactor = 1;
    for (let q of t.questoes) {
      let a = answers[q.key], numero = idx.questions.get(q.key).numero, visivel = vis.has(q.key), res = {
        key: q.key,
        numero,
        visivel,
        respondida: !1,
        na: !1,
        pontos: null,
        pontos_max: null,
        conforme: null,
        pendencias: [],
        reincidente: !1
      };
      if (questoes[q.key] = res, !visivel)
        continue;
      if (q.tipo !== "calculo")
        visiveis++;
      if (res.respondida = isAnswered(q, a), q.tipo !== "calculo" && res.respondida)
        respondidas++;
      let sel = selected(q, a);
      if (res.na = !!a?.na || sel.length > 0 && sel.every((o) => o.na), q.tipo === "calculo")
        res.valor_calculado = calcValue(q);
      if (res.respondida && !res.na) {
        if (q.tipo === "escolha_simples" || q.tipo === "escolha_multipla") {
          let scored = sel.filter((o) => !o.na), max = maxPontos(q);
          if (max !== null)
            res.pontos_max = max, res.pontos = scored.reduce((s, o) => s + (o.pontos ?? 0), 0);
          if (scored.some((o) => o.conforme === !1))
            res.conforme = !1;
          else if (scored.some((o) => o.conforme === !0))
            res.conforme = !0;
          for (let o of scored)
            if (o.desconto && o.desconto.pct > 0) {
              let f = 1 - Math.min(100, o.desconto.pct) / 100;
              if (o.desconto.escopo === "formulario")
                formFactor *= f;
              else
                tFactor *= f;
            }
        } else if (q.tipo === "numerica") {
          let v = a.numero, p = faixaPontos(q, v);
          if (p !== null)
            res.pontos = p, res.pontos_max = maxPontos(q);
          res.conforme = insideLimit(q, v);
        }
      }
      if (res.pontos !== null && res.pontos_max !== null)
        tPontos += res.pontos, tMax += res.pontos_max;
      let pend = [];
      if (q.obrigatoria && !res.respondida && q.tipo !== "calculo")
        pend.push({ tipo: "obrigatoria" });
      if (res.respondida && !res.na) {
        let fotos = a?.fotos ?? 0, obs = (a?.observacao ?? "").trim().length > 0;
        if (q.foto_obrigatoria && fotos < 1)
          pend.push({ tipo: "foto" });
        if (res.conforme === !1) {
          if (q.nc_exige?.foto && fotos < 1 && !pend.some((p) => p.tipo === "foto"))
            pend.push({ tipo: "foto" });
          if (q.nc_exige?.observacao && !obs)
            pend.push({ tipo: "observacao" });
          if (q.tipo === "numerica" && q.numerica?.limite?.obs_obrigatoria && !obs && !pend.some((p) => p.tipo === "observacao"))
            pend.push({ tipo: "observacao" });
        }
      }
      if (res.pendencias = pend, pend.length)
        pendentes.push(q.key);
      if (res.conforme === !1) {
        if (ncs.push(q.key), previous[q.key]?.conforme === !1)
          res.reincidente = !0;
      }
    }
    let tv = vis.has(t.key), obtido = tPontos * tFactor;
    topicos[t.key] = {
      key: t.key,
      visivel: tv,
      pontos: obtido,
      pontos_max: tMax,
      desconto_pct: round((1 - tFactor) * 100, 2),
      pct: tMax > 0 ? round(obtido / tMax * 100, casas) : null
    }, totalObtido += obtido, totalMax += tMax;
  }
  let obtidoFinal = totalObtido * formFactor, nota = def.config.calcular_nota !== !1 && totalMax > 0 ? round(obtidoFinal / totalMax * 100, casas) : null;
  return {
    questoes,
    topicos,
    pontos: round(obtidoFinal, 2),
    pontos_max: round(totalMax, 2),
    nota_pct: nota,
    classificacao: nota === null ? null : classify(def.config.classificacoes ?? [], nota),
    nao_conformidades: ncs,
    pendentes,
    respondidas,
    visiveis
  };
}
function classify(cls, pct) {
  let hits = cls.filter((c) => pct >= c.min && pct <= c.max);
  if (!hits.length)
    return null;
  return hits.reduce((a, b) => b.min > a.min ? b : a);
}
function validateDefinition(def) {
  let issues = [], idx = index(def), seen = /* @__PURE__ */ new Set, dup = (k, onde) => {
    if (seen.has(k))
      issues.push({ onde, problema: `chave duplicada ${k}` });
    seen.add(k);
  };
  if (!def.topicos.length)
    issues.push({ onde: "formulário", problema: "precisa de pelo menos um tópico" });
  let total = 0;
  for (let t of def.topicos) {
    if (dup(t.key, `tópico "${t.titulo}"`), !t.titulo.trim())
      issues.push({ onde: "tópico", problema: "tópico sem título" });
    if (!t.questoes.length)
      issues.push({ onde: `tópico "${t.titulo}"`, problema: "tópico sem questões" });
    checkDep(t.depende_de, `tópico "${t.titulo}"`);
    for (let q of t.questoes) {
      total++;
      let onde = `questão ${idx.questions.get(q.key).numero} "${q.titulo || "sem título"}"`;
      if (dup(q.key, onde), !q.titulo.trim())
        issues.push({ onde, problema: "sem título" });
      if (checkDep(q.depende_de, onde), q.tipo === "escolha_simples" || q.tipo === "escolha_multipla") {
        let ops = q.opcoes ?? [];
        if (ops.length < 2)
          issues.push({ onde, problema: "precisa de pelo menos 2 opções" });
        for (let o of ops) {
          if (dup(o.key, onde), !o.texto.trim())
            issues.push({ onde, problema: "opção sem texto" });
          if (o.desconto && (o.desconto.pct < 0 || o.desconto.pct > 100))
            issues.push({ onde, problema: "desconto deve estar entre 0 e 100%" });
        }
      }
      if (q.tipo === "numerica") {
        let fs = q.numerica?.faixas_nota ?? [], last = -1 / 0;
        fs.forEach((f, i) => {
          if (f.ate === null && i !== fs.length - 1)
            issues.push({ onde, problema: 'só a última faixa pode ser "acima"' });
          if (f.ate !== null) {
            if (f.ate <= last)
              issues.push({ onde, problema: "faixas de nota precisam ser crescentes e não podem se cruzar" });
            last = f.ate;
          }
        });
        let lim = q.numerica?.limite;
        if (lim?.min != null && lim?.max != null && lim.min > lim.max)
          issues.push({ onde, problema: "limite mínimo maior que o máximo" });
      }
      if (q.tipo === "calculo")
        try {
          let refs = references(q.calculo?.formula ?? "");
          if (!refs.length && !(q.calculo?.formula ?? "").trim())
            issues.push({ onde, problema: "fórmula vazia" });
          for (let n of refs) {
            let target = idx.byNumber.get(n);
            if (!target)
              issues.push({ onde, problema: `a fórmula usa [${n}], que não existe` });
            else if (target.tipo !== "numerica" && target.tipo !== "calculo")
              issues.push({ onde, problema: `a fórmula usa [${n}], que não é numérica` });
            else if (target.key === q.key)
              issues.push({ onde, problema: "a fórmula se refere a ela mesma" });
          }
        } catch (e) {
          issues.push({ onde, problema: e instanceof FormulaError ? `fórmula: ${e.message}` : "fórmula inválida" });
        }
    }
  }
  if (total === 0 && def.topicos.length)
    issues.push({ onde: "formulário", problema: "nenhuma questão" });
  let edges = /* @__PURE__ */ new Map;
  for (let [k, { q, topic }] of idx.questions) {
    if (q.depende_de)
      edges.set(k, q.depende_de.questao);
    if (topic.depende_de)
      edges.set("t:" + topic.key, topic.depende_de.questao);
  }
  let parentOf = (k) => {
    let out = [], e = edges.get(k);
    if (e)
      out.push(e);
    let t = idx.questions.get(k)?.topic;
    if (t?.depende_de)
      out.push(t.depende_de.questao);
    return out;
  };
  for (let start of idx.questions.keys()) {
    let stack = [...parentOf(start)], seenC = /* @__PURE__ */ new Set;
    while (stack.length) {
      let cur = stack.pop();
      if (cur === start) {
        issues.push({ onde: `questão ${idx.questions.get(start).numero}`, problema: "dependência circular" });
        break;
      }
      if (seenC.has(cur))
        continue;
      seenC.add(cur), stack.push(...parentOf(cur));
    }
  }
  return (def.config.aprovacao?.etapas ?? []).forEach((e, k) => {
    if (!e.aprovadores.length)
      issues.push({ onde: `aprovação, etapa ${k + 1}`, problema: "etapa sem aprovador" });
  }), issues;
  function checkDep(dep, onde) {
    if (!dep)
      return;
    let target = idx.questions.get(dep.questao)?.q;
    if (!target)
      return issues.push({ onde, problema: "depende de uma questão que não existe" });
    if (target.tipo !== "escolha_simples" && target.tipo !== "escolha_multipla")
      return issues.push({ onde, problema: "só pode depender de questão de escolha" });
    if (!(target.opcoes ?? []).some((o) => o.key === dep.opcao))
      issues.push({ onde, problema: "depende de uma opção que não existe" });
  }
}
// app/src/data/agenda.ts
var DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
var toMs = (d) => Date.parse(d + "T00:00:00Z"), fromMs = (ms) => new Date(ms).toISOString().slice(0, 10), somarDias = (d, n) => fromMs(toMs(d) + n * 86400000), diaDaSemana = (d) => new Date(toMs(d)).getUTCDay(), ultimoDiaDoMes = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
function casa(r, d) {
  switch (r.recorrencia) {
    case "nenhuma":
      return d === r.data_inicio;
    case "diaria":
      return !0;
    case "semanal":
      return ((r.dias_semana?.length) ? r.dias_semana : [diaDaSemana(r.data_inicio)]).includes(diaDaSemana(d));
    case "mensal": {
      let alvo = Number(r.data_inicio.slice(8, 10)), dt = new Date(toMs(d));
      return dt.getUTCDate() === Math.min(alvo, ultimoDiaDoMes(dt.getUTCFullYear(), dt.getUTCMonth()));
    }
  }
}
function datasDaRegra(r, de, ate) {
  let fim = r.termino === "data" && r.termino_data && r.termino_data < ate ? r.termino_data : ate, out = [], n = 0;
  for (let d = r.data_inicio;d <= fim; d = somarDias(d, 1)) {
    if (!casa(r, d))
      continue;
    if (n++, r.termino === "quantidade" && r.termino_qtd && n > r.termino_qtd)
      break;
    if (d >= de)
      out.push(d);
    if (r.recorrencia === "nenhuma")
      break;
  }
  return out;
}
function deslocamentoMin(fuso, utcMs) {
  let p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(utcMs)), g = (t) => Number(p.find((x) => x.type === t).value);
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - utcMs) / 60000;
}
function localParaUTC(data, hora, fuso) {
  let [y, m, d] = data.split("-").map(Number), [hh, mm] = hora.split(":").map(Number), parede = Date.UTC(y, m - 1, d, hh, mm), ts = parede - deslocamentoMin(fuso, parede) * 60000;
  return ts = parede - deslocamentoMin(fuso, ts) * 60000, new Date(ts).toISOString();
}
function dataLocal(iso, fuso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
}
function instantesDaRegra(r, de, ate) {
  let horas = r.dia_inteiro ? ["08:00"] : [...new Set(r.horarios)].sort();
  return datasDaRegra(r, de, ate).flatMap((d) => horas.map((h) => localParaUTC(d, h, r.fuso_horario)));
}
function limiteDaOcorrencia(previsto_em, r) {
  if (r.dia_inteiro)
    return localParaUTC(somarDias(dataLocal(previsto_em, r.fuso_horario), 1), "00:00", r.fuso_horario);
  return new Date(Date.parse(previsto_em) + 7200000).toISOString();
}
function situacaoOcorrencia(o, r, agora = Date.now()) {
  if (o.status !== "pendente")
    return o.status;
  return agora > Date.parse(limiteDaOcorrencia(o.previsto_em, r)) ? "atrasada" : "pendente";
}
function validarRegra(r) {
  let e = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_inicio))
    e.push("Informe a data de início.");
  if (!r.dia_inteiro && !r.horarios.length)
    e.push("Informe pelo menos um horário ou marque o dia inteiro.");
  if (r.horarios.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))
    e.push("Há um horário inválido.");
  if (r.recorrencia === "semanal" && !r.dias_semana?.length)
    e.push("Escolha pelo menos um dia da semana.");
  if (r.termino === "data" && (!r.termino_data || r.termino_data < r.data_inicio))
    e.push("A data de término precisa ser depois do início.");
  if (r.termino === "quantidade" && !(r.termino_qtd && r.termino_qtd > 0 && r.termino_qtd <= 999))
    e.push("Informe quantas vezes (de 1 a 999).");
  return e;
}
var br = (d) => d.split("-").reverse().join("/");
function lista(xs) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}
function descreverRegra(r) {
  let horas = r.dia_inteiro ? ", o dia inteiro" : ` às ${lista([...new Set(r.horarios)].sort())}`, quando;
  switch (r.recorrencia) {
    case "nenhuma":
      return `Uma vez, em ${br(r.data_inicio)}${r.dia_inteiro ? horas : "," + horas}`;
    case "diaria":
      quando = "Todo dia";
      break;
    case "semanal": {
      let dias = [...r.dias_semana?.length ? r.dias_semana : [diaDaSemana(r.data_inicio)]].sort();
      if (quando = dias.length === 7 ? "Todo dia" : `${dias.every((d) => d === 0 || d === 6) ? "Todo" : "Toda"} ${lista(dias.map((d) => DIAS_SEMANA[d]))}`, dias.length === 5 && !dias.includes(0) && !dias.includes(6))
        quando = "De segunda a sexta";
      break;
    }
    case "mensal":
      quando = `Todo mês no dia ${Number(r.data_inicio.slice(8, 10))}`;
      break;
  }
  let fim = r.termino === "data" && r.termino_data ? ` até ${br(r.termino_data)}` : r.termino === "quantidade" && r.termino_qtd ? `, ${r.termino_qtd} ${r.termino_qtd === 1 ? "vez" : "vezes"}` : "";
  return `${quando}${horas}, a partir de ${br(r.data_inicio)}${fim}`;
}

// app/src/data/camposAvaliado.ts
function campoVisivel(c, valores) {
  return !c.depende_de || (valores[c.depende_de.campo_id] ?? "") === c.depende_de.valor;
}
function validarCampos(campos, entrada = {}) {
  let ord = [...campos].sort((a, b) => a.ordem - b.ordem), valores = {};
  for (let c of ord) {
    let v = (entrada[c.id] ?? "").trim();
    if (v && c.tipo === "lista")
      v = (c.opcoes ?? []).find((o) => o.localeCompare(v, "pt-BR", { sensitivity: "base" }) === 0) ?? v;
    if (v)
      valores[c.id] = v;
  }
  let erros = [];
  for (let mudou = !0;mudou; ) {
    mudou = !1;
    for (let c of ord)
      if (valores[c.id] !== void 0 && !campoVisivel(c, valores))
        delete valores[c.id], mudou = !0;
  }
  for (let c of ord) {
    if (!campoVisivel(c, valores))
      continue;
    let v = valores[c.id];
    if (!v) {
      if (c.obrigatorio)
        erros.push(`${c.nome} é obrigatório`);
      continue;
    }
    if (c.tipo === "lista" && !(c.opcoes ?? []).includes(v))
      erros.push(`${c.nome}: "${v}" não está entre as opções (${(c.opcoes ?? []).join(", ")})`);
    if (c.tipo === "numero" && !Number.isFinite(Number(v.replace(/\./g, "").replace(",", "."))))
      erros.push(`${c.nome}: "${v}" não é um número`);
    if (c.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
      if (m)
        valores[c.id] = `${m[3]}-${m[2]}-${m[1]}`;
      else
        erros.push(`${c.nome}: use a data como dd/mm/aaaa`);
    }
  }
  return { valores, erros };
}
function validarDefinicaoCampos(campos) {
  let erros = [], nomes = /* @__PURE__ */ new Set;
  for (let c of campos) {
    let n = c.nome.trim().toLowerCase();
    if (!n)
      erros.push("Há um campo sem nome.");
    else if (nomes.has(n))
      erros.push(`Já existe um campo chamado "${c.nome}".`);
    if (nomes.add(n), ["nome", "código", "codigo", "cnpj", "e-mail", "email", "telefone", "endereço", "endereco"].includes(n))
      erros.push(`"${c.nome}" já é um campo padrão do cadastro.`);
    if (c.tipo === "lista" && (c.opcoes ?? []).filter((o) => o.trim()).length < 2)
      erros.push(`${c.nome}: a lista precisa de pelo menos 2 opções.`);
    if (c.depende_de) {
      let alvo = campos.find((x) => x.id === c.depende_de.campo_id);
      if (!alvo || alvo.tipo !== "lista")
        erros.push(`${c.nome}: só pode depender de um campo do tipo lista.`);
      else if (!(alvo.opcoes ?? []).includes(c.depende_de.valor))
        erros.push(`${c.nome}: "${c.depende_de.valor}" não é opção de ${alvo.nome}.`);
      let vistos = /* @__PURE__ */ new Set([c.id]), cur = alvo;
      while (cur?.depende_de) {
        if (vistos.has(cur.id)) {
          erros.push(`${c.nome}: dependência circular.`);
          break;
        }
        if (vistos.add(cur.id), cur = campos.find((x) => x.id === cur.depende_de.campo_id), cur && vistos.has(cur.id)) {
          erros.push(`${c.nome}: dependência circular.`);
          break;
        }
      }
    }
  }
  return [...new Set(erros)];
}

// app/src/data/seed.ts
var ORG = { id: "org-1", nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco" }, TODAS_ACOES = [
  "gerenciar_formularios",
  "aplicar",
  "editar_inspecao",
  "excluir_inspecao",
  "ver_todas_inspecoes",
  "gerenciar_avaliados",
  "gerenciar_planos",
  "gerenciar_agendamentos",
  "gerenciar_workflows",
  "gerenciar_permissoes",
  "aprovar",
  "ver_painel"
], FUNCOES = [
  { id: "fn-admin", nome: "Administrador", acoes: TODAS_ACOES, sistema: !0 },
  { id: "fn-qualidade", nome: "Analista de qualidade", acoes: ["gerenciar_formularios", "aplicar", "editar_inspecao", "ver_todas_inspecoes", "gerenciar_avaliados", "gerenciar_planos", "aprovar", "ver_painel"] },
  { id: "fn-supervisor", nome: "Supervisor de lojas", acoes: ["aplicar", "ver_painel", "aprovar"] },
  { id: "fn-aplicador", nome: "Aplicador", acoes: ["aplicar"] }
], LIVRE = { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] };
var MEMBROS_REG = [
  { id: "m-rogerio", org_id: ORG.id, nome: "Rogério Marinho", email: "rogerio@exemplo.com", funcao_id: "fn-admin", is_master: !0, ativo: !0, acesso: LIVRE, created_at: "2026-09-01T12:00:00.000Z" },
  {
    id: "m-ana",
    org_id: ORG.id,
    nome: "Ana Paula Souza",
    email: "ana@exemplo.com",
    funcao_id: "fn-aplicador",
    is_master: !1,
    ativo: !0,
    acesso: { formularios: ["f-flv"], avaliados: "todos", ver_membros: [], ver_equipes: [] },
    created_at: "2026-09-01T12:00:00.000Z"
  },
  {
    id: "m-carlos",
    org_id: ORG.id,
    nome: "Carlos Eduardo Lima",
    email: "carlos@exemplo.com",
    funcao_id: "fn-supervisor",
    is_master: !1,
    ativo: !0,
    acesso: { formularios: ["f-flv"], avaliados: ["a-bosque", "a-centro"], ver_membros: [], ver_equipes: ["eq-lojas"] },
    created_at: "2026-09-01T12:00:00.000Z"
  }
], EQUIPES = [
  { id: "eq-lojas", org_id: ORG.id, nome: "Equipe de lojas", membros: ["m-ana"], acesso: { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] } }
];
var av = (id, nome, codigo, endereco, email) => ({
  id,
  org_id: ORG.id,
  nome,
  codigo_externo: codigo,
  endereco,
  email,
  ativo: !0,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z"
}), AVALIADOS = [
  av("a-bosque", "Loja 01 — Bosque", "LJ01", "Av. Ceará, 1500 — Bosque", "gerencia.lj01@exemplo.com"),
  av("a-centro", "Loja 02 — Centro", "LJ02", "Rua Marechal Deodoro, 210 — Centro", "gerencia.lj02@exemplo.com"),
  av("a-doca3", "CD — Doca 3", "CD03", "Estrada do Aeroporto, km 3")
];
AVALIADOS[0].campos = { "cp-regional": "Capital", "cp-formato": "Supermercado", "cp-gerente": "Júlia Andrade" };
AVALIADOS[1].campos = { "cp-regional": "Capital", "cp-formato": "Express", "cp-gerente": "Paulo Neri" };
AVALIADOS[2].campos = { "cp-regional": "Capital", "cp-formato": "Centro de distribuição" };
var CAMPOS_AVALIADO = [
  { id: "cp-regional", nome: "Regional", tipo: "lista", opcoes: ["Capital", "Interior"], obrigatorio: !1, na_lista: !0, ordem: 1 },
  { id: "cp-cidade", nome: "Cidade", tipo: "texto", obrigatorio: !0, na_lista: !1, depende_de: { campo_id: "cp-regional", valor: "Interior" }, ordem: 2 },
  { id: "cp-formato", nome: "Formato", tipo: "lista", opcoes: ["Supermercado", "Express", "Atacarejo", "Centro de distribuição"], obrigatorio: !1, na_lista: !0, ordem: 3 },
  { id: "cp-gerente", nome: "Gerente", tipo: "texto", obrigatorio: !1, na_lista: !1, ordem: 4 }
], CLASSES = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
  { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
  { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
], sn = (key, titulo, extra = {}) => ({
  key,
  titulo,
  tipo: "escolha_simples",
  obrigatoria: !0,
  opcoes: [
    { key: `${key}-sim`, texto: "Sim", pontos: 10, conforme: !0 },
    { key: `${key}-nao`, texto: "Não", pontos: 0, conforme: !1 },
    { key: `${key}-na`, texto: "Não se aplica", na: !0 }
  ],
  ...extra
}), DEF_FLV = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: CLASSES, geo: "off", reincidencia_meses: 3, relatorio: { emails: { avaliado: !0, extras: ["qualidade@exemplo.com"] } } },
  topicos: [
    {
      key: "t-venda",
      titulo: "Área de venda",
      questoes: [
        {
          key: "q-vencidos",
          titulo: "A área de venda está livre de produtos vencidos?",
          tipo: "escolha_simples",
          obrigatoria: !0,
          ajuda: { texto: "Confira pelo menos 3 lotes por bancada. Etiqueta ilegível conta como vencido." },
          nc_exige: { foto: !0, observacao: !0 },
          plano_acao_modelo_id: "pm-retirada",
          opcoes: [
            { key: "q-vencidos-sim", texto: "Sim, nada vencido", pontos: 10, conforme: !0 },
            { key: "q-vencidos-nao", texto: "Não, encontrei vencidos", pontos: 0, conforme: !1, desconto: { pct: 50, escopo: "topico" } }
          ]
        },
        sn("q-preco", "Todos os itens da bancada têm preço visível?", { nc_exige: { observacao: !0 } }),
        {
          key: "q-gondola",
          titulo: "Condição das bancadas",
          tipo: "escolha_multipla",
          obrigatoria: !0,
          opcoes: [
            { key: "q-gondola-limpa", texto: "Limpas", pontos: 5, conforme: !0 },
            { key: "q-gondola-abastecida", texto: "Abastecidas", pontos: 5, conforme: !0 },
            { key: "q-gondola-avaria", texto: "Com produto avariado à mostra", pontos: 0, conforme: !1 }
          ]
        }
      ]
    },
    {
      key: "t-frio",
      titulo: "Câmara fria",
      questoes: [
        {
          key: "q-temp",
          titulo: "Temperatura da câmara fria",
          tipo: "numerica",
          obrigatoria: !0,
          numerica: {
            formato: "decimal",
            unidade: "°C",
            limite: { min: -2, max: 4, obs_obrigatoria: !0 },
            faixas_nota: [{ ate: 4, pontos: 10 }, { ate: 7, pontos: 5 }, { ate: null, pontos: 0 }]
          },
          foto_obrigatoria: !0,
          ajuda: { texto: "Leia o termômetro da porta e tire foto do visor." }
        },
        sn("q-porta", "A porta da câmara veda sem frestas?", { plano_acao_modelo_id: "pm-manutencao" }),
        {
          key: "q-porta-motivo",
          titulo: "O que está causando a fresta?",
          tipo: "texto",
          obrigatoria: !0,
          depende_de: { questao: "q-porta", opcao: "q-porta-nao" }
        }
      ]
    },
    {
      key: "t-fim",
      titulo: "Encerramento",
      questoes: [
        { key: "q-obs", titulo: "Observações gerais", tipo: "texto" },
        { key: "q-ass", titulo: "Assinatura do responsável pela loja", tipo: "assinatura", obrigatoria: !0 }
      ]
    }
  ]
}, DEF_RECEB = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: CLASSES },
  topicos: [
    {
      key: "r-doc",
      titulo: "Documentação",
      questoes: [
        { key: "r-nf", titulo: "Número da nota fiscal", tipo: "texto", obrigatoria: !0, texto: { leitura_codigo: !0 } },
        sn("r-lacre", "O lacre do baú chegou intacto?", { nc_exige: { foto: !0 } })
      ]
    },
    {
      key: "r-peso",
      titulo: "Conferência de peso",
      questoes: [
        { key: "r-bruto", titulo: "Peso bruto da amostra", tipo: "numerica", obrigatoria: !0, numerica: { formato: "decimal", unidade: "kg" } },
        { key: "r-tara", titulo: "Tara da caixa", tipo: "numerica", obrigatoria: !0, numerica: { formato: "decimal", unidade: "kg" } },
        { key: "r-liq", titulo: "Peso líquido", tipo: "calculo", calculo: { formula: "[3] - [4]", valor_se_vazio: 0 } },
        {
          key: "r-temp",
          titulo: "Temperatura do produto na chegada",
          tipo: "numerica",
          obrigatoria: !0,
          numerica: { formato: "decimal", unidade: "°C", limite: { max: 7, obs_obrigatoria: !0 }, faixas_nota: [{ ate: 7, pontos: 10 }, { ate: null, pontos: 0 }] }
        }
      ]
    }
  ]
}, FORMULARIOS = [
  { id: "f-flv", org_id: ORG.id, nome: "Checklist FLV e perecíveis", rascunho: DEF_FLV, versao_publicada_id: "fv-flv-1", avaliados_vinculados: ["a-bosque", "a-centro"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" },
  { id: "f-receb", org_id: ORG.id, nome: "Recebimento de refrigerados", rascunho: DEF_RECEB, versao_publicada_id: "fv-receb-1", avaliados_vinculados: ["a-doca3"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" }
];
var HISTORICO = [
  {
    client_uuid: "seed-0001",
    formulario_id: "f-flv",
    formulario_versao_id: "fv-flv-1",
    avaliado_id: "a-bosque",
    responsavel_id: "m-ana",
    iniciada_em: "2026-10-06T11:05:00.000Z",
    finalizada_em: "2026-10-06T11:31:00.000Z",
    respostas: {
      "q-vencidos": { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Iogurte natural lote 0921 vencido em 04/10." },
      "q-preco": { opcoes: ["q-preco-sim"] },
      "q-gondola": { opcoes: ["q-gondola-limpa", "q-gondola-abastecida"] },
      "q-temp": { numero: 3.2, fotos: 1 },
      "q-porta": { opcoes: ["q-porta-sim"] },
      "q-ass": { assinatura: "seed" }
    }
  },
  {
    client_uuid: "seed-0002",
    formulario_id: "f-receb",
    formulario_versao_id: "fv-receb-1",
    avaliado_id: "a-doca3",
    responsavel_id: "m-rogerio",
    iniciada_em: "2026-10-09T09:40:00.000Z",
    finalizada_em: "2026-10-09T09:52:00.000Z",
    respostas: {
      "r-nf": { texto: "000.481.233" },
      "r-lacre": { opcoes: ["r-lacre-sim"] },
      "r-bruto": { numero: 12.4 },
      "r-tara": { numero: 0.6 },
      "r-temp": { numero: 8.5, observacao: "Caminhão chegou com o baú aberto." }
    }
  }
], PLANOS_MODELO = [
  {
    id: "pm-retirada",
    org_id: ORG.id,
    nome: "Retirada e descarte",
    agrupamento: "por_inspecao",
    prazo_dias: 1,
    destinatario: "avaliado",
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    definicao: { config: { calcular_nota: !1 }, topicos: [{ key: "pr-t", titulo: "Correção", questoes: [
      {
        key: "pr-acao",
        titulo: "O que foi feito com os produtos?",
        tipo: "texto",
        obrigatoria: !0,
        foto_obrigatoria: !0,
        ajuda: { texto: "Descreva a retirada e anexe foto da área já corrigida." }
      },
      { key: "pr-causa", titulo: "Qual foi a causa?", tipo: "escolha_simples", obrigatoria: !0, opcoes: [
        { key: "pr-causa-ronda", texto: "Faltou ronda de validade" },
        { key: "pr-causa-fefo", texto: "Reposição fora do PVPS/FEFO" },
        { key: "pr-causa-etq", texto: "Etiqueta ilegível" },
        { key: "pr-causa-outra", texto: "Outra" }
      ] },
      { key: "pr-quem", titulo: "Quem fez a correção?", tipo: "texto", obrigatoria: !0 }
    ] }] }
  },
  {
    id: "pm-manutencao",
    org_id: ORG.id,
    nome: "Manutenção corretiva",
    agrupamento: "por_nc",
    prazo_dias: 5,
    destinatario: "fixo",
    email_fixo: "manutencao@exemplo.com",
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    definicao: { config: { calcular_nota: !1 }, topicos: [{ key: "pm-t", titulo: "Manutenção", questoes: [
      { key: "pm-os", titulo: "Número da ordem de serviço", tipo: "texto", obrigatoria: !0 },
      { key: "pm-data", titulo: "Data prevista para o conserto", tipo: "data_hora", data_hora: { campos: "data" }, obrigatoria: !0 },
      { key: "pm-obs", titulo: "Observações", tipo: "texto" }
    ] }] }
  }
];
function agendamentosIniciais(hoje) {
  let base = { org_id: ORG.id, fuso_horario: ORG.fuso_horario, ativo: !0, materializado_ate: null, criado_por: "m-rogerio", created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" };
  return [
    {
      ...base,
      id: "ag-flv-centro",
      formulario_id: "f-flv",
      avaliado_id: "a-centro",
      responsaveis: ["m-ana"],
      data_inicio: hoje,
      horarios: [],
      dia_inteiro: !0,
      recorrencia: "diaria",
      termino: "nunca"
    },
    {
      ...base,
      id: "ag-receb-doca",
      formulario_id: "f-receb",
      avaliado_id: "a-doca3",
      responsaveis: ["m-rogerio"],
      data_inicio: hoje,
      horarios: ["07:30"],
      dia_inteiro: !1,
      recorrencia: "semanal",
      dias_semana: [1, 3, 5],
      termino: "nunca"
    }
  ];
}
function prng(seed) {
  return () => {
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function historicoDemo(hoje) {
  let r = prng(20261014), out = [], dia0 = Date.parse(hoje + "T12:00:00Z") - 7257600000, n = 0;
  for (let semana = 0;semana < 12; semana++) {
    let t = semana / 11;
    for (let [av, risco, dias] of [["a-bosque", 0.15 + 0.35 * t, [1, 4]], ["a-centro", 0.45 - 0.35 * t, [2, 5]], ["a-doca3", 0.25, [1, 3]]])
      for (let d of dias) {
        let ini = dia0 + (semana * 7 + d) * 86400000 + Math.floor(r() * 6) * 3600000;
        if (ini >= Date.parse(hoje + "T00:00:00Z"))
          continue;
        let p = (x) => r() < x, id = `demo-${String(++n).padStart(3, "0")}`;
        if (av === "a-doca3") {
          let temp = Math.round((3 + r() * (p(risco) ? 7 : 3.5)) * 10) / 10, lacreOk = !p(risco / 2);
          out.push({
            client_uuid: id,
            formulario_id: "f-receb",
            formulario_versao_id: "fv-receb-1",
            avaliado_id: av,
            responsavel_id: "m-rogerio",
            iniciada_em: new Date(ini).toISOString(),
            finalizada_em: new Date(ini + 900000).toISOString(),
            respostas: {
              "r-nf": { texto: String(1e5 + Math.floor(r() * 899999)) },
              "r-lacre": lacreOk ? { opcoes: ["r-lacre-sim"] } : { opcoes: ["r-lacre-nao"], fotos: 1 },
              "r-bruto": { numero: 12 + Math.round(r() * 30) / 10 },
              "r-tara": { numero: 0.6 },
              "r-temp": temp > 7 ? { numero: temp, observacao: "Acima do limite na chegada." } : { numero: temp }
            }
          });
          continue;
        }
        let temp = Math.round((1 + r() * (p(risco) ? 7 : 3)) * 10) / 10, venc = p(risco), preco = p(risco * 0.8), porta = p(risco * 0.6), avaria = p(risco * 0.7);
        out.push({
          client_uuid: id,
          formulario_id: "f-flv",
          formulario_versao_id: "fv-flv-1",
          avaliado_id: av,
          responsavel_id: p(0.5) ? "m-ana" : "m-carlos",
          iniciada_em: new Date(ini).toISOString(),
          finalizada_em: new Date(ini + 1500000).toISOString(),
          respostas: {
            "q-vencidos": venc ? { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Lote vencido na bancada." } : { opcoes: ["q-vencidos-sim"] },
            "q-preco": preco ? { opcoes: ["q-preco-nao"], observacao: "Itens sem etiqueta." } : { opcoes: ["q-preco-sim"] },
            "q-gondola": { opcoes: avaria ? ["q-gondola-limpa", "q-gondola-avaria"] : ["q-gondola-limpa", "q-gondola-abastecida"] },
            "q-temp": temp > 4 ? { numero: temp, fotos: 1, observacao: "Fora da faixa." } : { numero: temp, fotos: 1 },
            "q-porta": porta ? { opcoes: ["q-porta-nao"] } : { opcoes: ["q-porta-sim"] },
            ...porta ? { "q-porta-motivo": { texto: "Borracha ressecada." } } : {},
            "q-ass": { assinatura: "demo" }
          }
        });
      }
  }
  return out.sort((a, b) => a.finalizada_em.localeCompare(b.finalizada_em));
}

// app/src/data/nucleo.ts
function pode(m, acao) {
  return m.is_master || m.acoes.includes(acao);
}
function podeVerInspecao(m, i) {
  return pode(m, "ver_todas_inspecoes") || i.responsavel_id === m.id || m.ve_inspecoes_de.includes(i.responsavel_id);
}
function criarServidor(amb) {
  let ORG = amb.org, STATE_KEY = "srv:state", SESSAO_KEY = "inspeta:sessao", MEMBROS_KEY = "inspeta:membros", uuid = () => crypto.randomUUID(), nowISO = () => (/* @__PURE__ */ new Date()).toISOString(), clone = (v) => structuredClone(v);
  async function load() {
    let s = await amb.carregar();
    if (s) {
      if (s.planosModelo ??= clone(PLANOS_MODELO), s.planos ??= [], s.emails ??= [], s.membros ??= clone(MEMBROS_REG), s.funcoes ??= clone(FUNCOES), s.equipes ??= clone(EQUIPES), s.agendamentos ??= agendamentosIniciais(hojeNaOrg()), s.ocorrencias ??= [], s.aprovacoes ??= [], s.camposAvaliado ??= clone(CAMPOS_AVALIADO), amb.local.get("inspeta:membros") === null)
        publicarMembros(s);
      return s;
    }
    let fresh = amb.estadoInicial();
    if (fresh.inspecoes.length === 0 && fresh.formularios.some((f) => f.id === "f-flv"))
      for (let h of HISTORICO) {
        let m = membroEm(fresh, h.responsavel_id);
        processar(fresh, m, { ...h, status: "completa", anexos: [], device_id: "seed" }, h.finalizada_em);
      }
    return await amb.gravar(fresh), fresh;
  }
  async function save(s, topic) {
    if (await amb.gravar(s), topic === "membros")
      publicarMembros(s), amb.aviso("sessao");
    amb.aviso(topic);
  }
  function publicarMembros(s) {
    amb.local.set("inspeta:membros", JSON.stringify(resolverMembros(s.membros, s.funcoes, s.equipes)));
  }
  let cacheRaw = null, cache = [];
  function membrosCache() {
    let raw = amb.local.get("inspeta:membros") ?? "seed";
    if (raw !== cacheRaw)
      cache = raw === "seed" ? resolverMembros(MEMBROS_REG, FUNCOES, EQUIPES) : JSON.parse(raw), cacheRaw = raw;
    return cache;
  }
  function membroEm(s, id) {
    let m = resolverMembros(s.membros, s.funcoes, s.equipes).find((x) => x.id === id);
    if (!m || !m.ativo)
      throw Error("Sessão inválida");
    return m;
  }
  function mutate(topic, fn) {
    return amb.exclusivo(async () => {
      let s = await load(), out = fn(s);
      return await save(s, topic), out;
    });
  }
  function log(s, inspecao_id, membro_id, acao, dados = {}, em = nowISO()) {
    s.eventos.push({ id: ++s.eventoSeq, inspecao_id, membro_id, acao, dados, em });
  }
  function anteriores(s, formulario_id, avaliado_id, excetoClient) {
    let meses = s.formularios.find((f) => f.id === formulario_id)?.rascunho.config.reincidencia_meses ?? 3, limite = Date.now() - meses * 31 * 86400000, ult = s.inspecoes.filter((i) => i.formulario_id === formulario_id && i.avaliado_id === avaliado_id && i.status !== "rascunho" && i.client_uuid !== excetoClient && i.finalizada_em && Date.parse(i.finalizada_em) >= limite).sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""))[0];
    if (!ult)
      return {};
    let out = {};
    for (let [k, r] of Object.entries(ult.resultado.questoes))
      out[k] = { conforme: r.conforme, resposta: ult.respostas[k] };
    return out;
  }
  function questoesPreenchidas(def) {
    return def.topicos.flatMap((t) => t.questoes).filter((q) => q.preenchimento_automatico || q.preenchimento_unico);
  }
  function ultimasRespostas(s, def, formulario_id, avaliado_id, excetoClient) {
    let qs = questoesPreenchidas(def);
    if (!qs.length)
      return {};
    let out = {}, hist = s.inspecoes.filter((i) => i.formulario_id === formulario_id && i.avaliado_id === avaliado_id && i.status !== "rascunho" && i.client_uuid !== excetoClient).sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""));
    for (let q of qs) {
      let r = hist.find((i) => {
        let a = i.respostas[q.key];
        return a && (a.opcoes?.length || a.numero != null || a.texto || a.data || a.na);
      })?.respostas[q.key];
      if (r)
        out[q.key] = { opcoes: r.opcoes, numero: r.numero, texto: r.texto, data: r.data, na: r.na };
    }
    return out;
  }
  function processar(s, m, e, agora = nowISO()) {
    let versao = s.versoes.find((v) => v.id === e.formulario_versao_id && v.formulario_id === e.formulario_id);
    if (!versao)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
    if (!pode(m, "aplicar") || !podeFormulario(m, e.formulario_id) || !podeAvaliado(m, e.avaliado_id))
      return { client_uuid: e.client_uuid, ok: !1, erro: "sem_permissao", mensagem: "Você não tem permissão para este formulário." };
    let existente = s.inspecoes.find((i) => i.client_uuid === e.client_uuid);
    if (existente) {
      if (existente.responsavel_id !== m.id)
        return { client_uuid: e.client_uuid, ok: !1, erro: "conflito", mensagem: "Inspeção pertence a outra pessoa." };
      if (existente.status !== "rascunho")
        return { client_uuid: e.client_uuid, ok: !0, id: existente.id, nota_pct: existente.nota_pct, classificacao: existente.classificacao };
    }
    let fixas = ultimasRespostas(s, versao.definicao, e.formulario_id, e.avaliado_id, e.client_uuid);
    for (let q of questoesPreenchidas(versao.definicao))
      if (q.preenchimento_unico && fixas[q.key])
        e = { ...e, respostas: { ...e.respostas, [q.key]: { ...e.respostas[q.key], ...fixas[q.key] } } };
    let prev = anteriores(s, e.formulario_id, e.avaliado_id, e.client_uuid), ev = evaluateForm(versao.definicao, e.respostas, prev);
    if (e.status === "completa" && ev.pendentes.length)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: `${ev.pendentes.length} questão(ões) com pendência.` };
    let resultado = {
      nao_conformidades: ev.nao_conformidades,
      questoes: Object.fromEntries(Object.values(ev.questoes).filter((q) => q.visivel).map((q) => [q.key, {
        conforme: q.conforme,
        pontos: q.pontos,
        pontos_max: q.pontos_max,
        reincidente: q.reincidente,
        valor_calculado: q.valor_calculado
      }])),
      topicos: Object.fromEntries(Object.values(ev.topicos).map((t) => [t.key, { pct: t.pct, desconto_pct: t.desconto_pct }]))
    }, base = {
      org_id: ORG.id,
      client_uuid: e.client_uuid,
      formulario_id: e.formulario_id,
      formulario_versao_id: e.formulario_versao_id,
      avaliado_id: e.avaliado_id,
      responsavel_id: m.id,
      status: e.status,
      iniciada_em: e.iniciada_em,
      finalizada_em: e.finalizada_em,
      geo_inicio: e.geo_inicio ?? null,
      geo_fim: e.geo_fim ?? null,
      respostas: e.respostas,
      anexos: e.anexos,
      nota_pct: ev.nota_pct,
      pontos: ev.pontos,
      pontos_max: ev.pontos_max,
      classificacao: ev.classificacao?.nome ?? null,
      classificacao_cor: ev.classificacao?.cor ?? null,
      qtd_nao_conformidades: ev.nao_conformidades.length,
      resultado,
      device_id: e.device_id,
      sincronizada_em: agora,
      ocorrencia_id: e.status === "completa" ? cumprirOcorrencia(s, m, e, existente?.id) : null
    }, etapas = versao.definicao.config.aprovacao?.etapas ?? [], status = e.status === "completa" && etapas.length ? "em_aprovacao" : e.status;
    Object.assign(base, { status, aprovacao_etapa: status === "em_aprovacao" ? 1 : null });
    let id;
    if (existente)
      Object.assign(existente, base, { updated_at: agora }), id = existente.id;
    else
      id = uuid(), s.inspecoes.push({ id, ...base, created_at: agora, updated_at: agora }), log(s, id, m.id, "criada", { device_id: e.device_id }, e.iniciada_em);
    log(s, id, m.id, "sincronizada", { device_id: e.device_id }, agora);
    let oc = base.ocorrencia_id ? s.ocorrencias.find((o) => o.id === base.ocorrencia_id) : void 0;
    if (oc)
      oc.inspecao_id = id;
    if (e.status === "completa")
      log(s, id, m.id, "finalizada", { nota_pct: ev.nota_pct, ncs: ev.nao_conformidades.length }, e.finalizada_em ?? agora);
    if (status === "em_aprovacao")
      log(s, id, null, "enviada_aprovacao", { etapa: 1, de: etapas.length }, agora), avisarAprovadores(s, id);
    return { client_uuid: e.client_uuid, ok: !0, id, nota_pct: ev.nota_pct, classificacao: ev.classificacao?.nome ?? null };
  }
  function podeFormulario(m, formId) {
    return pode(m, "gerenciar_formularios") || m.formularios_permitidos === "todos" || m.formularios_permitidos.includes(formId);
  }
  function podeAvaliado(m, avId) {
    return m.avaliados_permitidos === "todos" || m.avaliados_permitidos.includes(avId);
  }
  function exigir(m, acao) {
    let atual = membrosCache().find((x) => x.id === m.id) ?? m;
    if (!atual.ativo || !pode(atual, acao))
      throw Error("Você não tem permissão para isso.");
  }
  function requireOnline() {
    amb.exigirRede();
  }
  let server = {
    async entrar(email, senha) {
      await amb.atraso();
      let st = await load(), m = resolverMembros(st.membros, st.funcoes, st.equipes).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!m || senha.length < 4)
        throw Error("E-mail ou senha incorretos.");
      if (!m.ativo)
        throw Error("Este acesso foi desativado. Fale com o administrador da conta.");
      return amb.local.set("inspeta:sessao", m.id), amb.aviso("sessao"), m;
    },
    sessao() {
      let id = amb.local.get("inspeta:sessao"), m = id ? membrosCache().find((x) => x.id === id) : void 0;
      return m && m.ativo ? m : null;
    },
    sair() {
      amb.local.del("inspeta:sessao"), amb.aviso("sessao");
    },
    org() {
      return ORG;
    },
    async recuperarSenha(_email) {
      await amb.atraso();
    },
    async definirSenha(_senha) {
      throw Error("Na demonstração qualquer senha com 4+ caracteres funciona.");
    },
    capturarRetornoAuth() {
      return null;
    },
    membros() {
      return membrosCache();
    },
    async listarFormularios() {
      await amb.atraso();
      let s = await load();
      return s.formularios.filter((f) => !f.arquivado).map((f) => {
        let v = s.versoes.find((x) => x.id === f.versao_publicada_id) ?? null;
        return {
          ...f,
          versao_numero: v?.numero ?? null,
          tem_alteracoes: !v || JSON.stringify(v.definicao) !== JSON.stringify(f.rascunho),
          qtd_questoes: f.rascunho.topicos.reduce((n, t) => n + t.questoes.length, 0),
          qtd_inspecoes: s.inspecoes.filter((i) => i.formulario_id === f.id && i.status !== "rascunho").length
        };
      }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    async obterFormulario(id) {
      let f = (await load()).formularios.find((x) => x.id === id);
      if (!f)
        throw Error("Formulário não encontrado.");
      return clone(f);
    },
    async criarFormulario(nome, base) {
      if (await amb.atraso(), !nome.trim())
        throw Error("Dê um nome ao formulário.");
      let def = base ? clone(base) : {
        config: { calcular_nota: !0, casas_decimais: 1, classificacoes: [
          { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
          { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
          { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
        ] },
        topicos: [{ key: uuid(), titulo: "Tópico 1", questoes: [{ key: uuid(), titulo: "", tipo: "escolha_simples", obrigatoria: !0, opcoes: [
          { key: uuid(), texto: "Sim", pontos: 10, conforme: !0 },
          { key: uuid(), texto: "Não", pontos: 0, conforme: !1 }
        ] }] }]
      };
      return mutate("formularios", (s) => {
        let f = { id: uuid(), org_id: ORG.id, nome: nome.trim(), rascunho: def, versao_publicada_id: null, avaliados_vinculados: [], arquivado: !1, created_at: nowISO(), updated_at: nowISO() };
        return s.formularios.push(f), clone(f);
      });
    },
    salvarRascunho(id, patch, esperado) {
      return mutate("formularios", (s) => {
        let f = s.formularios.find((x) => x.id === id);
        if (!f)
          throw Error("Formulário não encontrado.");
        if (esperado && f.updated_at !== esperado)
          throw Error("Este formulário foi alterado em outra aba. Recarregue para não perder mudanças.");
        if (patch.nome !== void 0)
          f.nome = patch.nome;
        if (patch.rascunho)
          f.rascunho = patch.rascunho;
        if (patch.avaliados_vinculados)
          f.avaliados_vinculados = patch.avaliados_vinculados;
        return f.updated_at = nowISO(), clone(f);
      });
    },
    async publicar(id, por) {
      return await amb.atraso(), mutate("formularios", (s) => {
        let f = s.formularios.find((x) => x.id === id);
        if (!f)
          throw Error("Formulário não encontrado.");
        let problemas = validateDefinition(f.rascunho);
        if (problemas.length)
          return { ok: !1, problemas };
        let numero = Math.max(0, ...s.versoes.filter((v) => v.formulario_id === id).map((v) => v.numero)) + 1, versao = { id: uuid(), formulario_id: id, numero, definicao: clone(f.rascunho), publicado_em: nowISO(), publicado_por: por };
        return s.versoes.push(versao), f.versao_publicada_id = versao.id, f.updated_at = nowISO(), { ok: !0, versao: clone(versao) };
      });
    },
    async obterVersao(id) {
      let v = (await load()).versoes.find((x) => x.id === id);
      if (!v)
        throw Error("Versão não encontrada.");
      return clone(v);
    },
    async listarAvaliados() {
      return await amb.atraso(), clone((await load()).avaliados).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    criarAvaliado(dados) {
      return server.salvarAvaliado(null, dados);
    },
    salvarAvaliado(id, dados) {
      if (dados.nome !== void 0 && !dados.nome.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (id === null && !dados.nome?.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (dados.email && !/^\S+@\S+\.\S+$/.test(dados.email))
        return Promise.reject(Error("E-mail inválido."));
      return mutate("avaliados", (s) => {
        let atual = id ? s.avaliados.find((a) => a.id === id) : void 0;
        if (id && !atual)
          throw Error("Avaliado não encontrado.");
        if (dados.codigo_externo && s.avaliados.some((a) => a.codigo_externo === dados.codigo_externo && a.id !== id))
          throw Error(`Já existe um avaliado com o código ${dados.codigo_externo}.`);
        let v = validarCampos(s.camposAvaliado, dados.campos ?? atual?.campos ?? {});
        if (v.erros.length)
          throw Error(v.erros.join(". ") + ".");
        if (atual)
          return Object.assign(atual, clone(dados), { nome: (dados.nome ?? atual.nome).trim(), campos: v.valores, updated_at: nowISO() }), clone(atual);
        let a = { ...clone(dados), id: uuid(), org_id: ORG.id, nome: dados.nome.trim(), campos: v.valores, ativo: !0, created_at: nowISO(), updated_at: nowISO() };
        return s.avaliados.push(a), clone(a);
      });
    },
    async listarCamposAvaliado() {
      return clone((await load()).camposAvaliado).sort((a, b) => a.ordem - b.ordem);
    },
    salvarCamposAvaliado(quem, campos) {
      exigir(quem, "gerenciar_avaliados");
      let erros = validarDefinicaoCampos(campos);
      if (erros.length)
        return Promise.reject(Error(erros.join(" ")));
      return mutate("avaliados", (s) => {
        let ids = new Set(campos.map((c) => c.id));
        s.camposAvaliado = campos.map((c, i) => ({
          ...clone(c),
          nome: c.nome.trim(),
          ordem: i + 1,
          opcoes: c.tipo === "lista" ? (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean) : void 0
        }));
        for (let a of s.avaliados)
          if (a.campos) {
            for (let k of Object.keys(a.campos))
              if (!ids.has(k))
                delete a.campos[k];
          }
        return clone(s.camposAvaliado);
      });
    },
    async listarInspecoes(quem, filtro = {}) {
      await amb.atraso();
      let s = await load(), busca = (filtro.busca ?? "").trim().toLowerCase(), nomeAv = new Map(s.avaliados.map((a) => [a.id, a.nome])), nomeF = new Map(s.formularios.map((f) => [f.id, f.nome])), nomeM = new Map(membrosCache().map((m) => [m.id, m.nome]));
      return clone(s.inspecoes.filter((i) => {
        if (!podeVerInspecao(quem, i) && !ehAprovador(s, quem, i))
          return !1;
        if (filtro.status && i.status !== filtro.status)
          return !1;
        let d = (i.finalizada_em ?? i.iniciada_em).slice(0, 10);
        if (filtro.de && d < filtro.de)
          return !1;
        if (filtro.ate && d > filtro.ate)
          return !1;
        if (busca) {
          if (![nomeAv.get(i.avaliado_id), nomeF.get(i.formulario_id), nomeM.get(i.responsavel_id), i.id.slice(0, 8)].join(" ").toLowerCase().includes(busca))
            return !1;
        }
        return !0;
      }).sort((a, b) => (b.finalizada_em ?? b.iniciada_em).localeCompare(a.finalizada_em ?? a.iniciada_em)));
    },
    async obterInspecao(quem, id) {
      let s = await load(), i = s.inspecoes.find((x) => x.id === id);
      if (!i || !podeVerInspecao(quem, i) && !ehAprovador(s, quem, i))
        throw Error("Inspeção não encontrada.");
      return clone(i);
    },
    async eventos(id) {
      return clone((await load()).eventos.filter((e) => e.inspecao_id === id));
    },
    async anexo(client_uuid) {
      return amb.anexo(client_uuid);
    },
    async salvarLogo(dataUrl) {
      if (!/^data:image\/(png|jpeg);base64,/.test(dataUrl))
        throw Error("Use uma imagem PNG ou JPG.");
      if (dataUrl.length > 409600)
        throw Error("Logo acima de 300 KB mesmo depois de reduzido.");
      let id = "logo-" + uuid();
      return await amb.guardarAnexo(id, dataUrl), id;
    },
    async layoutRelatorio(formulario_id) {
      let s = await load(), f = s.formularios.find((x) => x.id === formulario_id), layout = s.versoes.find((x) => x.id === f?.versao_publicada_id)?.definicao.config.relatorio?.layout ?? {};
      return { layout, logo: layout.logo_id ? await amb.anexo(layout.logo_id) ?? null : null };
    },
    registrarRelatorio(id, quem) {
      return mutate("inspecoes", (s) => log(s, id, quem, "relatorio_enviado", { formato: "pdf" }));
    },
    async pacote(membroId) {
      requireOnline(), await amb.atraso(), await rodarAgenda();
      let s = await load(), m = membroEm(s, membroId), formularios = s.formularios.filter((f) => !f.arquivado && f.versao_publicada_id && podeFormulario(m, f.id)).map((f) => ({
        formulario_id: f.id,
        nome: f.nome,
        versao: clone(s.versoes.find((v) => v.id === f.versao_publicada_id)),
        avaliados: f.avaliados_vinculados.length ? f.avaliados_vinculados : "todos"
      })), anterioresMap = {};
      for (let f of formularios)
        for (let a of s.avaliados) {
          let p = anteriores(s, f.formulario_id, a.id);
          if (Object.keys(p).length)
            anterioresMap[`${f.formulario_id}|${a.id}`] = p;
        }
      let avaliados = clone(s.avaliados.filter((a) => a.ativo && podeAvaliado(m, a.id))), hoje = hojeNaOrg(), janelaDe = new Date(Date.parse(somarDias(hoje, -7) + "T00:00:00Z")).toISOString(), agenda = s.ocorrencias.filter((o) => o.status === "pendente" && o.previsto_em >= janelaDe).flatMap((o) => {
        let a = s.agendamentos.find((x) => x.id === o.agendamento_id);
        if (!a || !a.responsaveis.includes(m.id) || !formularios.some((f) => f.formulario_id === a.formulario_id) || !avaliados.some((x) => x.id === a.avaliado_id))
          return [];
        return [{ id: o.id, formulario_id: a.formulario_id, avaliado_id: a.avaliado_id, previsto_em: o.previsto_em, dia_inteiro: a.dia_inteiro, limite: limiteDaOcorrencia(o.previsto_em, a), descricao: descreverRegra(a) }];
      }).sort((x, y) => x.previsto_em.localeCompare(y.previsto_em)), ultimas = {};
      for (let f of formularios)
        for (let a of avaliados) {
          let u = ultimasRespostas(s, f.versao.definicao, f.formulario_id, a.id);
          if (Object.keys(u).length)
            ultimas[`${f.formulario_id}|${a.id}`] = u;
        }
      return { cursor: nowISO(), membro: m, org: ORG, formularios, avaliados, anteriores: anterioresMap, ultimas, agenda };
    },
    async enviarAnexo(membroId, client_uuid, dataUrl) {
      if (requireOnline(), membroEm(await load(), membroId), await amb.atraso(), dataUrl.length > 21548236.8)
        throw Error("Arquivo acima de 15 MB.");
      await amb.guardarAnexo(client_uuid, dataUrl);
    },
    async enviarInspecoes(membroId, lote) {
      requireOnline();
      let m = membroEm(await load(), membroId);
      if (await amb.atraso(), lote.length > 20)
        throw Error("Lote acima de 20 inspeções.");
      let presentes = await amb.anexosPresentes(lote.flatMap((e) => e.anexos.map((a) => a.client_uuid))), res = await mutate("inspecoes", (s) => lote.map((e) => {
        if (e.anexos.find((a) => !presentes.has(a.client_uuid)))
          return { client_uuid: e.client_uuid, ok: !1, erro: "anexo_faltando", mensagem: "Foto ainda não enviada." };
        return processar(s, m, e);
      }));
      for (let r of res) {
        let e = lote.find((x) => x.client_uuid === r.client_uuid);
        if (r.ok && e?.status === "completa")
          await posFinalizacao(r.id);
      }
      return res;
    },
    async listarPlanosModelo() {
      return await amb.atraso(), clone((await load()).planosModelo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    async obterPlanoModelo(id) {
      let m = (await load()).planosModelo.find((x) => x.id === id);
      if (!m)
        throw Error("Modelo de plano não encontrado.");
      return clone(m);
    },
    criarPlanoModelo(nome) {
      if (!nome.trim())
        return Promise.reject(Error("Dê um nome ao modelo."));
      return mutate("planos", (s) => {
        if (s.planosModelo.some((m) => m.nome.toLowerCase() === nome.trim().toLowerCase()))
          throw Error("Já existe um modelo com esse nome.");
        let m = {
          id: uuid(),
          org_id: ORG.id,
          nome: nome.trim(),
          agrupamento: "por_inspecao",
          prazo_dias: 3,
          destinatario: "avaliado",
          definicao: { config: { calcular_nota: !1 }, topicos: [{ key: uuid(), titulo: "Correção", questoes: [
            { key: uuid(), titulo: "O que foi feito para corrigir?", tipo: "texto", obrigatoria: !0 }
          ] }] },
          created_at: nowISO(),
          updated_at: nowISO()
        };
        return s.planosModelo.push(m), clone(m);
      });
    },
    salvarPlanoModelo(m) {
      return mutate("planos", (s) => {
        let i = s.planosModelo.findIndex((x) => x.id === m.id);
        if (i < 0)
          throw Error("Modelo de plano não encontrado.");
        if (!m.nome.trim())
          throw Error("Dê um nome ao modelo.");
        if (m.destinatario === "fixo" && !/^\S+@\S+\.\S+$/.test(m.email_fixo ?? ""))
          throw Error("Informe um e-mail válido para o destinatário fixo.");
        return s.planosModelo[i] = { ...clone(m), updated_at: nowISO() }, clone(s.planosModelo[i]);
      });
    },
    async listarPlanos(quem, filtro = {}) {
      await amb.atraso();
      let s = await load(), hoje = hojeNaOrg(), busca = (filtro.busca ?? "").trim().toLowerCase();
      return s.planos.filter((p) => {
        if (pode(quem, "gerenciar_planos"))
          return !0;
        let i = s.inspecoes.find((x) => x.id === p.inspecao_id);
        return !!i && podeVerInspecao(quem, i);
      }).map((p) => ({
        ...clone(p),
        situacao: situacao(p, hoje),
        avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "Formulário removido"
      })).filter((p) => (!filtro.situacao || p.situacao === filtro.situacao) && (!busca || [p.avaliado, p.modelo_snapshot.nome, p.responsavel_email, p.formulario].join(" ").toLowerCase().includes(busca))).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.modelo_snapshot.nome.localeCompare(b.modelo_snapshot.nome, "pt-BR"));
    },
    async planosDaInspecao(inspecao_id) {
      let s = await load(), hoje = hojeNaOrg();
      return s.planos.filter((p) => p.inspecao_id === inspecao_id).map((p) => ({ ...clone(p), situacao: situacao(p, hoje) }));
    },
    async novoLinkPlano(plano_id, quem, reenviarPara) {
      if (!pode(quem, "gerenciar_planos"))
        throw Error("Sem permissão.");
      await amb.atraso();
      let token = novoToken(), hash = await sha256(token), link = linkPublico(token);
      return await mutate("planos", (s) => {
        let p = s.planos.find((x) => x.id === plano_id);
        if (!p)
          throw Error("Plano não encontrado.");
        if (p.token_hash = hash, reenviarPara) {
          if (!/^\S+@\S+\.\S+$/.test(reenviarPara))
            throw Error("E-mail inválido.");
          p.responsavel_email = reenviarPara, p.ultimo_email_em = nowISO(), filaEmail(s, emailPlano(s, p, link, hash));
        }
        p.updated_at = nowISO();
      }), { link };
    },
    async planoPorToken(token) {
      await amb.atraso();
      let hash = await sha256(token), s = await load(), p = s.planos.find((x) => x.token_hash === hash);
      if (!p)
        throw Error("Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
      let i = s.inspecoes.find((x) => x.id === p.inspecao_id), todas = s.versoes.find((x) => x.id === i.formulario_versao_id).definicao.topicos.flatMap((t) => t.questoes), nc = p.questao_keys.map((k) => {
        let pos = todas.findIndex((x) => x.key === k), q = pos >= 0 ? todas[pos] : null;
        return { key: k, numero: pos + 1, titulo: q?.titulo ?? "Questão", resposta: i.respostas[k], questao: q, reincidente: !!i.resultado.questoes[k]?.reincidente };
      });
      return {
        plano: { ...clone(p), situacao: situacao(p, hojeNaOrg()) },
        org: ORG,
        avaliado: s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "",
        formulario: s.formularios.find((f) => f.id === p.formulario_id)?.nome ?? "",
        inspecao: { finalizada_em: i.finalizada_em, nota_pct: i.nota_pct, classificacao: i.classificacao, responsavel: s.membros.find((m) => m.id === i.responsavel_id)?.nome ?? "" },
        ncs: nc
      };
    },
    async responderPlano(token, dados) {
      await amb.atraso();
      let hash = await sha256(token);
      for (let f of dados.fotos)
        await amb.guardarAnexo(f.client_uuid, f.dataUrl);
      await mutate("planos", (s) => {
        let p = s.planos.find((x) => x.token_hash === hash);
        if (!p)
          throw Error("Este link não vale mais.");
        if (p.status === "finalizado")
          throw Error("Este plano já foi respondido.");
        if (p.status === "em_aprovacao")
          throw Error("A resposta já foi enviada e está em análise.");
        if (!dados.nome.trim())
          throw Error("Informe seu nome.");
        for (let nc of p.questao_keys) {
          let resp = { ...dados.respostas[nc] ?? {} };
          for (let f of dados.fotos.filter((x) => x.nc_key === nc)) {
            let a = resp[f.questao_key] ??= {};
            a.fotos = (a.fotos ?? 0) + 1;
          }
          if (evaluateForm(p.modelo_snapshot.definicao, resp).pendentes.length)
            throw Error("Ainda há perguntas obrigatórias sem resposta.");
          p.respostas[nc] = resp;
        }
        if (p.anexos = dados.fotos.map((f) => ({ client_uuid: f.client_uuid, questao_key: f.questao_key, nc_key: f.nc_key, tipo: "foto", mime: "image/jpeg", bytes: f.bytes })), p.respondido_por = dados.nome.trim(), p.respondido_em = nowISO(), p.modelo_snapshot.exige_aprovacao)
          p.status = "em_aprovacao";
        else
          p.status = "finalizado", p.finalizado_em = nowISO();
        p.updated_at = nowISO();
      });
    },
    async decidirPlano(quem, plano_id, decisao, comentario = "") {
      if (exigir(quem, "gerenciar_planos"), decisao === "reprovada" && comentario.trim().length < 3)
        throw Error("Diga o que falta na correção.");
      await amb.atraso();
      let token = novoToken(), hash = await sha256(token);
      return mutate("planos", (s) => {
        let p = s.planos.find((x) => x.id === plano_id);
        if (!p)
          throw Error("Plano não encontrado.");
        if (p.status !== "em_aprovacao")
          throw Error("Este plano não está esperando aprovação.");
        if (decisao === "aprovada")
          p.status = "finalizado", p.finalizado_em = nowISO(), p.aprovado_por = quem.id;
        else {
          (p.reprovacoes ??= []).push({ em: nowISO(), por: quem.id, comentario: comentario.trim(), respondido_por: p.respondido_por, respostas: clone(p.respostas) });
          let dias = s.planosModelo.find((m) => m.id === p.modelo_id)?.prazo_dias ?? 3;
          if (Object.assign(p, { status: "aberto", respostas: {}, anexos: [], respondido_por: void 0, respondido_em: null, prazo: somarDias2(hojeNaOrg(), dias), token_hash: hash }), p.responsavel_email) {
            p.ultimo_email_em = nowISO();
            let av = s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "";
            filaEmail(s, {
              idem_key: `plano-devolvido:${p.id}:${hash.slice(0, 16)}`,
              para: p.responsavel_email,
              assunto: `Correção devolvida: ${p.modelo_snapshot.nome} — ${av}`,
              texto: `A correção enviada não foi aceita: "${comentario.trim()}". Responda de novo até ${p.prazo.split("-").reverse().join("/")}.`,
              link: linkPublico(token)
            });
          }
        }
        return p.updated_at = nowISO(), p.status;
      });
    },
    async caixaDeSaida() {
      return await amb.atraso(), clone((await load()).emails).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    },
    async importarAvaliados(linhas, opts = {}) {
      await amb.atraso();
      let aplicar = (s) => {
        let r = { novos: 0, atualizados: 0, erros: [] }, codigosNoArquivo = /* @__PURE__ */ new Map;
        return linhas.forEach((l, k) => {
          let n = k + 2, nome = (l.nome ?? "").trim(), codigo = (l.codigo_externo ?? "").trim() || void 0;
          if (!nome) {
            r.erros.push({ linha: n, motivo: "sem nome" });
            return;
          }
          if (l.email && !/^\S+@\S+\.\S+$/.test(l.email.trim())) {
            r.erros.push({ linha: n, motivo: `e-mail inválido: ${l.email}` });
            return;
          }
          if (codigo) {
            if (codigosNoArquivo.has(codigo)) {
              r.erros.push({ linha: n, motivo: `código ${codigo} repetido (já está na linha ${codigosNoArquivo.get(codigo)})` });
              return;
            }
            codigosNoArquivo.set(codigo, n);
          }
          let existente = codigo ? s.avaliados.find((a) => a.codigo_externo === codigo) : s.avaliados.find((a) => !a.codigo_externo && a.nome.toLowerCase() === nome.toLowerCase()), extra = validarCampos(s.camposAvaliado, { ...existente?.campos ?? {}, ...l.campos ?? {} });
          if (extra.erros.length) {
            r.erros.push({ linha: n, motivo: extra.erros.join("; ") });
            return;
          }
          let dados = {
            campos: extra.valores,
            nome,
            codigo_externo: codigo,
            documento: l.documento?.trim() || void 0,
            email: l.email?.trim() || void 0,
            telefone: l.telefone?.trim() || void 0,
            endereco: l.endereco?.trim() || void 0
          };
          if (existente) {
            for (let [k2, v2] of Object.entries(dados))
              if (v2 !== void 0)
                existente[k2] = v2;
            existente.updated_at = nowISO(), r.atualizados++;
          } else
            s.avaliados.push({ ...dados, id: uuid(), org_id: ORG.id, ativo: !0, created_at: nowISO(), updated_at: nowISO() }), r.novos++;
        }), r;
      };
      if (opts.simular)
        return aplicar(clone(await load()));
      return mutate("avaliados", aplicar);
    },
    async aprovacoesPendentes(quem) {
      await amb.atraso();
      let s = await load();
      return s.inspecoes.filter((i) => i.status === "em_aprovacao" && aprovadoresDaEtapa(s, i).includes(quem.id) && i.responsavel_id !== quem.id).map((i) => ({
        ...clone(i),
        etapas: etapasDe(s, i).length,
        avaliado: s.avaliados.find((a) => a.id === i.avaliado_id)?.nome ?? "",
        formulario: s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "",
        responsavel: s.membros.find((m) => m.id === i.responsavel_id)?.nome ?? ""
      })).sort((a, b) => (a.finalizada_em ?? "").localeCompare(b.finalizada_em ?? ""));
    },
    async decisoesDe(quem) {
      await amb.atraso();
      let s = await load();
      return s.aprovacoes.filter((a) => a.aprovador_id === quem.id).map((a) => {
        let i = s.inspecoes.find((x) => x.id === a.inspecao_id);
        return { ...clone(a), status: i?.status ?? "completa", avaliado: s.avaliados.find((x) => x.id === i?.avaliado_id)?.nome ?? "", formulario: s.formularios.find((f) => f.id === i?.formulario_id)?.nome ?? "", nota_pct: i?.nota_pct ?? null };
      }).sort((a, b) => b.em.localeCompare(a.em));
    },
    async aprovacaoDaInspecao(id) {
      let s = await load(), i = s.inspecoes.find((x) => x.id === id);
      if (!i)
        throw Error("Inspeção não encontrada.");
      let nome = (mid) => s.membros.find((m) => m.id === mid)?.nome ?? "—";
      return etapasDe(s, i).map((e, k) => ({
        etapa: k + 1,
        aprovadores: e.aprovadores.map((a) => ({ id: a, nome: nome(a) })),
        decisao: s.aprovacoes.filter((a) => a.inspecao_id === id && a.etapa === k + 1).map((a) => ({ ...clone(a), aprovador: nome(a.aprovador_id) }))[0] ?? null,
        atual: i.status === "em_aprovacao" && i.aprovacao_etapa === k + 1
      }));
    },
    decidir(quem, inspecao_id, decisao, comentario = "") {
      return exigir(quem, "aprovar"), mutate("inspecoes", (s) => {
        let i = s.inspecoes.find((x) => x.id === inspecao_id);
        if (!i)
          throw Error("Inspeção não encontrada.");
        if (i.status !== "em_aprovacao")
          throw Error("Esta inspeção não está esperando aprovação.");
        if (i.responsavel_id === quem.id)
          throw Error("Quem aplicou não aprova a própria inspeção.");
        if (!aprovadoresDaEtapa(s, i).includes(quem.id))
          throw Error("Esta etapa não é sua.");
        if (decisao === "reprovada" && comentario.trim().length < 3)
          throw Error("Diga o motivo da reprovação.");
        let etapa = i.aprovacao_etapa ?? 1;
        if (s.aprovacoes.some((a) => a.inspecao_id === i.id && a.etapa === etapa))
          throw Error("Esta etapa já foi decidida.");
        s.aprovacoes.push({ id: uuid(), org_id: ORG.id, inspecao_id: i.id, etapa, aprovador_id: quem.id, decisao, comentario: comentario.trim() || void 0, em: nowISO() });
        let total = etapasDe(s, i).length;
        if (decisao === "reprovada")
          i.status = "reprovada", i.aprovacao_etapa = null;
        else if (etapa >= total)
          i.status = "aprovada", i.aprovacao_etapa = null;
        else
          i.aprovacao_etapa = etapa + 1, avisarAprovadores(s, i.id);
        return i.updated_at = nowISO(), log(s, i.id, quem.id, decisao, { etapa, de: total, comentario: comentario.trim() || void 0 }), i.status;
      });
    },
    gerarDadosDemo(quem) {
      if (!quem.is_master)
        return Promise.reject(Error("Só o dono da conta pode gerar dados de exemplo."));
      return mutate("inspecoes", (s) => {
        let n = 0;
        for (let h of historicoDemo(hojeNaOrg())) {
          if (s.inspecoes.some((i) => i.client_uuid === h.client_uuid))
            continue;
          if (processar(s, membroEm(s, h.responsavel_id), { ...h, respostas: h.respostas, status: "completa", anexos: [], device_id: "demo" }, h.finalizada_em).ok)
            n++;
        }
        return n;
      });
    },
    async painel(quem, filtro) {
      if (!pode(quem, "ver_painel"))
        throw Error("Você não tem acesso ao painel.");
      await amb.atraso();
      let s = await load(), dia = (iso) => dataNaOrg(iso), dur = (Date.parse(filtro.ate) - Date.parse(filtro.de)) / 86400000 + 1, antDe = somarDias(filtro.de, -dur), antAte = somarDias(filtro.de, -1), filtroCampos = Object.entries(filtro.campos ?? {}).filter(([, v]) => v), avOk = (id) => !filtroCampos.length || filtroCampos.every(([k, v]) => s.avaliados.find((a) => a.id === id)?.campos?.[k] === v), base = s.inspecoes.filter((i) => i.status !== "rascunho" && i.finalizada_em && podeVerInspecao(quem, i) && (!filtro.formulario_id || i.formulario_id === filtro.formulario_id) && avOk(i.avaliado_id)), no = (de, ate) => base.filter((i) => {
        let d = dia(i.finalizada_em);
        return d >= de && d <= ate;
      }), atual = no(filtro.de, filtro.ate), anterior = no(antDe, antAte), media = (xs) => {
        let v = xs.map((i) => i.nota_pct).filter((x) => x !== null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }, ncPor = (xs) => xs.length ? xs.reduce((a, i) => a + i.qtd_nao_conformidades, 0) / xs.length : null, agora = Date.now(), ocs = s.ocorrencias.flatMap((o) => {
        let a = s.agendamentos.find((x) => x.id === o.agendamento_id);
        if (!a || !podeVerAgendamento(quem, a) || filtro.formulario_id && a.formulario_id !== filtro.formulario_id)
          return [];
        let d = dia(o.previsto_em);
        return d >= filtro.de && d <= filtro.ate ? [situacaoOcorrencia(o, a, agora)] : [];
      }), cumpridas = ocs.filter((x) => x === "completa").length, atrasadas = ocs.filter((x) => x === "atrasada").length, segunda = (d) => somarDias(d, -(((/* @__PURE__ */ new Date(d + "T12:00:00Z")).getUTCDay() + 6) % 7)), semanas = [];
      for (let w = segunda(filtro.de);w <= filtro.ate; w = somarDias(w, 7)) {
        let xs = atual.filter((i) => segunda(dia(i.finalizada_em)) === w);
        semanas.push({ semana: w, nota: media(xs), qtd: xs.length });
      }
      let porAvaliado = [...new Set(atual.map((i) => i.avaliado_id))].map((id) => {
        let xs = atual.filter((i) => i.avaliado_id === id);
        return { id, nome: s.avaliados.find((a) => a.id === id)?.nome ?? "Avaliado removido", nota: media(xs), qtd: xs.length, ncs: xs.reduce((a, i) => a + i.qtd_nao_conformidades, 0) };
      }).sort((a, b) => (a.nota ?? 101) - (b.nota ?? 101) || a.nome.localeCompare(b.nome, "pt-BR")), titulos = /* @__PURE__ */ new Map, ncCont = /* @__PURE__ */ new Map;
      for (let i of atual) {
        let v = s.versoes.find((x) => x.id === i.formulario_versao_id), form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "";
        for (let q of v?.definicao.topicos.flatMap((t) => t.questoes) ?? [])
          titulos.set(i.formulario_id + "|" + q.key, q.titulo);
        for (let [k, r] of Object.entries(i.resultado.questoes)) {
          if (r.conforme === null)
            continue;
          let c = ncCont.get(i.formulario_id + "|" + k) ?? { n: 0, aplicaveis: 0, formulario: form };
          if (c.aplicaveis++, r.conforme === !1)
            c.n++;
          ncCont.set(i.formulario_id + "|" + k, c);
        }
      }
      let topNcs = [...ncCont.entries()].filter(([, c]) => c.n > 0).map(([k, c]) => ({ chave: k, titulo: titulos.get(k) ?? "Questão", formulario: c.formulario, n: c.n, pct: c.n / c.aplicaveis * 100 })).sort((a, b) => b.n - a.n || b.pct - a.pct).slice(0, 8);
      return {
        periodo: { de: filtro.de, ate: filtro.ate, anterior: { de: antDe, ate: antAte } },
        kpis: {
          inspecoes: { atual: atual.length, anterior: anterior.length },
          nota: { atual: media(atual), anterior: media(anterior) },
          ncs_por_inspecao: { atual: ncPor(atual), anterior: ncPor(anterior) },
          agenda: { cumpridas, atrasadas, pct: cumpridas + atrasadas ? cumpridas / (cumpridas + atrasadas) * 100 : null },
          planos_em_atraso: s.planos.filter((p) => situacao(p, hojeNaOrg()) === "em_atraso" && (!filtro.formulario_id || p.formulario_id === filtro.formulario_id) && base.some((i) => i.id === p.inspecao_id)).length
        },
        semanas,
        porAvaliado,
        topNcs,
        formularios: s.formularios.filter((f) => !f.arquivado).map((f) => ({ id: f.id, nome: f.nome })),
        camposFiltro: s.camposAvaliado.filter((c) => c.tipo === "lista").map((c) => ({ id: c.id, nome: c.nome, opcoes: c.opcoes ?? [] }))
      };
    },
    async rodarAgenda() {
      return rodarAgenda();
    },
    async listarOcorrencias(quem, filtro = {}) {
      await rodarAgenda(), await amb.atraso();
      let s = await load(), agora = Date.now(), busca = (filtro.busca ?? "").trim().toLowerCase(), nomeM = new Map(s.membros.map((x) => [x.id, x.nome]));
      return s.ocorrencias.flatMap((o) => {
        let a = s.agendamentos.find((x) => x.id === o.agendamento_id);
        if (!a || !podeVerAgendamento(quem, a))
          return [];
        let dia = dataNaOrg(o.previsto_em, a.fuso_horario);
        if (filtro.de && dia < filtro.de)
          return [];
        if (filtro.ate && dia > filtro.ate)
          return [];
        let situacao = situacaoOcorrencia(o, a, agora);
        if (filtro.situacao && situacao !== filtro.situacao)
          return [];
        let row = {
          ...clone(o),
          situacao,
          agendamento: clone(a),
          descricao: descreverRegra(a),
          formulario: s.formularios.find((f) => f.id === a.formulario_id)?.nome ?? "Formulário removido",
          avaliado: s.avaliados.find((x) => x.id === a.avaliado_id)?.nome ?? "Avaliado removido",
          responsaveis: a.responsaveis.map((id) => nomeM.get(id) ?? "—")
        };
        if (busca && ![row.formulario, row.avaliado, ...row.responsaveis].join(" ").toLowerCase().includes(busca))
          return [];
        return [row];
      }).sort((x, y) => x.previsto_em.localeCompare(y.previsto_em) || x.avaliado.localeCompare(y.avaliado, "pt-BR"));
    },
    async obterAgendamento(id) {
      let a = (await load()).agendamentos.find((x) => x.id === id);
      if (!a)
        throw Error("Agendamento não encontrado.");
      return clone(a);
    },
    async salvarAgendamento(quem, dados) {
      return exigir(quem, "gerenciar_agendamentos"), await amb.atraso(), await mutate("agenda", (s) => {
        let regra = {
          data_inicio: dados.data_inicio,
          horarios: dados.dia_inteiro ? [] : [...new Set(dados.horarios)].sort(),
          dia_inteiro: dados.dia_inteiro,
          fuso_horario: ORG.fuso_horario,
          recorrencia: dados.recorrencia,
          dias_semana: dados.recorrencia === "semanal" ? [...new Set(dados.dias_semana ?? [])].sort() : void 0,
          termino: dados.recorrencia === "nenhuma" ? "nunca" : dados.termino,
          termino_data: dados.termino === "data" ? dados.termino_data : void 0,
          termino_qtd: dados.termino === "quantidade" ? dados.termino_qtd : void 0
        }, problemas = validarRegra(regra), f = s.formularios.find((x) => x.id === dados.formulario_id && !x.arquivado);
        if (!f)
          problemas.push("Escolha um formulário.");
        else if (!f.versao_publicada_id)
          problemas.push("Este formulário ainda não foi publicado.");
        if (!s.avaliados.some((x) => x.id === dados.avaliado_id))
          problemas.push("Escolha o avaliado.");
        else if (f && f.avaliados_vinculados.length && !f.avaliados_vinculados.includes(dados.avaliado_id))
          problemas.push("Este formulário não vale para o avaliado escolhido.");
        if (!dados.responsaveis.length)
          problemas.push("Escolha quem vai aplicar.");
        let efetivos = resolverMembros(s.membros, s.funcoes, s.equipes);
        for (let id of dados.responsaveis) {
          let r = efetivos.find((x) => x.id === id);
          if (!r || !r.ativo)
            problemas.push("Uma das pessoas escolhidas não está mais ativa.");
          else if (!pode(r, "aplicar") || !podeFormulario(r, dados.formulario_id) || !podeAvaliado(r, dados.avaliado_id))
            problemas.push(`${r.nome} não tem acesso a este formulário ou avaliado. Libere em Permissões.`);
        }
        if (problemas.length)
          throw Error(problemas.join(" "));
        let a;
        if (dados.id) {
          let atual = s.agendamentos.find((x) => x.id === dados.id);
          if (!atual)
            throw Error("Agendamento não encontrado.");
          let agora = nowISO();
          if (s.ocorrencias = s.ocorrencias.filter((o) => !(o.agendamento_id === atual.id && o.status === "pendente" && o.previsto_em > agora)), Object.assign(atual, regra, { formulario_id: dados.formulario_id, avaliado_id: dados.avaliado_id, responsaveis: [...dados.responsaveis], ativo: !0, updated_at: agora }), delete atual.dias_semana, regra.dias_semana)
            atual.dias_semana = regra.dias_semana;
          a = atual;
        } else
          a = {
            ...regra,
            id: uuid(),
            org_id: ORG.id,
            formulario_id: dados.formulario_id,
            avaliado_id: dados.avaliado_id,
            responsaveis: [...dados.responsaveis],
            ativo: !0,
            materializado_ate: null,
            criado_por: quem.id,
            created_at: nowISO(),
            updated_at: nowISO()
          }, s.agendamentos.push(a);
        let geradas = materializar(s, a);
        return { agendamento: clone(a), geradas };
      });
    },
    inativarOcorrencia(quem, id, escopo, justificativa) {
      return mutate("agenda", (s) => {
        let o = s.ocorrencias.find((x) => x.id === id);
        if (!o)
          throw Error("Ocorrência não encontrada.");
        let a = s.agendamentos.find((x) => x.id === o.agendamento_id);
        if (!pode(quem, "gerenciar_agendamentos") && !a.responsaveis.includes(quem.id))
          throw Error("Você não tem permissão para isso.");
        if (justificativa.trim().length < 3)
          throw Error("Escreva o motivo.");
        if (o.status !== "pendente")
          throw Error("Só dá para inativar o que ainda está pendente.");
        let alvo = escopo === "esta" ? [o] : s.ocorrencias.filter((x) => x.agendamento_id === a.id && x.status === "pendente" && x.previsto_em >= o.previsto_em);
        for (let x of alvo)
          Object.assign(x, { status: "inativa", justificativa: justificativa.trim(), inativada_por: quem.id, updated_at: nowISO() });
        if (escopo === "seguintes")
          a.ativo = !1, a.updated_at = nowISO();
        return alvo.length;
      });
    },
    async listarPessoas() {
      return await amb.atraso(), clone((await load()).membros).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
    },
    convidarPessoa(quem, dados) {
      exigir(quem, "gerenciar_permissoes");
      let nome = dados.nome.trim(), email = dados.email.trim().toLowerCase();
      if (!nome)
        return Promise.reject(Error("Informe o nome."));
      if (!/^\S+@\S+\.\S+$/.test(email))
        return Promise.reject(Error("Informe um e-mail válido."));
      return mutate("membros", (s) => {
        if (s.membros.some((m) => m.email.toLowerCase() === email))
          throw Error("Já existe uma pessoa com esse e-mail.");
        if (!s.funcoes.some((f) => f.id === dados.funcao_id))
          throw Error("Escolha uma função.");
        let m = { id: uuid(), org_id: ORG.id, nome, email, funcao_id: dados.funcao_id, is_master: !1, ativo: !0, acesso: clone(ACESSO_PESSOA_NOVA), created_at: nowISO() };
        return s.membros.push(m), filaEmail(s, {
          idem_key: `convite:${m.id}`,
          para: email,
          assunto: `Você foi convidado para ${ORG.nome} no Inspeta`,
          texto: `${quem.nome} liberou seu acesso como ${s.funcoes.find((f) => f.id === m.funcao_id)?.nome}. Entre com este e-mail e crie sua senha no primeiro acesso.`,
          link: `${amb.urlApp()}#/entrar`
        }), clone(m);
      });
    },
    salvarPessoa(quem, id, patch) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let m = s.membros.find((x) => x.id === id);
        if (!m)
          throw Error("Pessoa não encontrada.");
        if (m.is_master && (patch.funcao_id !== void 0 && patch.funcao_id !== m.funcao_id || patch.ativo === !1))
          throw Error("O dono da conta é sempre Administrador e não pode ser desativado.");
        if (patch.ativo === !1 && id === quem.id)
          throw Error("Você não pode desativar o seu próprio acesso.");
        if (patch.funcao_id && !s.funcoes.some((f) => f.id === patch.funcao_id))
          throw Error("Função não encontrada.");
        if (patch.nome !== void 0 && !patch.nome.trim())
          throw Error("Informe o nome.");
        if (patch.acesso)
          patch = { ...patch, acesso: limparAcesso(s, patch.acesso, id) };
        return Object.assign(m, clone(patch)), clone(m);
      });
    },
    async listarFuncoes() {
      await amb.atraso();
      let s = await load();
      return s.funcoes.map((f) => ({ ...clone(f), qtd_pessoas: s.membros.filter((m) => m.ativo && m.funcao_id === f.id).length }));
    },
    criarFuncao(quem, nome, copiarDe) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let n = nome.trim();
        if (!n)
          throw Error("Dê um nome à função.");
        if (s.funcoes.some((f) => f.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        let base = s.funcoes.find((f) => f.id === copiarDe), f = { id: uuid(), nome: n, acoes: base ? [...base.acoes] : ["aplicar"] };
        return s.funcoes.push(f), clone(f);
      });
    },
    salvarFuncao(quem, f) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let atual = s.funcoes.find((x) => x.id === f.id);
        if (!atual)
          throw Error("Função não encontrada.");
        if (atual.sistema)
          throw Error("A função Administrador tem todas as ações e não pode ser alterada.");
        let n = f.nome.trim();
        if (!n)
          throw Error("Dê um nome à função.");
        if (s.funcoes.some((x) => x.id !== f.id && x.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        return atual.nome = n, atual.acoes = [...new Set(f.acoes)], clone(atual);
      });
    },
    excluirFuncao(quem, id) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let f = s.funcoes.find((x) => x.id === id);
        if (!f)
          return;
        if (f.sistema)
          throw Error("A função Administrador não pode ser excluída.");
        let n = s.membros.filter((m) => m.funcao_id === id).length;
        if (n)
          throw Error(`Há ${n} ${n === 1 ? "pessoa" : "pessoas"} com esta função. Troque a função delas antes de excluir.`);
        s.funcoes = s.funcoes.filter((x) => x.id !== id);
      });
    },
    async listarEquipes() {
      return await amb.atraso(), clone((await load()).equipes).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    criarEquipe(quem, nome) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let n = nome.trim();
        if (!n)
          throw Error("Dê um nome à equipe.");
        if (s.equipes.some((e) => e.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        let e = { id: uuid(), org_id: ORG.id, nome: n, membros: [], acesso: clone(ACESSO_EQUIPE_NOVA) };
        return s.equipes.push(e), clone(e);
      });
    },
    salvarEquipe(quem, e) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        let atual = s.equipes.find((x) => x.id === e.id);
        if (!atual)
          throw Error("Equipe não encontrada.");
        let n = e.nome.trim();
        if (!n)
          throw Error("Dê um nome à equipe.");
        if (s.equipes.some((x) => x.id !== e.id && x.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        return atual.nome = n, atual.membros = [...new Set(e.membros)].filter((id) => s.membros.some((m) => m.id === id)), atual.acesso = limparAcesso(s, e.acesso), clone(atual);
      });
    },
    excluirEquipe(quem, id) {
      return exigir(quem, "gerenciar_permissoes"), mutate("membros", (s) => {
        s.equipes = s.equipes.filter((e) => e.id !== id);
        for (let a of [...s.membros.map((m) => m.acesso), ...s.equipes.map((e) => e.acesso)])
          a.ver_equipes = a.ver_equipes.filter((x) => x !== id);
      });
    },
    async _podeVer(quem, tipo, id) {
      let s = await load(), verInsp = (i) => !!i && (podeVerInspecao(quem, i) || ehAprovador(s, quem, i));
      if (tipo === "inspecao")
        return verInsp(s.inspecoes.find((i) => i.id === id));
      if (id.startsWith("logo-"))
        return !0;
      let dono = s.inspecoes.find((i) => i.anexos.some((a) => a.client_uuid === id));
      if (dono)
        return verInsp(dono);
      let plano = s.planos.find((p) => p.anexos.some((a) => a.client_uuid === id));
      if (plano)
        return pode(quem, "gerenciar_planos") || verInsp(s.inspecoes.find((i) => i.id === plano.inspecao_id));
      return !1;
    },
    async _membroPorEmail(email) {
      let s = await load();
      return resolverMembros(s.membros, s.funcoes, s.equipes).find((m) => m.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async _membrosResolvidos() {
      let s = await load();
      return resolverMembros(s.membros, s.funcoes, s.equipes);
    },
    async _reset() {
      await amb.local.limpar(), amb.aviso("reset");
    }
  };
  function limparAcesso(s, a, dono) {
    let fs = new Set(s.formularios.map((f) => f.id)), as = new Set(s.avaliados.map((x) => x.id)), ms = new Set(s.membros.map((m) => m.id)), es = new Set(s.equipes.map((e) => e.id));
    return {
      formularios: a.formularios === "todos" ? "todos" : [...new Set(a.formularios)].filter((x) => fs.has(x)),
      avaliados: a.avaliados === "todos" ? "todos" : [...new Set(a.avaliados)].filter((x) => as.has(x)),
      ver_membros: [...new Set(a.ver_membros)].filter((x) => ms.has(x) && x !== dono),
      ver_equipes: [...new Set(a.ver_equipes)].filter((x) => es.has(x))
    };
  }
  function podeVerAgendamento(m, a) {
    return pode(m, "gerenciar_agendamentos") || pode(m, "ver_todas_inspecoes") || a.responsaveis.some((id) => id === m.id || m.ve_inspecoes_de.includes(id));
  }
  function dataNaOrg(iso, fuso = ORG.fuso_horario) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
  }
  function materializar(s, a, agora = Date.now()) {
    if (!a.ativo)
      return 0;
    let hoje = dataNaOrg(new Date(agora).toISOString(), a.fuso_horario), ate = somarDias(hoje, 14), n = 0;
    for (let previsto_em of instantesDaRegra(a, hoje, ate)) {
      if (Date.parse(limiteDaOcorrencia(previsto_em, a)) <= agora)
        continue;
      if (s.ocorrencias.some((o) => o.agendamento_id === a.id && o.previsto_em === previsto_em))
        continue;
      s.ocorrencias.push({ id: uuid(), org_id: ORG.id, agendamento_id: a.id, previsto_em, status: "pendente", created_at: nowISO(), updated_at: nowISO() }), n++;
    }
    return a.materializado_ate = ate, n;
  }
  function rodarAgenda() {
    return amb.exclusivo(async () => {
      let s = await load(), hoje = hojeNaOrg(), pendentes = s.agendamentos.filter((a) => a.ativo && a.materializado_ate !== somarDias(hoje, 14)), n = 0;
      for (let a of pendentes)
        n += materializar(s, a);
      if (pendentes.length)
        await save(s, n ? "agenda" : "agenda-silencioso");
      return n;
    });
  }
  function cumprirOcorrencia(s, m, e, inspecaoId) {
    if (!e.ocorrencia_id)
      return null;
    let o = s.ocorrencias.find((x) => x.id === e.ocorrencia_id), a = o && s.agendamentos.find((x) => x.id === o.agendamento_id);
    if (!o || !a || !a.responsaveis.includes(m.id) || a.formulario_id !== e.formulario_id || a.avaliado_id !== e.avaliado_id)
      return null;
    if (o.status === "completa" && o.inspecao_id && o.inspecao_id === inspecaoId)
      return o.id;
    if (o.status !== "pendente")
      return null;
    return o.status = "completa", o.updated_at = nowISO(), o.id;
  }
  function etapasDe(s, i) {
    return s.versoes.find((v) => v.id === i.formulario_versao_id)?.definicao.config.aprovacao?.etapas ?? [];
  }
  function aprovadoresDaEtapa(s, i) {
    return i.status === "em_aprovacao" ? etapasDe(s, i)[(i.aprovacao_etapa ?? 1) - 1]?.aprovadores ?? [] : [];
  }
  function ehAprovador(s, m, i) {
    return pode(m, "aprovar") && etapasDe(s, i).some((e) => e.aprovadores.includes(m.id));
  }
  function avisarAprovadores(s, inspecao_id) {
    let i = s.inspecoes.find((x) => x.id === inspecao_id), av = s.avaliados.find((a) => a.id === i.avaliado_id)?.nome ?? "", form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "";
    for (let mid of aprovadoresDaEtapa(s, i)) {
      let m = s.membros.find((x) => x.id === mid);
      if (!m?.ativo || mid === i.responsavel_id)
        continue;
      filaEmail(s, {
        idem_key: `aprovacao:${i.id}:${i.aprovacao_etapa}:${mid}`,
        para: m.email,
        assunto: `Aprovação pendente: ${form} — ${av}`,
        texto: `A inspeção em ${av} (nota ${i.nota_pct === null ? "—" : String(i.nota_pct).replace(".", ",") + "%"}) espera a sua decisão na etapa ${i.aprovacao_etapa} de ${etapasDe(s, i).length}.`,
        link: `${amb.urlApp()}#/web/inspecoes/${i.id}`
      });
    }
  }
  function hojeNaOrg() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ORG.fuso_horario }).format(/* @__PURE__ */ new Date);
  }
  function somarDias2(iso, dias) {
    let d = /* @__PURE__ */ new Date(iso + "T12:00:00Z");
    return d.setUTCDate(d.getUTCDate() + dias), d.toISOString().slice(0, 10);
  }
  function situacao(p, hoje) {
    return p.status === "aberto" && p.prazo < hoje ? "em_atraso" : p.status;
  }
  function novoToken() {
    let b = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  async function sha256(t) {
    let d = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(t));
    return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
  }
  function linkPublico(token) {
    return `${amb.urlApp()}#/p/${token}`;
  }
  function filaEmail(s, e) {
    if (s.emails.some((x) => x.idem_key === e.idem_key))
      return !1;
    return s.emails.push({ ...e, id: uuid(), criado_em: nowISO(), status: e.para ? amb.enviaEmails ? "pendente" : "enviado" : "sem_destinatario" }), !0;
  }
  function emailPlano(s, p, link, hash) {
    let av = s.avaliados.find((a) => a.id === p.avaliado_id)?.nome ?? "", prazo = p.prazo.split("-").reverse().join("/");
    return {
      idem_key: `plano:${p.id}:${hash.slice(0, 16)}`,
      para: p.responsavel_email ?? "",
      assunto: `Plano de ação: ${p.modelo_snapshot.nome} — ${av}`,
      texto: `A inspeção em ${av} encontrou ${p.questao_keys.length} ${p.questao_keys.length === 1 ? "não conformidade" : "não conformidades"} que precisam de correção até ${prazo}.
Abra o link para registrar o que foi feito. Não precisa de senha.`,
      link
    };
  }
  async function posFinalizacao(inspecao_id) {
    let s0 = await load(), i = s0.inspecoes.find((x) => x.id === inspecao_id);
    if (!i || i.status === "rascunho")
      return;
    let v = s0.versoes.find((x) => x.id === i.formulario_versao_id), qByKey = new Map(v.definicao.topicos.flatMap((t) => t.questoes).map((q) => [q.key, q])), grupos = [];
    for (let k of i.resultado.nao_conformidades) {
      let mid = qByKey.get(k)?.plano_acao_modelo_id, modelo = mid ? s0.planosModelo.find((m) => m.id === mid) : void 0;
      if (!modelo)
        continue;
      let g = modelo.agrupamento === "por_inspecao" ? grupos.find((x) => x.modelo.id === modelo.id) : void 0;
      if (g)
        g.keys.push(k);
      else
        grupos.push({ modelo, keys: [k] });
    }
    let tokens = await Promise.all(grupos.map(async () => {
      let t = novoToken();
      return { t, h: await sha256(t) };
    }));
    await mutate("planos", (s) => {
      let av = s.avaliados.find((a) => a.id === i.avaliado_id);
      grupos.forEach((g, n) => {
        let chave = [...g.keys].sort().join(",");
        if (s.planos.some((p) => p.inspecao_id === i.id && p.modelo_id === g.modelo.id && [...p.questao_keys].sort().join(",") === chave))
          return;
        let para = g.modelo.destinatario === "fixo" ? g.modelo.email_fixo ?? null : av?.email ?? null, p = {
          id: uuid(),
          org_id: ORG.id,
          modelo_id: g.modelo.id,
          modelo_snapshot: { nome: g.modelo.nome, definicao: clone(g.modelo.definicao), exige_aprovacao: !!g.modelo.exige_aprovacao },
          inspecao_id: i.id,
          avaliado_id: i.avaliado_id,
          formulario_id: i.formulario_id,
          questao_keys: g.keys,
          responsavel_email: para,
          token_hash: tokens[n].h,
          prazo: somarDias2(hojeNaOrg(), g.modelo.prazo_dias),
          status: "aberto",
          respostas: {},
          anexos: [],
          finalizado_em: null,
          ultimo_email_em: para ? nowISO() : null,
          created_at: nowISO(),
          updated_at: nowISO()
        };
        s.planos.push(p), filaEmail(s, emailPlano(s, p, linkPublico(tokens[n].t), tokens[n].h));
      });
      let cfg = v.definicao.config.relatorio?.emails, destinos = /* @__PURE__ */ new Set;
      if (cfg?.avaliado && av?.email)
        destinos.add(av.email);
      for (let e of cfg?.extras ?? [])
        if (e.trim())
          destinos.add(e.trim());
      let form = s.formularios.find((f) => f.id === i.formulario_id)?.nome ?? "", novos = [];
      for (let para of destinos)
        if (filaEmail(s, {
          idem_key: `relatorio:${i.id}:${para}`,
          para,
          assunto: `Relatório: ${form} — ${av?.nome ?? ""} — ${i.nota_pct === null ? "sem nota" : String(i.nota_pct).replace(".", ",") + "%"}`,
          texto: `Segue o relatório da inspeção finalizada em ${new Date(i.finalizada_em ?? i.iniciada_em).toLocaleString("pt-BR", { timeZone: ORG.fuso_horario })}. ${i.qtd_nao_conformidades} não conformidade(s).`,
          anexo: { tipo: "relatorio_pdf", inspecao_id: i.id }
        }))
          novos.push(para);
      if (novos.length)
        log(s, i.id, null, "relatorio_enviado", { para: novos });
    });
  }
  return server;
}

// backend/repo.ts
var COLECOES = [
  "formularios",
  "versoes",
  "avaliados",
  "inspecoes",
  "eventos",
  "planosModelo",
  "planos",
  "emails",
  "membros",
  "funcoes",
  "equipes",
  "agendamentos",
  "ocorrencias",
  "aprovacoes",
  "camposAvaliado"
];
function estadoVazio() {
  return {
    v: 1,
    formularios: [],
    versoes: [],
    avaliados: [],
    inspecoes: [],
    eventos: [],
    eventoSeq: 0,
    planosModelo: [],
    planos: [],
    emails: [],
    membros: [],
    funcoes: [],
    equipes: [],
    agendamentos: [],
    ocorrencias: [],
    aprovacoes: [],
    camposAvaliado: []
  };
}
function anexosNoBanco(sql) {
  return {
    async get(orgId, id) {
      return (await sql`select data_url from anexos where org_id = ${orgId} and id = ${id}`)[0]?.data_url;
    },
    async set(orgId, id, dataUrl) {
      let bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
      await sql`insert into anexos (org_id, id, data_url, bytes) values (${orgId}, ${id}, ${dataUrl}, ${bytes})
        on conflict (org_id, id) do nothing`;
    },
    async presentes(orgId, ids) {
      if (!ids.length)
        return /* @__PURE__ */ new Set;
      let r = await sql`select id from anexos where org_id = ${orgId} and id = any(string_to_array(${ids.join(",")}, ','))`;
      return new Set(r.map((x) => x.id));
    }
  };
}
function ambientePg(sql, org, op) {
  let tx = null, foto = /* @__PURE__ */ new Map, seqLido = 0, q = () => tx ?? sql, memoria = /* @__PURE__ */ new Map, avisos = /* @__PURE__ */ new Set;
  return {
    org,
    avisos,
    enviaEmails: op.enviaEmails,
    async carregar() {
      let [linhas, orgs] = await Promise.all([
        q()`select colecao, id, dados from registros where org_id = ${org.id} order by seq`,
        q()`select contadores from orgs where id = ${org.id}`
      ]), s = estadoVazio();
      foto = /* @__PURE__ */ new Map;
      for (let l of linhas) {
        let dados = typeof l.dados === "string" ? JSON.parse(l.dados) : l.dados;
        s[l.colecao].push(dados), foto.set(`${l.colecao}:${l.id}`, JSON.stringify(dados));
      }
      let c = orgs[0]?.contadores;
      return s.eventoSeq = seqLido = Number((typeof c === "string" ? JSON.parse(c) : c)?.eventoSeq ?? 0), s;
    },
    async gravar(s) {
      let vistos = /* @__PURE__ */ new Set;
      for (let col of COLECOES)
        for (let item of s[col]) {
          let k = `${col}:${item.id}`;
          vistos.add(k);
          let json = JSON.stringify(item);
          if (foto.get(k) === json)
            continue;
          await q()`insert into registros (org_id, colecao, id, dados) values (${org.id}, ${col}, ${String(item.id)}, ${json}::text::jsonb)
            on conflict (org_id, colecao, id) do update set dados = excluded.dados, atualizado = now()`, foto.set(k, json);
        }
      for (let k of [...foto.keys()]) {
        if (vistos.has(k))
          continue;
        let i = k.indexOf(":");
        await q()`delete from registros where org_id = ${org.id} and colecao = ${k.slice(0, i)} and id = ${k.slice(i + 1)}`, foto.delete(k);
      }
      if (s.eventoSeq !== seqLido)
        await q()`update orgs set contadores = jsonb_set(contadores, '{eventoSeq}', ${String(s.eventoSeq)}::text::jsonb) where id = ${org.id}`, seqLido = s.eventoSeq;
    },
    async exclusivo(fn) {
      if (tx)
        return fn();
      return sql.begin(async (t) => {
        await t`select pg_advisory_xact_lock(hashtext(${org.id}))`, tx = t;
        try {
          return await fn();
        } finally {
          tx = null;
        }
      });
    },
    estadoInicial: estadoVazio,
    anexo: (id) => op.anexos.get(org.id, id),
    guardarAnexo: (id, d) => op.anexos.set(org.id, id, d),
    anexosPresentes: (ids) => op.anexos.presentes(org.id, ids),
    urlApp: () => op.urlApp,
    atraso: async () => {
      return;
    },
    aviso: (t) => {
      avisos.add(t);
    },
    exigirRede: () => {
      return;
    },
    local: { get: (k) => memoria.get(k) ?? null, set: (k, v) => {
      memoria.set(k, v);
    }, del: (k) => {
      memoria.delete(k);
    }, limpar: async () => {
      memoria.clear();
    } }
  };
}
function servidorDaOrg(sql, org, op) {
  let amb = ambientePg(sql, org, op);
  return { servidor: criarServidor(amb), avisos: amb.avisos };
}

// backend/api.ts
var M = (acao, extra = {}) => ({ acao, ...extra }), METODOS = {
  listarFormularios: M("membro"),
  obterFormulario: M("membro"),
  obterVersao: M("membro"),
  criarFormulario: M("gerenciar_formularios"),
  salvarRascunho: M("gerenciar_formularios"),
  publicar: M("gerenciar_formularios", { quemId: 1 }),
  salvarLogo: M("gerenciar_formularios"),
  layoutRelatorio: M("membro"),
  listarAvaliados: M("membro"),
  listarCamposAvaliado: M("membro"),
  criarAvaliado: M("gerenciar_avaliados"),
  salvarAvaliado: M("gerenciar_avaliados"),
  importarAvaliados: M("gerenciar_avaliados"),
  salvarCamposAvaliado: M("gerenciar_avaliados", { quem: 0 }),
  listarInspecoes: M("membro", { quem: 0 }),
  obterInspecao: M("membro", { quem: 0 }),
  eventos: M("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  aprovacaoDaInspecao: M("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  planosDaInspecao: M("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  registrarRelatorio: M("membro", { quemId: 1, ver: { tipo: "inspecao", arg: 0 } }),
  anexo: M("membro", { ver: { tipo: "anexo", arg: 0 } }),
  pacote: M("aplicar", { quemId: 0 }),
  enviarAnexo: M("aplicar", { quemId: 0 }),
  enviarInspecoes: M("aplicar", { quemId: 0 }),
  listarPlanosModelo: M("membro"),
  obterPlanoModelo: M("membro"),
  criarPlanoModelo: M("gerenciar_planos"),
  salvarPlanoModelo: M("gerenciar_planos"),
  listarPlanos: M("membro", { quem: 0 }),
  novoLinkPlano: M("gerenciar_planos", { quem: 1 }),
  decidirPlano: M("gerenciar_planos", { quem: 0 }),
  caixaDeSaida: M("gerenciar_planos"),
  aprovacoesPendentes: M("membro", { quem: 0 }),
  decisoesDe: M("membro", { quem: 0 }),
  decidir: M("aprovar", { quem: 0 }),
  gerarDadosDemo: M("dono", { quem: 0 }),
  painel: M("ver_painel", { quem: 0 }),
  rodarAgenda: M("membro"),
  listarOcorrencias: M("membro", { quem: 0 }),
  obterAgendamento: M("membro"),
  salvarAgendamento: M("gerenciar_agendamentos", { quem: 0 }),
  inativarOcorrencia: M("membro", { quem: 0 }),
  listarPessoas: M("membro"),
  listarFuncoes: M("membro"),
  listarEquipes: M("membro"),
  convidarPessoa: M("gerenciar_permissoes", { quem: 0 }),
  salvarPessoa: M("gerenciar_permissoes", { quem: 0 }),
  criarFuncao: M("gerenciar_permissoes", { quem: 0 }),
  salvarFuncao: M("gerenciar_permissoes", { quem: 0 }),
  excluirFuncao: M("gerenciar_permissoes", { quem: 0 }),
  criarEquipe: M("gerenciar_permissoes", { quem: 0 }),
  salvarEquipe: M("gerenciar_permissoes", { quem: 0 }),
  excluirEquipe: M("gerenciar_permissoes", { quem: 0 })
}, PUBLICOS = /* @__PURE__ */ new Set(["planoPorToken", "responderPlano"]);

class ErroHttp extends Error {
  status;
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}
async function sha256(t) {
  let d = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(t));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
function criarApi(cfg) {
  let cacheUsuario = /* @__PURE__ */ new Map, agora = cfg.agora ?? Date.now;
  async function usuarioDoToken(jwt) {
    let c = cacheUsuario.get(jwt);
    if (c && c.ate > agora())
      return c.email;
    let r = await fetch(`${cfg.authUrl}/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: cfg.anonKey } });
    if (!r.ok)
      throw new ErroHttp(401, "Sua sessão expirou. Entre de novo.");
    let u = await r.json();
    if (!u.email)
      throw new ErroHttp(401, "Sessão sem e-mail.");
    if (cacheUsuario.size > 500)
      cacheUsuario.clear();
    return cacheUsuario.set(jwt, { email: u.email.toLowerCase(), ate: agora() + 60000 }), u.email.toLowerCase();
  }
  async function orgDoEmail(email) {
    let r = await cfg.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'membros' and lower(r.dados->>'email') = ${email}
      order by coalesce((r.dados->>'ativo')::boolean, true) desc, o.criado_em limit 1`;
    if (!r[0])
      throw new ErroHttp(403, "Este e-mail não tem acesso a nenhuma conta do Inspeta. Peça um convite ao administrador.");
    return { id: r[0].id, nome: r[0].nome, fuso_horario: r[0].fuso_horario };
  }
  async function orgDoToken(token) {
    let h = await sha256(String(token)), r = await cfg.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'planos' and r.dados->>'token_hash' = ${h} limit 1`;
    if (!r[0])
      throw new ErroHttp(404, "Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
    return { id: r[0].id, nome: r[0].nome, fuso_horario: r[0].fuso_horario };
  }
  async function convidar(email) {
    if (!cfg.serviceKey)
      return;
    let r = await fetch(`${cfg.authUrl}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.serviceKey}`, apikey: cfg.serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, data: {}, redirect_to: cfg.urlApp })
    });
    if (!r.ok && r.status !== 422)
      console.error("convite falhou", r.status);
  }
  function cors(req) {
    let o = req.headers.get("Origin") ?? "";
    return {
      "Access-Control-Allow-Origin": !cfg.origens?.length || cfg.origens.includes(o) ? o || "*" : "null",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin"
    };
  }
  let json = (req, status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) } });
  return async (req) => {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== "POST")
      return json(req, 405, { ok: !1, erro: "Use POST." });
    let corpo;
    try {
      let txt = await req.text();
      if (txt.length > 20971520)
        throw new ErroHttp(413, "Envio grande demais (máx. 20 MB).");
      corpo = JSON.parse(txt);
    } catch (e) {
      return json(req, e instanceof ErroHttp ? e.status : 400, { ok: !1, erro: e instanceof ErroHttp ? e.message : "Corpo inválido." });
    }
    let metodo = String(corpo.metodo ?? ""), args = Array.isArray(corpo.args) ? [...corpo.args] : [];
    try {
      if (PUBLICOS.has(metodo)) {
        let org = await orgDoToken(String(args[0] ?? "")), { servidor, avisos } = servidorDaOrg(cfg.sql, org, { urlApp: cfg.urlApp, anexos: cfg.anexos, enviaEmails: cfg.enviaEmails }), fn = servidor[metodo], valor = await fn(...args);
        return json(req, 200, { ok: !0, valor, avisos: [...avisos] });
      }
      let auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer "))
        throw new ErroHttp(401, "Entre para continuar.");
      let email = await usuarioDoToken(auth.slice(7)), org = await orgDoEmail(email), { servidor, avisos } = servidorDaOrg(cfg.sql, org, { urlApp: cfg.urlApp, anexos: cfg.anexos, enviaEmails: cfg.enviaEmails }), quem = await servidor._membroPorEmail(email);
      if (!quem || !quem.ativo)
        throw new ErroHttp(403, "Este acesso foi desativado. Fale com o administrador da conta.");
      if (metodo === "eu")
        return json(req, 200, { ok: !0, valor: { membro: quem, membros: await servidor._membrosResolvidos(), org } });
      let regra = METODOS[metodo];
      if (!regra)
        throw new ErroHttp(404, `Operação desconhecida: ${metodo}`);
      if (regra.acao === "dono" ? !quem.is_master : regra.acao !== "membro" && !pode(quem, regra.acao))
        throw new ErroHttp(403, "Você não tem permissão para isso.");
      if (regra.quem !== void 0)
        args[regra.quem] = quem;
      if (regra.quemId !== void 0)
        args[regra.quemId] = quem.id;
      if (regra.ver && !await servidor._podeVer(quem, regra.ver.tipo, String(args[regra.ver.arg] ?? "")))
        throw new ErroHttp(404, regra.ver.tipo === "inspecao" ? "Inspeção não encontrada." : "Arquivo não encontrado.");
      let valor = await servidor[metodo].apply(servidor, args);
      if (metodo === "convidarPessoa" && valor && typeof valor === "object" && "email" in valor)
        await convidar(String(valor.email));
      if (avisos.size && metodo !== "rodarAgenda")
        await cfg.sql`insert into auditoria (org_id, membro_id, metodo) values (${org.id}, ${quem.id}, ${metodo})`;
      let extra = avisos.has("membros") ? { membros: await servidor._membrosResolvidos() } : {};
      return json(req, 200, { ok: !0, valor: valor ?? null, avisos: [...avisos], ...extra });
    } catch (e) {
      if (e instanceof ErroHttp)
        return json(req, e.status, { ok: !1, erro: e.message });
      let msg = e instanceof Error ? e.message : String(e), interno = !(e instanceof Error && e.constructor === Error);
      if (interno)
        console.error(metodo, e);
      return json(req, interno ? 500 : 400, { ok: !1, erro: interno ? "Erro no servidor. Tente de novo em instantes." : msg });
    }
  };
}

// backend/funcao-api.ts
var env = (k) => Deno.env.get(k) ?? "", sql = postgres(env("SUPABASE_DB_URL"), { prepare: !1, max: 3, idle_timeout: 20 }), handler = criarApi({
  sql,
  authUrl: `${env("SUPABASE_URL")}/auth/v1`,
  anonKey: env("SUPABASE_ANON_KEY"),
  serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  urlApp: env("APP_URL"),
  origens: env("ORIGENS").split(",").map((x) => x.trim()).filter(Boolean),
  anexos: anexosNoBanco(sql),
  enviaEmails: !!env("RESEND_API_KEY")
});
Deno.serve(handler);
