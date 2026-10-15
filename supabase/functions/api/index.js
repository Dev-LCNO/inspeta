// backend/funcao-api.ts
import Xe from "npm:postgres@3.4.5";

// app/src/data/acesso.ts
var Me = { id: "", nome: "Sem função", acoes: [] };
function oe(a, i) {
  if (a === "todos" || i === "todos")
    return "todos";
  return [.../* @__PURE__ */ new Set([...a, ...i])];
}
function co(a, i, d) {
  let u = (v) => d.filter((m) => v.includes(m.id)).flatMap((m) => m.membros);
  return a.map((v) => {
    let m = i.find((h) => h.id === v.funcao_id) ?? Me, p = d.filter((h) => h.membros.includes(v.id)), _ = [v.acesso, ...p.map((h) => h.acesso)], q = _.reduce((h, y) => oe(h, y.formularios), []), b = _.reduce((h, y) => oe(h, y.avaliados), []), g = /* @__PURE__ */ new Set;
    for (let h of _) {
      for (let y of h.ver_membros)
        g.add(y);
      for (let y of u(h.ver_equipes))
        g.add(y);
    }
    return g.delete(v.id), {
      id: v.id,
      org_id: v.org_id,
      nome: v.nome,
      email: v.email,
      funcao_id: m.id,
      funcao: m.nome,
      acoes: v.is_master ? [.../* @__PURE__ */ new Set([...m.acoes])] : [...m.acoes],
      is_master: v.is_master,
      ativo: v.ativo,
      equipes: p.map((h) => h.id),
      formularios_permitidos: q,
      avaliados_permitidos: b,
      ve_inspecoes_de: [...g]
    };
  });
}
var ee = { formularios: [], avaliados: "todos", ver_membros: [], ver_equipes: [] }, ae = { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] };
// packages/form-engine/src/formula.ts
class ao extends Error {
}
function re(a) {
  let i = [], d = 0;
  while (d < a.length) {
    let u = a[d];
    if (u === " " || u === "\t") {
      d++;
      continue;
    }
    if (u === "[") {
      let v = a.indexOf("]", d);
      if (v < 0)
        throw new ao("colchete sem fechar");
      let m = Number(a.slice(d + 1, v).trim());
      if (!Number.isInteger(m) || m < 1)
        throw new ao(`referência inválida: ${a.slice(d, v + 1)}`);
      i.push({ t: "ref", v: m }), d = v + 1;
      continue;
    }
    if (/[0-9.,]/.test(u)) {
      let v = d;
      while (v < a.length && /[0-9.,]/.test(a[v]))
        v++;
      let m = a.slice(d, v).replace(",", "."), p = Number(m);
      if (!Number.isFinite(p))
        throw new ao(`número inválido: ${m}`);
      i.push({ t: "num", v: p }), d = v;
      continue;
    }
    if (u === "+" || u === "-" || u === "*" || u === "/") {
      i.push({ t: "op", v: u }), d++;
      continue;
    }
    if (u === "x" || u === "×") {
      i.push({ t: "op", v: "*" }), d++;
      continue;
    }
    if (u === "(") {
      i.push({ t: "lp" }), d++;
      continue;
    }
    if (u === ")") {
      i.push({ t: "rp" }), d++;
      continue;
    }
    throw new ao(`caractere não permitido: "${u}"`);
  }
  return i;
}
function Oo(a) {
  return re(a).filter((i) => i.t === "ref").map((i) => i.v);
}
function Co(a, i) {
  let d = re(a), u = 0, v = !1, m = () => d[u];
  function p() {
    let g = d[u++];
    if (!g)
      throw new ao("fórmula incompleta");
    if (g.t === "num")
      return g.v;
    if (g.t === "ref") {
      let h = i(g.v);
      if (h === null || h === void 0 || !Number.isFinite(h))
        return v = !0, 0;
      return h;
    }
    if (g.t === "op" && g.v === "-")
      return -p();
    if (g.t === "lp") {
      let h = q(), y = d[u++];
      if (!y || y.t !== "rp")
        throw new ao("parêntese sem fechar");
      return h;
    }
    throw new ao("termo inesperado");
  }
  function _() {
    let g = p();
    for (;; ) {
      let h = m();
      if (h && h.t === "op" && (h.v === "*" || h.v === "/")) {
        u++;
        let y = p();
        g = h.v === "*" ? g * y : g / y;
      } else
        return g;
    }
  }
  function q() {
    let g = _();
    for (;; ) {
      let h = m();
      if (h && h.t === "op" && (h.v === "+" || h.v === "-")) {
        u++;
        let y = _();
        g = h.v === "+" ? g + y : g - y;
      } else
        return g;
    }
  }
  let b = q();
  if (u !== d.length)
    throw new ao("sobrou texto depois da fórmula");
  if (v)
    return null;
  if (!Number.isFinite(b))
    return null;
  return b;
}

// packages/form-engine/src/engine.ts
function go(a, i) {
  let d = 10 ** i;
  return Math.sign(a) * Math.round(Math.abs(a) * d + Number.EPSILON) / d;
}
function qo(a) {
  let i = /* @__PURE__ */ new Map, d = /* @__PURE__ */ new Map, u = /* @__PURE__ */ new Map, v = /* @__PURE__ */ new Map, m = 0;
  for (let p of a.topicos) {
    u.set(p.key, p);
    for (let _ of p.questoes) {
      m++, i.set(_.key, { q: _, topic: p, numero: m }), d.set(m, _);
      for (let q of _.opcoes ?? [])
        v.set(q.key, { option: q, question: _ });
    }
  }
  return { questions: i, byNumber: d, topics: u, options: v };
}
function Oe(a, i) {
  if (!i)
    return !1;
  if (i.na)
    return !0;
  switch (a.tipo) {
    case "escolha_simples":
    case "escolha_multipla":
      return (i.opcoes?.length ?? 0) > 0;
    case "numerica":
      return typeof i.numero === "number" && Number.isFinite(i.numero);
    case "texto":
      return (i.texto ?? "").trim().length > 0;
    case "data_hora":
      return !!i.data;
    case "assinatura":
      return !!i.assinatura;
    case "calculo":
      return !0;
  }
}
function Ce(a, i) {
  if (!i?.opcoes?.length)
    return [];
  let d = new Set(i.opcoes);
  return (a.opcoes ?? []).filter((u) => d.has(u.key));
}
function $e(a, i) {
  let d = a.numerica?.faixas_nota;
  if (!d?.length)
    return null;
  for (let u of d)
    if (u.ate === null || i <= u.ate)
      return u.pontos;
  return d[d.length - 1].pontos;
}
function ie(a) {
  switch (a.tipo) {
    case "escolha_simples": {
      let i = (a.opcoes ?? []).filter((d) => !d.na && typeof d.pontos === "number").map((d) => d.pontos);
      return i.length ? Math.max(...i) : null;
    }
    case "escolha_multipla": {
      let i = (a.opcoes ?? []).filter((d) => !d.na && typeof d.pontos === "number").map((d) => d.pontos);
      return i.length ? i.filter((d) => d > 0).reduce((d, u) => d + u, 0) : null;
    }
    case "numerica": {
      let i = a.numerica?.faixas_nota;
      return i?.length ? Math.max(...i.map((d) => d.pontos)) : null;
    }
    default:
      return null;
  }
}
function ne(a, i) {
  let d = a.numerica?.limite;
  if (!d || d.min == null && d.max == null)
    return null;
  if (d.min != null && i < d.min)
    return !1;
  if (d.max != null && i > d.max)
    return !1;
  return !0;
}
function te(a, i, d = qo(a)) {
  let u = /* @__PURE__ */ new Map, v = /* @__PURE__ */ new Set, m = (b) => {
    if (!b)
      return !0;
    if (!_(b.questao))
      return !1;
    return (i[b.questao]?.opcoes ?? []).includes(b.opcao);
  }, p = (b) => {
    let g = "t:" + b;
    if (u.has(g))
      return u.get(g);
    if (v.has(g))
      return !1;
    v.add(g);
    let h = m(d.topics.get(b)?.depende_de);
    return v.delete(g), u.set(g, h), h;
  };
  function _(b) {
    let g = "q:" + b;
    if (u.has(g))
      return u.get(g);
    let h = d.questions.get(b);
    if (!h)
      return !1;
    if (v.has(g))
      return !1;
    v.add(g);
    let y = p(h.topic.key) && m(h.q.depende_de);
    return v.delete(g), u.set(g, y), y;
  }
  let q = /* @__PURE__ */ new Set;
  for (let b of a.topicos)
    if (p(b.key))
      q.add(b.key);
  for (let b of d.questions.keys())
    if (_(b))
      q.add(b);
  return q;
}
function Ao(a, i, d = {}) {
  let u = qo(a), v = te(a, i, u), m = a.config.casas_decimais ?? 1, p = /* @__PURE__ */ new Map, _ = /* @__PURE__ */ new Set, q = (N) => {
    let M = u.byNumber.get(N);
    if (!M || !v.has(M.key))
      return null;
    if (M.tipo === "numerica") {
      let L = i[M.key]?.numero;
      return typeof L === "number" && !i[M.key]?.na ? L : null;
    }
    if (M.tipo === "calculo")
      return b(M);
    return null;
  };
  function b(N) {
    if (p.has(N.key))
      return p.get(N.key);
    if (_.has(N.key) || !N.calculo?.formula)
      return null;
    _.add(N.key);
    let M = null, L = N.calculo.valor_se_vazio;
    try {
      M = Co(N.calculo.formula, (to) => {
        let oo = q(to);
        return oo === null && L != null ? L : oo;
      });
    } catch {
      M = null;
    }
    return _.delete(N.key), p.set(N.key, M), M;
  }
  let g = {}, h = {}, y = 1, x = 0, E = 0, A = [], j = [], G = 0, z = 0;
  for (let N of a.topicos) {
    let M = 0, L = 0, to = 1;
    for (let O of N.questoes) {
      let ro = i[O.key], uo = u.questions.get(O.key).numero, _o = v.has(O.key), T = {
        key: O.key,
        numero: uo,
        visivel: _o,
        respondida: !1,
        na: !1,
        pontos: null,
        pontos_max: null,
        conforme: null,
        pendencias: [],
        reincidente: !1
      };
      if (g[O.key] = T, !_o)
        continue;
      if (O.tipo !== "calculo")
        z++;
      if (T.respondida = Oe(O, ro), O.tipo !== "calculo" && T.respondida)
        G++;
      let mo = Ce(O, ro);
      if (T.na = !!ro?.na || mo.length > 0 && mo.every((W) => W.na), O.tipo === "calculo")
        T.valor_calculado = b(O);
      if (T.respondida && !T.na) {
        if (O.tipo === "escolha_simples" || O.tipo === "escolha_multipla") {
          let W = mo.filter((Q) => !Q.na), B = ie(O);
          if (B !== null)
            T.pontos_max = B, T.pontos = W.reduce((Q, so) => Q + (so.pontos ?? 0), 0);
          if (W.some((Q) => Q.conforme === !1))
            T.conforme = !1;
          else if (W.some((Q) => Q.conforme === !0))
            T.conforme = !0;
          for (let Q of W)
            if (Q.desconto && Q.desconto.pct > 0) {
              let so = 1 - Math.min(100, Q.desconto.pct) / 100;
              if (Q.desconto.escopo === "formulario")
                y *= so;
              else
                to *= so;
            }
        } else if (O.tipo === "numerica") {
          let W = ro.numero, B = $e(O, W);
          if (B !== null)
            T.pontos = B, T.pontos_max = ie(O);
          T.conforme = ne(O, W);
        }
      }
      if (T.pontos !== null && T.pontos_max !== null)
        M += T.pontos, L += T.pontos_max;
      let eo = [];
      if (O.obrigatoria && !T.respondida && O.tipo !== "calculo")
        eo.push({ tipo: "obrigatoria" });
      if (T.respondida && !T.na) {
        let W = ro?.fotos ?? 0, B = (ro?.observacao ?? "").trim().length > 0;
        if (O.foto_obrigatoria && W < 1)
          eo.push({ tipo: "foto" });
        if (T.conforme === !1) {
          if (O.nc_exige?.foto && W < 1 && !eo.some((Q) => Q.tipo === "foto"))
            eo.push({ tipo: "foto" });
          if (O.nc_exige?.observacao && !B)
            eo.push({ tipo: "observacao" });
          if (O.tipo === "numerica" && O.numerica?.limite?.obs_obrigatoria && !B && !eo.some((Q) => Q.tipo === "observacao"))
            eo.push({ tipo: "observacao" });
        }
      }
      if (T.pendencias = eo, eo.length)
        j.push(O.key);
      if (T.conforme === !1) {
        if (A.push(O.key), d[O.key]?.conforme === !1)
          T.reincidente = !0;
      }
    }
    let oo = v.has(N.key), lo = M * to;
    h[N.key] = {
      key: N.key,
      visivel: oo,
      pontos: lo,
      pontos_max: L,
      desconto_pct: go((1 - to) * 100, 2),
      pct: L > 0 ? go(lo / L * 100, m) : null
    }, x += lo, E += L;
  }
  let J = x * y, K = a.config.calcular_nota !== !1 && E > 0 ? go(J / E * 100, m) : null;
  return {
    questoes: g,
    topicos: h,
    pontos: go(J, 2),
    pontos_max: go(E, 2),
    nota_pct: K,
    classificacao: K === null ? null : se(a.config.classificacoes ?? [], K),
    nao_conformidades: A,
    pendentes: j,
    respondidas: G,
    visiveis: z
  };
}
function se(a, i) {
  let d = a.filter((u) => i >= u.min && i <= u.max);
  if (!d.length)
    return null;
  return d.reduce((u, v) => v.min > u.min ? v : u);
}
function $o(a) {
  let i = [], d = qo(a), u = /* @__PURE__ */ new Set, v = (b, g) => {
    if (u.has(b))
      i.push({ onde: g, problema: `chave duplicada ${b}` });
    u.add(b);
  };
  if (!a.topicos.length)
    i.push({ onde: "formulário", problema: "precisa de pelo menos um tópico" });
  let m = 0;
  for (let b of a.topicos) {
    if (v(b.key, `tópico "${b.titulo}"`), !b.titulo.trim())
      i.push({ onde: "tópico", problema: "tópico sem título" });
    if (!b.questoes.length)
      i.push({ onde: `tópico "${b.titulo}"`, problema: "tópico sem questões" });
    q(b.depende_de, `tópico "${b.titulo}"`);
    for (let g of b.questoes) {
      m++;
      let h = `questão ${d.questions.get(g.key).numero} "${g.titulo || "sem título"}"`;
      if (v(g.key, h), !g.titulo.trim())
        i.push({ onde: h, problema: "sem título" });
      if (q(g.depende_de, h), g.tipo === "escolha_simples" || g.tipo === "escolha_multipla") {
        let y = g.opcoes ?? [];
        if (y.length < 2)
          i.push({ onde: h, problema: "precisa de pelo menos 2 opções" });
        for (let x of y) {
          if (v(x.key, h), !x.texto.trim())
            i.push({ onde: h, problema: "opção sem texto" });
          if (x.desconto && (x.desconto.pct < 0 || x.desconto.pct > 100))
            i.push({ onde: h, problema: "desconto deve estar entre 0 e 100%" });
        }
      }
      if (g.tipo === "numerica") {
        let y = g.numerica?.faixas_nota ?? [], x = -1 / 0;
        y.forEach((A, j) => {
          if (A.ate === null && j !== y.length - 1)
            i.push({ onde: h, problema: 'só a última faixa pode ser "acima"' });
          if (A.ate !== null) {
            if (A.ate <= x)
              i.push({ onde: h, problema: "faixas de nota precisam ser crescentes e não podem se cruzar" });
            x = A.ate;
          }
        });
        let E = g.numerica?.limite;
        if (E?.min != null && E?.max != null && E.min > E.max)
          i.push({ onde: h, problema: "limite mínimo maior que o máximo" });
      }
      if (g.tipo === "calculo")
        try {
          let y = Oo(g.calculo?.formula ?? "");
          if (!y.length && !(g.calculo?.formula ?? "").trim())
            i.push({ onde: h, problema: "fórmula vazia" });
          for (let x of y) {
            let E = d.byNumber.get(x);
            if (!E)
              i.push({ onde: h, problema: `a fórmula usa [${x}], que não existe` });
            else if (E.tipo !== "numerica" && E.tipo !== "calculo")
              i.push({ onde: h, problema: `a fórmula usa [${x}], que não é numérica` });
            else if (E.key === g.key)
              i.push({ onde: h, problema: "a fórmula se refere a ela mesma" });
          }
        } catch (y) {
          i.push({ onde: h, problema: y instanceof ao ? `fórmula: ${y.message}` : "fórmula inválida" });
        }
    }
  }
  if (m === 0 && a.topicos.length)
    i.push({ onde: "formulário", problema: "nenhuma questão" });
  let p = /* @__PURE__ */ new Map;
  for (let [b, { q: g, topic: h }] of d.questions) {
    if (g.depende_de)
      p.set(b, g.depende_de.questao);
    if (h.depende_de)
      p.set("t:" + h.key, h.depende_de.questao);
  }
  let _ = (b) => {
    let g = [], h = p.get(b);
    if (h)
      g.push(h);
    let y = d.questions.get(b)?.topic;
    if (y?.depende_de)
      g.push(y.depende_de.questao);
    return g;
  };
  for (let b of d.questions.keys()) {
    let g = [..._(b)], h = /* @__PURE__ */ new Set;
    while (g.length) {
      let y = g.pop();
      if (y === b) {
        i.push({ onde: `questão ${d.questions.get(b).numero}`, problema: "dependência circular" });
        break;
      }
      if (h.has(y))
        continue;
      h.add(y), g.push(..._(y));
    }
  }
  return (a.config.aprovacao?.etapas ?? []).forEach((b, g) => {
    if (!b.aprovadores.length)
      i.push({ onde: `aprovação, etapa ${g + 1}`, problema: "etapa sem aprovador" });
  }), i;
  function q(b, g) {
    if (!b)
      return;
    let h = d.questions.get(b.questao)?.q;
    if (!h)
      return i.push({ onde: g, problema: "depende de uma questão que não existe" });
    if (h.tipo !== "escolha_simples" && h.tipo !== "escolha_multipla")
      return i.push({ onde: g, problema: "só pode depender de questão de escolha" });
    if (!(h.opcoes ?? []).some((y) => y.key === b.opcao))
      i.push({ onde: g, problema: "depende de uma opção que não existe" });
  }
}
// app/src/data/agenda.ts
var Re = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
var Fo = (a) => Date.parse(a + "T00:00:00Z"), Te = (a) => new Date(a).toISOString().slice(0, 10), no = (a, i) => Te(Fo(a) + i * 86400000), To = (a) => new Date(Fo(a)).getUTCDay(), Fe = (a, i) => new Date(Date.UTC(a, i + 1, 0)).getUTCDate();
function ze(a, i) {
  switch (a.recorrencia) {
    case "nenhuma":
      return i === a.data_inicio;
    case "diaria":
      return !0;
    case "semanal":
      return ((a.dias_semana?.length) ? a.dias_semana : [To(a.data_inicio)]).includes(To(i));
    case "mensal": {
      let d = Number(a.data_inicio.slice(8, 10)), u = new Date(Fo(i));
      return u.getUTCDate() === Math.min(d, Fe(u.getUTCFullYear(), u.getUTCMonth()));
    }
  }
}
function je(a, i, d) {
  let u = a.termino === "data" && a.termino_data && a.termino_data < d ? a.termino_data : d, v = [], m = 0;
  for (let p = a.data_inicio;p <= u; p = no(p, 1)) {
    if (!ze(a, p))
      continue;
    if (m++, a.termino === "quantidade" && a.termino_qtd && m > a.termino_qtd)
      break;
    if (p >= i)
      v.push(p);
    if (a.recorrencia === "nenhuma")
      break;
  }
  return v;
}
function ce(a, i) {
  let d = new Intl.DateTimeFormat("en-US", {
    timeZone: a,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(i)), u = (v) => Number(d.find((m) => m.type === v).value);
  return (Date.UTC(u("year"), u("month") - 1, u("day"), u("hour"), u("minute"), u("second")) - i) / 60000;
}
function le(a, i, d) {
  let [u, v, m] = a.split("-").map(Number), [p, _] = i.split(":").map(Number), q = Date.UTC(u, v - 1, m, p, _), b = q - ce(d, q) * 60000;
  return b = q - ce(d, b) * 60000, new Date(b).toISOString();
}
function Le(a, i) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: i }).format(new Date(a));
}
function ue(a, i, d) {
  let u = a.dia_inteiro ? ["08:00"] : [...new Set(a.horarios)].sort();
  return je(a, i, d).flatMap((v) => u.map((m) => le(v, m, a.fuso_horario)));
}
function ko(a, i) {
  if (i.dia_inteiro)
    return le(no(Le(a, i.fuso_horario), 1), "00:00", i.fuso_horario);
  return new Date(Date.parse(a) + 7200000).toISOString();
}
function zo(a, i, d = Date.now()) {
  if (a.status !== "pendente")
    return a.status;
  return d > Date.parse(ko(a.previsto_em, i)) ? "atrasada" : "pendente";
}
function me(a) {
  let i = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.data_inicio))
    i.push("Informe a data de início.");
  if (!a.dia_inteiro && !a.horarios.length)
    i.push("Informe pelo menos um horário ou marque o dia inteiro.");
  if (a.horarios.some((d) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(d)))
    i.push("Há um horário inválido.");
  if (a.recorrencia === "semanal" && !a.dias_semana?.length)
    i.push("Escolha pelo menos um dia da semana.");
  if (a.termino === "data" && (!a.termino_data || a.termino_data < a.data_inicio))
    i.push("A data de término precisa ser depois do início.");
  if (a.termino === "quantidade" && !(a.termino_qtd && a.termino_qtd > 0 && a.termino_qtd <= 999))
    i.push("Informe quantas vezes (de 1 a 999).");
  return i;
}
var Ro = (a) => a.split("-").reverse().join("/");
function de(a) {
  return a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`;
}
function jo(a) {
  let i = a.dia_inteiro ? ", o dia inteiro" : ` às ${de([...new Set(a.horarios)].sort())}`, d;
  switch (a.recorrencia) {
    case "nenhuma":
      return `Uma vez, em ${Ro(a.data_inicio)}${a.dia_inteiro ? i : "," + i}`;
    case "diaria":
      d = "Todo dia";
      break;
    case "semanal": {
      let v = [...a.dias_semana?.length ? a.dias_semana : [To(a.data_inicio)]].sort();
      if (d = v.length === 7 ? "Todo dia" : `${v.every((m) => m === 0 || m === 6) ? "Todo" : "Toda"} ${de(v.map((m) => Re[m]))}`, v.length === 5 && !v.includes(0) && !v.includes(6))
        d = "De segunda a sexta";
      break;
    }
    case "mensal":
      d = `Todo mês no dia ${Number(a.data_inicio.slice(8, 10))}`;
      break;
  }
  let u = a.termino === "data" && a.termino_data ? ` até ${Ro(a.termino_data)}` : a.termino === "quantidade" && a.termino_qtd ? `, ${a.termino_qtd} ${a.termino_qtd === 1 ? "vez" : "vezes"}` : "";
  return `${d}${i}, a partir de ${Ro(a.data_inicio)}${u}`;
}

// app/src/data/camposAvaliado.ts
function pe(a, i) {
  return !a.depende_de || (i[a.depende_de.campo_id] ?? "") === a.depende_de.valor;
}
function Lo(a, i = {}) {
  let d = [...a].sort((m, p) => m.ordem - p.ordem), u = {};
  for (let m of d) {
    let p = (i[m.id] ?? "").trim();
    if (p && m.tipo === "lista")
      p = (m.opcoes ?? []).find((_) => _.localeCompare(p, "pt-BR", { sensitivity: "base" }) === 0) ?? p;
    if (p)
      u[m.id] = p;
  }
  let v = [];
  for (let m = !0;m; ) {
    m = !1;
    for (let p of d)
      if (u[p.id] !== void 0 && !pe(p, u))
        delete u[p.id], m = !0;
  }
  for (let m of d) {
    if (!pe(m, u))
      continue;
    let p = u[m.id];
    if (!p) {
      if (m.obrigatorio)
        v.push(`${m.nome} é obrigatório`);
      continue;
    }
    if (m.tipo === "lista" && !(m.opcoes ?? []).includes(p))
      v.push(`${m.nome}: "${p}" não está entre as opções (${(m.opcoes ?? []).join(", ")})`);
    if (m.tipo === "numero" && !Number.isFinite(Number(p.replace(/\./g, "").replace(",", "."))))
      v.push(`${m.nome}: "${p}" não é um número`);
    if (m.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(p)) {
      let _ = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(p);
      if (_)
        u[m.id] = `${_[3]}-${_[2]}-${_[1]}`;
      else
        v.push(`${m.nome}: use a data como dd/mm/aaaa`);
    }
  }
  return { valores: u, erros: v };
}
function fe(a) {
  let i = [], d = /* @__PURE__ */ new Set;
  for (let u of a) {
    let v = u.nome.trim().toLowerCase();
    if (!v)
      i.push("Há um campo sem nome.");
    else if (d.has(v))
      i.push(`Já existe um campo chamado "${u.nome}".`);
    if (d.add(v), ["nome", "código", "codigo", "cnpj", "e-mail", "email", "telefone", "endereço", "endereco"].includes(v))
      i.push(`"${u.nome}" já é um campo padrão do cadastro.`);
    if (u.tipo === "lista" && (u.opcoes ?? []).filter((m) => m.trim()).length < 2)
      i.push(`${u.nome}: a lista precisa de pelo menos 2 opções.`);
    if (u.depende_de) {
      let m = a.find((q) => q.id === u.depende_de.campo_id);
      if (!m || m.tipo !== "lista")
        i.push(`${u.nome}: só pode depender de um campo do tipo lista.`);
      else if (!(m.opcoes ?? []).includes(u.depende_de.valor))
        i.push(`${u.nome}: "${u.depende_de.valor}" não é opção de ${m.nome}.`);
      let p = /* @__PURE__ */ new Set([u.id]), _ = m;
      while (_?.depende_de) {
        if (p.has(_.id)) {
          i.push(`${u.nome}: dependência circular.`);
          break;
        }
        if (p.add(_.id), _ = a.find((q) => q.id === _.depende_de.campo_id), _ && p.has(_.id)) {
          i.push(`${u.nome}: dependência circular.`);
          break;
        }
      }
    }
  }
  return [...new Set(i)];
}

// app/src/data/seed.ts
var io = { id: "org-1", nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco" }, Ne = [
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
], Vo = [
  { id: "fn-admin", nome: "Administrador", acoes: Ne, sistema: !0 },
  { id: "fn-qualidade", nome: "Analista de qualidade", acoes: ["gerenciar_formularios", "aplicar", "editar_inspecao", "ver_todas_inspecoes", "gerenciar_avaliados", "gerenciar_planos", "aprovar", "ver_painel"] },
  { id: "fn-supervisor", nome: "Supervisor de lojas", acoes: ["aplicar", "ver_painel", "aprovar"] },
  { id: "fn-aplicador", nome: "Aplicador", acoes: ["aplicar"] }
], Ue = { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] };
var Bo = [
  { id: "m-rogerio", org_id: io.id, nome: "Rogério Marinho", email: "rogerio@exemplo.com", funcao_id: "fn-admin", is_master: !0, ativo: !0, acesso: Ue, created_at: "2026-09-01T12:00:00.000Z" },
  {
    id: "m-ana",
    org_id: io.id,
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
    org_id: io.id,
    nome: "Carlos Eduardo Lima",
    email: "carlos@exemplo.com",
    funcao_id: "fn-supervisor",
    is_master: !1,
    ativo: !0,
    acesso: { formularios: ["f-flv"], avaliados: ["a-bosque", "a-centro"], ver_membros: [], ver_equipes: ["eq-lojas"] },
    created_at: "2026-09-01T12:00:00.000Z"
  }
], Qo = [
  { id: "eq-lojas", org_id: io.id, nome: "Equipe de lojas", membros: ["m-ana"], acesso: { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] } }
];
var No = (a, i, d, u, v) => ({
  id: a,
  org_id: io.id,
  nome: i,
  codigo_externo: d,
  endereco: u,
  email: v,
  ativo: !0,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z"
}), Eo = [
  No("a-bosque", "Loja 01 — Bosque", "LJ01", "Av. Ceará, 1500 — Bosque", "gerencia.lj01@exemplo.com"),
  No("a-centro", "Loja 02 — Centro", "LJ02", "Rua Marechal Deodoro, 210 — Centro", "gerencia.lj02@exemplo.com"),
  No("a-doca3", "CD — Doca 3", "CD03", "Estrada do Aeroporto, km 3")
];
Eo[0].campos = { "cp-regional": "Capital", "cp-formato": "Supermercado", "cp-gerente": "Júlia Andrade" };
Eo[1].campos = { "cp-regional": "Capital", "cp-formato": "Express", "cp-gerente": "Paulo Neri" };
Eo[2].campos = { "cp-regional": "Capital", "cp-formato": "Centro de distribuição" };
var _e = [
  { id: "cp-regional", nome: "Regional", tipo: "lista", opcoes: ["Capital", "Interior"], obrigatorio: !1, na_lista: !0, ordem: 1 },
  { id: "cp-cidade", nome: "Cidade", tipo: "texto", obrigatorio: !0, na_lista: !1, depende_de: { campo_id: "cp-regional", valor: "Interior" }, ordem: 2 },
  { id: "cp-formato", nome: "Formato", tipo: "lista", opcoes: ["Supermercado", "Express", "Atacarejo", "Centro de distribuição"], obrigatorio: !1, na_lista: !0, ordem: 3 },
  { id: "cp-gerente", nome: "Gerente", tipo: "texto", obrigatorio: !1, na_lista: !1, ordem: 4 }
], ve = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
  { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
  { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
], Uo = (a, i, d = {}) => ({
  key: a,
  titulo: i,
  tipo: "escolha_simples",
  obrigatoria: !0,
  opcoes: [
    { key: `${a}-sim`, texto: "Sim", pontos: 10, conforme: !0 },
    { key: `${a}-nao`, texto: "Não", pontos: 0, conforme: !1 },
    { key: `${a}-na`, texto: "Não se aplica", na: !0 }
  ],
  ...d
}), Ve = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: ve, geo: "off", reincidencia_meses: 3, relatorio: { emails: { avaliado: !0, extras: ["qualidade@exemplo.com"] } } },
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
        Uo("q-preco", "Todos os itens da bancada têm preço visível?", { nc_exige: { observacao: !0 } }),
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
        Uo("q-porta", "A porta da câmara veda sem frestas?", { plano_acao_modelo_id: "pm-manutencao" }),
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
}, Be = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: ve },
  topicos: [
    {
      key: "r-doc",
      titulo: "Documentação",
      questoes: [
        { key: "r-nf", titulo: "Número da nota fiscal", tipo: "texto", obrigatoria: !0, texto: { leitura_codigo: !0 } },
        Uo("r-lacre", "O lacre do baú chegou intacto?", { nc_exige: { foto: !0 } })
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
}, Qe = [
  { id: "f-flv", org_id: io.id, nome: "Checklist FLV e perecíveis", rascunho: Ve, versao_publicada_id: "fv-flv-1", avaliados_vinculados: ["a-bosque", "a-centro"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" },
  { id: "f-receb", org_id: io.id, nome: "Recebimento de refrigerados", rascunho: Be, versao_publicada_id: "fv-receb-1", avaliados_vinculados: ["a-doca3"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" }
];
var ge = [
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
], he = [
  {
    id: "pm-retirada",
    org_id: io.id,
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
    org_id: io.id,
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
function be(a) {
  let i = { org_id: io.id, fuso_horario: io.fuso_horario, ativo: !0, materializado_ate: null, criado_por: "m-rogerio", created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" };
  return [
    {
      ...i,
      id: "ag-flv-centro",
      formulario_id: "f-flv",
      avaliado_id: "a-centro",
      responsaveis: ["m-ana"],
      data_inicio: a,
      horarios: [],
      dia_inteiro: !0,
      recorrencia: "diaria",
      termino: "nunca"
    },
    {
      ...i,
      id: "ag-receb-doca",
      formulario_id: "f-receb",
      avaliado_id: "a-doca3",
      responsaveis: ["m-rogerio"],
      data_inicio: a,
      horarios: ["07:30"],
      dia_inteiro: !1,
      recorrencia: "semanal",
      dias_semana: [1, 3, 5],
      termino: "nunca"
    }
  ];
}
function Je(a) {
  return () => {
    a = a + 1831565813 | 0;
    let i = Math.imul(a ^ a >>> 15, 1 | a);
    return i = i + Math.imul(i ^ i >>> 7, 61 | i) ^ i, ((i ^ i >>> 14) >>> 0) / 4294967296;
  };
}
function we(a) {
  let i = Je(20261014), d = [], u = Date.parse(a + "T12:00:00Z") - 7257600000, v = 0;
  for (let m = 0;m < 12; m++) {
    let p = m / 11;
    for (let [_, q, b] of [["a-bosque", 0.15 + 0.35 * p, [1, 4]], ["a-centro", 0.45 - 0.35 * p, [2, 5]], ["a-doca3", 0.25, [1, 3]]])
      for (let g of b) {
        let h = u + (m * 7 + g) * 86400000 + Math.floor(i() * 6) * 3600000;
        if (h >= Date.parse(a + "T00:00:00Z"))
          continue;
        let y = (J) => i() < J, x = `demo-${String(++v).padStart(3, "0")}`;
        if (_ === "a-doca3") {
          let J = Math.round((3 + i() * (y(q) ? 7 : 3.5)) * 10) / 10, Y = !y(q / 2);
          d.push({
            client_uuid: x,
            formulario_id: "f-receb",
            formulario_versao_id: "fv-receb-1",
            avaliado_id: _,
            responsavel_id: "m-rogerio",
            iniciada_em: new Date(h).toISOString(),
            finalizada_em: new Date(h + 900000).toISOString(),
            respostas: {
              "r-nf": { texto: String(1e5 + Math.floor(i() * 899999)) },
              "r-lacre": Y ? { opcoes: ["r-lacre-sim"] } : { opcoes: ["r-lacre-nao"], fotos: 1 },
              "r-bruto": { numero: 12 + Math.round(i() * 30) / 10 },
              "r-tara": { numero: 0.6 },
              "r-temp": J > 7 ? { numero: J, observacao: "Acima do limite na chegada." } : { numero: J }
            }
          });
          continue;
        }
        let E = Math.round((1 + i() * (y(q) ? 7 : 3)) * 10) / 10, A = y(q), j = y(q * 0.8), G = y(q * 0.6), z = y(q * 0.7);
        d.push({
          client_uuid: x,
          formulario_id: "f-flv",
          formulario_versao_id: "fv-flv-1",
          avaliado_id: _,
          responsavel_id: y(0.5) ? "m-ana" : "m-carlos",
          iniciada_em: new Date(h).toISOString(),
          finalizada_em: new Date(h + 1500000).toISOString(),
          respostas: {
            "q-vencidos": A ? { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Lote vencido na bancada." } : { opcoes: ["q-vencidos-sim"] },
            "q-preco": j ? { opcoes: ["q-preco-nao"], observacao: "Itens sem etiqueta." } : { opcoes: ["q-preco-sim"] },
            "q-gondola": { opcoes: z ? ["q-gondola-limpa", "q-gondola-avaria"] : ["q-gondola-limpa", "q-gondola-abastecida"] },
            "q-temp": E > 4 ? { numero: E, fotos: 1, observacao: "Fora da faixa." } : { numero: E, fotos: 1 },
            "q-porta": G ? { opcoes: ["q-porta-nao"] } : { opcoes: ["q-porta-sim"] },
            ...G ? { "q-porta-motivo": { texto: "Borracha ressecada." } } : {},
            "q-ass": { assinatura: "demo" }
          }
        });
      }
  }
  return d.sort((m, p) => m.finalizada_em.localeCompare(p.finalizada_em));
}

// app/src/data/nucleo.ts
function X(a, i) {
  return a.is_master || a.acoes.includes(i);
}
function yo(a, i) {
  return X(a, "ver_todas_inspecoes") || i.responsavel_id === a.id || a.ve_inspecoes_de.includes(i.responsavel_id);
}
function ye(a) {
  let i = a.org, d = "srv:state", u = "inspeta:sessao", v = "inspeta:membros", m = () => crypto.randomUUID(), p = () => (/* @__PURE__ */ new Date()).toISOString(), _ = (r) => structuredClone(r);
  async function q() {
    let r = await a.carregar();
    if (r) {
      if (r.planosModelo ??= _(he), r.planos ??= [], r.emails ??= [], r.membros ??= _(Bo), r.funcoes ??= _(Vo), r.equipes ??= _(Qo), r.agendamentos ??= be(B()), r.ocorrencias ??= [], r.aprovacoes ??= [], r.camposAvaliado ??= _(_e), a.local.get("inspeta:membros") === null)
        g(r);
      return r;
    }
    let o = a.estadoInicial();
    if (o.inspecoes.length === 0 && o.formularios.some((e) => e.id === "f-flv"))
      for (let e of ge) {
        let n = E(o, e.responsavel_id);
        Y(o, n, { ...e, status: "completa", anexos: [], device_id: "seed" }, e.finalizada_em);
      }
    return await a.gravar(o), o;
  }
  async function b(r, o) {
    if (await a.gravar(r), o === "membros")
      g(r), a.aviso("sessao");
    a.aviso(o);
  }
  function g(r) {
    a.local.set("inspeta:membros", JSON.stringify(co(r.membros, r.funcoes, r.equipes)));
  }
  let h = null, y = [];
  function x() {
    let r = a.local.get("inspeta:membros") ?? "seed";
    if (r !== h)
      y = r === "seed" ? co(Bo, Vo, Qo) : JSON.parse(r), h = r;
    return y;
  }
  function E(r, o) {
    let e = co(r.membros, r.funcoes, r.equipes).find((n) => n.id === o);
    if (!e || !e.ativo)
      throw Error("Sessão inválida");
    return e;
  }
  function A(r, o) {
    return a.exclusivo(async () => {
      let e = await q(), n = o(e);
      return await b(e, r), n;
    });
  }
  function j(r, o, e, n, s = {}, t = p()) {
    r.eventos.push({ id: ++r.eventoSeq, inspecao_id: o, membro_id: e, acao: n, dados: s, em: t });
  }
  function G(r, o, e, n) {
    let t = r.formularios.find((D) => D.id === o)?.rascunho.config.reincidencia_meses ?? 3, l = Date.now() - t * 31 * 86400000, c = r.inspecoes.filter((D) => D.formulario_id === o && D.avaliado_id === e && D.status !== "rascunho" && D.client_uuid !== n && D.finalizada_em && Date.parse(D.finalizada_em) >= l).sort((D, w) => (w.finalizada_em ?? "").localeCompare(D.finalizada_em ?? ""))[0];
    if (!c)
      return {};
    let f = {};
    for (let [D, w] of Object.entries(c.resultado.questoes))
      f[D] = { conforme: w.conforme, resposta: c.respostas[D] };
    return f;
  }
  function z(r) {
    return r.topicos.flatMap((o) => o.questoes).filter((o) => o.preenchimento_automatico || o.preenchimento_unico);
  }
  function J(r, o, e, n, s) {
    let t = z(o);
    if (!t.length)
      return {};
    let l = {}, c = r.inspecoes.filter((f) => f.formulario_id === e && f.avaliado_id === n && f.status !== "rascunho" && f.client_uuid !== s).sort((f, D) => (D.finalizada_em ?? "").localeCompare(f.finalizada_em ?? ""));
    for (let f of t) {
      let D = c.find((w) => {
        let k = w.respostas[f.key];
        return k && (k.opcoes?.length || k.numero != null || k.texto || k.data || k.na);
      })?.respostas[f.key];
      if (D)
        l[f.key] = { opcoes: D.opcoes, numero: D.numero, texto: D.texto, data: D.data, na: D.na };
    }
    return l;
  }
  function Y(r, o, e, n = p()) {
    let s = r.versoes.find((F) => F.id === e.formulario_versao_id && F.formulario_id === e.formulario_id);
    if (!s)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
    if (!X(o, "aplicar") || !K(o, e.formulario_id) || !N(o, e.avaliado_id))
      return { client_uuid: e.client_uuid, ok: !1, erro: "sem_permissao", mensagem: "Você não tem permissão para este formulário." };
    let t = r.inspecoes.find((F) => F.client_uuid === e.client_uuid);
    if (t) {
      if (t.responsavel_id !== o.id)
        return { client_uuid: e.client_uuid, ok: !1, erro: "conflito", mensagem: "Inspeção pertence a outra pessoa." };
      if (t.status !== "rascunho")
        return { client_uuid: e.client_uuid, ok: !0, id: t.id, nota_pct: t.nota_pct, classificacao: t.classificacao };
    }
    let l = J(r, s.definicao, e.formulario_id, e.avaliado_id, e.client_uuid);
    for (let F of z(s.definicao))
      if (F.preenchimento_unico && l[F.key])
        e = { ...e, respostas: { ...e.respostas, [F.key]: { ...e.respostas[F.key], ...l[F.key] } } };
    let c = G(r, e.formulario_id, e.avaliado_id, e.client_uuid), f = Ao(s.definicao, e.respostas, c);
    if (e.status === "completa" && f.pendentes.length)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: `${f.pendentes.length} questão(ões) com pendência.` };
    let D = {
      nao_conformidades: f.nao_conformidades,
      questoes: Object.fromEntries(Object.values(f.questoes).filter((F) => F.visivel).map((F) => [F.key, {
        conforme: F.conforme,
        pontos: F.pontos,
        pontos_max: F.pontos_max,
        reincidente: F.reincidente,
        valor_calculado: F.valor_calculado
      }])),
      topicos: Object.fromEntries(Object.values(f.topicos).map((F) => [F.key, { pct: F.pct, desconto_pct: F.desconto_pct }]))
    }, w = {
      org_id: i.id,
      client_uuid: e.client_uuid,
      formulario_id: e.formulario_id,
      formulario_versao_id: e.formulario_versao_id,
      avaliado_id: e.avaliado_id,
      responsavel_id: o.id,
      status: e.status,
      iniciada_em: e.iniciada_em,
      finalizada_em: e.finalizada_em,
      geo_inicio: e.geo_inicio ?? null,
      geo_fim: e.geo_fim ?? null,
      respostas: e.respostas,
      anexos: e.anexos,
      nota_pct: f.nota_pct,
      pontos: f.pontos,
      pontos_max: f.pontos_max,
      classificacao: f.classificacao?.nome ?? null,
      classificacao_cor: f.classificacao?.cor ?? null,
      qtd_nao_conformidades: f.nao_conformidades.length,
      resultado: D,
      device_id: e.device_id,
      sincronizada_em: n,
      ocorrencia_id: e.status === "completa" ? _o(r, o, e, t?.id) : null
    }, k = s.definicao.config.aprovacao?.etapas ?? [], R = e.status === "completa" && k.length ? "em_aprovacao" : e.status;
    Object.assign(w, { status: R, aprovacao_etapa: R === "em_aprovacao" ? 1 : null });
    let I;
    if (t)
      Object.assign(t, w, { updated_at: n }), I = t.id;
    else
      I = m(), r.inspecoes.push({ id: I, ...w, created_at: n, updated_at: n }), j(r, I, o.id, "criada", { device_id: e.device_id }, e.iniciada_em);
    j(r, I, o.id, "sincronizada", { device_id: e.device_id }, n);
    let Z = w.ocorrencia_id ? r.ocorrencias.find((F) => F.id === w.ocorrencia_id) : void 0;
    if (Z)
      Z.inspecao_id = I;
    if (e.status === "completa")
      j(r, I, o.id, "finalizada", { nota_pct: f.nota_pct, ncs: f.nao_conformidades.length }, e.finalizada_em ?? n);
    if (R === "em_aprovacao")
      j(r, I, null, "enviada_aprovacao", { etapa: 1, de: k.length }, n), W(r, I);
    return { client_uuid: e.client_uuid, ok: !0, id: I, nota_pct: f.nota_pct, classificacao: f.classificacao?.nome ?? null };
  }
  function K(r, o) {
    return X(r, "gerenciar_formularios") || r.formularios_permitidos === "todos" || r.formularios_permitidos.includes(o);
  }
  function N(r, o) {
    return r.avaliados_permitidos === "todos" || r.avaliados_permitidos.includes(o);
  }
  function M(r, o) {
    let e = x().find((n) => n.id === r.id) ?? r;
    if (!e.ativo || !X(e, o))
      throw Error("Você não tem permissão para isso.");
  }
  function L() {
    a.exigirRede();
  }
  let to = {
    async entrar(r, o) {
      await a.atraso();
      let e = await q(), n = co(e.membros, e.funcoes, e.equipes).find((s) => s.email.toLowerCase() === r.trim().toLowerCase());
      if (!n || o.length < 4)
        throw Error("E-mail ou senha incorretos.");
      if (!n.ativo)
        throw Error("Este acesso foi desativado. Fale com o administrador da conta.");
      return a.local.set("inspeta:sessao", n.id), a.aviso("sessao"), n;
    },
    sessao() {
      let r = a.local.get("inspeta:sessao"), o = r ? x().find((e) => e.id === r) : void 0;
      return o && o.ativo ? o : null;
    },
    sair() {
      a.local.del("inspeta:sessao"), a.aviso("sessao");
    },
    org() {
      return i;
    },
    async recuperarSenha(r) {
      await a.atraso();
    },
    async definirSenha(r) {
      throw Error("Na demonstração qualquer senha com 4+ caracteres funciona.");
    },
    capturarRetornoAuth() {
      return null;
    },
    membros() {
      return x();
    },
    async listarFormularios() {
      await a.atraso();
      let r = await q();
      return r.formularios.filter((o) => !o.arquivado).map((o) => {
        let e = r.versoes.find((n) => n.id === o.versao_publicada_id) ?? null;
        return {
          ...o,
          versao_numero: e?.numero ?? null,
          tem_alteracoes: !e || JSON.stringify(e.definicao) !== JSON.stringify(o.rascunho),
          qtd_questoes: o.rascunho.topicos.reduce((n, s) => n + s.questoes.length, 0),
          qtd_inspecoes: r.inspecoes.filter((n) => n.formulario_id === o.id && n.status !== "rascunho").length
        };
      }).sort((o, e) => e.updated_at.localeCompare(o.updated_at));
    },
    async obterFormulario(r) {
      let o = (await q()).formularios.find((e) => e.id === r);
      if (!o)
        throw Error("Formulário não encontrado.");
      return _(o);
    },
    async criarFormulario(r, o) {
      if (await a.atraso(), !r.trim())
        throw Error("Dê um nome ao formulário.");
      let e = o ? _(o) : {
        config: { calcular_nota: !0, casas_decimais: 1, classificacoes: [
          { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
          { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
          { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
        ] },
        topicos: [{ key: m(), titulo: "Tópico 1", questoes: [{ key: m(), titulo: "", tipo: "escolha_simples", obrigatoria: !0, opcoes: [
          { key: m(), texto: "Sim", pontos: 10, conforme: !0 },
          { key: m(), texto: "Não", pontos: 0, conforme: !1 }
        ] }] }]
      };
      return A("formularios", (n) => {
        let s = { id: m(), org_id: i.id, nome: r.trim(), rascunho: e, versao_publicada_id: null, avaliados_vinculados: [], arquivado: !1, created_at: p(), updated_at: p() };
        return n.formularios.push(s), _(s);
      });
    },
    salvarRascunho(r, o, e) {
      return A("formularios", (n) => {
        let s = n.formularios.find((t) => t.id === r);
        if (!s)
          throw Error("Formulário não encontrado.");
        if (e && s.updated_at !== e)
          throw Error("Este formulário foi alterado em outra aba. Recarregue para não perder mudanças.");
        if (o.nome !== void 0)
          s.nome = o.nome;
        if (o.rascunho)
          s.rascunho = o.rascunho;
        if (o.avaliados_vinculados)
          s.avaliados_vinculados = o.avaliados_vinculados;
        return s.updated_at = p(), _(s);
      });
    },
    async publicar(r, o) {
      return await a.atraso(), A("formularios", (e) => {
        let n = e.formularios.find((c) => c.id === r);
        if (!n)
          throw Error("Formulário não encontrado.");
        let s = $o(n.rascunho);
        if (s.length)
          return { ok: !1, problemas: s };
        let t = Math.max(0, ...e.versoes.filter((c) => c.formulario_id === r).map((c) => c.numero)) + 1, l = { id: m(), formulario_id: r, numero: t, definicao: _(n.rascunho), publicado_em: p(), publicado_por: o };
        return e.versoes.push(l), n.versao_publicada_id = l.id, n.updated_at = p(), { ok: !0, versao: _(l) };
      });
    },
    async obterVersao(r) {
      let o = (await q()).versoes.find((e) => e.id === r);
      if (!o)
        throw Error("Versão não encontrada.");
      return _(o);
    },
    async listarAvaliados() {
      return await a.atraso(), _((await q()).avaliados).sort((r, o) => r.nome.localeCompare(o.nome, "pt-BR"));
    },
    criarAvaliado(r) {
      return to.salvarAvaliado(null, r);
    },
    salvarAvaliado(r, o) {
      if (o.nome !== void 0 && !o.nome.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (r === null && !o.nome?.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (o.email && !/^\S+@\S+\.\S+$/.test(o.email))
        return Promise.reject(Error("E-mail inválido."));
      return A("avaliados", (e) => {
        let n = r ? e.avaliados.find((l) => l.id === r) : void 0;
        if (r && !n)
          throw Error("Avaliado não encontrado.");
        if (o.codigo_externo && e.avaliados.some((l) => l.codigo_externo === o.codigo_externo && l.id !== r))
          throw Error(`Já existe um avaliado com o código ${o.codigo_externo}.`);
        let s = Lo(e.camposAvaliado, o.campos ?? n?.campos ?? {});
        if (s.erros.length)
          throw Error(s.erros.join(". ") + ".");
        if (n)
          return Object.assign(n, _(o), { nome: (o.nome ?? n.nome).trim(), campos: s.valores, updated_at: p() }), _(n);
        let t = { ..._(o), id: m(), org_id: i.id, nome: o.nome.trim(), campos: s.valores, ativo: !0, created_at: p(), updated_at: p() };
        return e.avaliados.push(t), _(t);
      });
    },
    async listarCamposAvaliado() {
      return _((await q()).camposAvaliado).sort((r, o) => r.ordem - o.ordem);
    },
    salvarCamposAvaliado(r, o) {
      M(r, "gerenciar_avaliados");
      let e = fe(o);
      if (e.length)
        return Promise.reject(Error(e.join(" ")));
      return A("avaliados", (n) => {
        let s = new Set(o.map((t) => t.id));
        n.camposAvaliado = o.map((t, l) => ({
          ..._(t),
          nome: t.nome.trim(),
          ordem: l + 1,
          opcoes: t.tipo === "lista" ? (t.opcoes ?? []).map((c) => c.trim()).filter(Boolean) : void 0
        }));
        for (let t of n.avaliados)
          if (t.campos) {
            for (let l of Object.keys(t.campos))
              if (!s.has(l))
                delete t.campos[l];
          }
        return _(n.camposAvaliado);
      });
    },
    async listarInspecoes(r, o = {}) {
      await a.atraso();
      let e = await q(), n = (o.busca ?? "").trim().toLowerCase(), s = new Map(e.avaliados.map((c) => [c.id, c.nome])), t = new Map(e.formularios.map((c) => [c.id, c.nome])), l = new Map(x().map((c) => [c.id, c.nome]));
      return _(e.inspecoes.filter((c) => {
        if (!yo(r, c) && !eo(e, r, c))
          return !1;
        if (o.status && c.status !== o.status)
          return !1;
        let f = (c.finalizada_em ?? c.iniciada_em).slice(0, 10);
        if (o.de && f < o.de)
          return !1;
        if (o.ate && f > o.ate)
          return !1;
        if (n) {
          if (![s.get(c.avaliado_id), t.get(c.formulario_id), l.get(c.responsavel_id), c.id.slice(0, 8)].join(" ").toLowerCase().includes(n))
            return !1;
        }
        return !0;
      }).sort((c, f) => (f.finalizada_em ?? f.iniciada_em).localeCompare(c.finalizada_em ?? c.iniciada_em)));
    },
    async obterInspecao(r, o) {
      let e = await q(), n = e.inspecoes.find((s) => s.id === o);
      if (!n || !yo(r, n) && !eo(e, r, n))
        throw Error("Inspeção não encontrada.");
      return _(n);
    },
    async eventos(r) {
      return _((await q()).eventos.filter((o) => o.inspecao_id === r));
    },
    async anexo(r) {
      return a.anexo(r);
    },
    async salvarLogo(r) {
      if (!/^data:image\/(png|jpeg);base64,/.test(r))
        throw Error("Use uma imagem PNG ou JPG.");
      if (r.length > 409600)
        throw Error("Logo acima de 300 KB mesmo depois de reduzido.");
      let o = "logo-" + m();
      return await a.guardarAnexo(o, r), o;
    },
    async layoutRelatorio(r) {
      let o = await q(), e = o.formularios.find((t) => t.id === r), s = o.versoes.find((t) => t.id === e?.versao_publicada_id)?.definicao.config.relatorio?.layout ?? {};
      return { layout: s, logo: s.logo_id ? await a.anexo(s.logo_id) ?? null : null };
    },
    registrarRelatorio(r, o) {
      return A("inspecoes", (e) => j(e, r, o, "relatorio_enviado", { formato: "pdf" }));
    },
    async pacote(r) {
      L(), await a.atraso(), await uo();
      let o = await q(), e = E(o, r), n = o.formularios.filter((w) => !w.arquivado && w.versao_publicada_id && K(e, w.id)).map((w) => ({
        formulario_id: w.id,
        nome: w.nome,
        versao: _(o.versoes.find((k) => k.id === w.versao_publicada_id)),
        avaliados: w.avaliados_vinculados.length ? w.avaliados_vinculados : "todos"
      })), s = {};
      for (let w of n)
        for (let k of o.avaliados) {
          let R = G(o, w.formulario_id, k.id);
          if (Object.keys(R).length)
            s[`${w.formulario_id}|${k.id}`] = R;
        }
      let t = _(o.avaliados.filter((w) => w.ativo && N(e, w.id))), l = B(), c = new Date(Date.parse(no(l, -7) + "T00:00:00Z")).toISOString(), f = o.ocorrencias.filter((w) => w.status === "pendente" && w.previsto_em >= c).flatMap((w) => {
        let k = o.agendamentos.find((R) => R.id === w.agendamento_id);
        if (!k || !k.responsaveis.includes(e.id) || !n.some((R) => R.formulario_id === k.formulario_id) || !t.some((R) => R.id === k.avaliado_id))
          return [];
        return [{ id: w.id, formulario_id: k.formulario_id, avaliado_id: k.avaliado_id, previsto_em: w.previsto_em, dia_inteiro: k.dia_inteiro, limite: ko(w.previsto_em, k), descricao: jo(k) }];
      }).sort((w, k) => w.previsto_em.localeCompare(k.previsto_em)), D = {};
      for (let w of n)
        for (let k of t) {
          let R = J(o, w.versao.definicao, w.formulario_id, k.id);
          if (Object.keys(R).length)
            D[`${w.formulario_id}|${k.id}`] = R;
        }
      return { cursor: p(), membro: e, org: i, formularios: n, avaliados: t, anteriores: s, ultimas: D, agenda: f };
    },
    async enviarAnexo(r, o, e) {
      if (L(), E(await q(), r), await a.atraso(), e.length > 21548236.8)
        throw Error("Arquivo acima de 15 MB.");
      await a.guardarAnexo(o, e);
    },
    async enviarInspecoes(r, o) {
      L();
      let e = E(await q(), r);
      if (await a.atraso(), o.length > 20)
        throw Error("Lote acima de 20 inspeções.");
      let n = await a.anexosPresentes(o.flatMap((t) => t.anexos.map((l) => l.client_uuid))), s = await A("inspecoes", (t) => o.map((l) => {
        if (l.anexos.find((f) => !n.has(f.client_uuid)))
          return { client_uuid: l.client_uuid, ok: !1, erro: "anexo_faltando", mensagem: "Foto ainda não enviada." };
        return Y(t, e, l);
      }));
      for (let t of s) {
        let l = o.find((c) => c.client_uuid === t.client_uuid);
        if (t.ok && l?.status === "completa")
          await De(t.id);
      }
      return s;
    },
    async listarPlanosModelo() {
      return await a.atraso(), _((await q()).planosModelo).sort((r, o) => r.nome.localeCompare(o.nome, "pt-BR"));
    },
    async obterPlanoModelo(r) {
      let o = (await q()).planosModelo.find((e) => e.id === r);
      if (!o)
        throw Error("Modelo de plano não encontrado.");
      return _(o);
    },
    criarPlanoModelo(r) {
      if (!r.trim())
        return Promise.reject(Error("Dê um nome ao modelo."));
      return A("planos", (o) => {
        if (o.planosModelo.some((n) => n.nome.toLowerCase() === r.trim().toLowerCase()))
          throw Error("Já existe um modelo com esse nome.");
        let e = {
          id: m(),
          org_id: i.id,
          nome: r.trim(),
          agrupamento: "por_inspecao",
          prazo_dias: 3,
          destinatario: "avaliado",
          definicao: { config: { calcular_nota: !1 }, topicos: [{ key: m(), titulo: "Correção", questoes: [
            { key: m(), titulo: "O que foi feito para corrigir?", tipo: "texto", obrigatoria: !0 }
          ] }] },
          created_at: p(),
          updated_at: p()
        };
        return o.planosModelo.push(e), _(e);
      });
    },
    salvarPlanoModelo(r) {
      return A("planos", (o) => {
        let e = o.planosModelo.findIndex((n) => n.id === r.id);
        if (e < 0)
          throw Error("Modelo de plano não encontrado.");
        if (!r.nome.trim())
          throw Error("Dê um nome ao modelo.");
        if (r.destinatario === "fixo" && !/^\S+@\S+\.\S+$/.test(r.email_fixo ?? ""))
          throw Error("Informe um e-mail válido para o destinatário fixo.");
        return o.planosModelo[e] = { ..._(r), updated_at: p() }, _(o.planosModelo[e]);
      });
    },
    async listarPlanos(r, o = {}) {
      await a.atraso();
      let e = await q(), n = B(), s = (o.busca ?? "").trim().toLowerCase();
      return e.planos.filter((t) => {
        if (X(r, "gerenciar_planos"))
          return !0;
        let l = e.inspecoes.find((c) => c.id === t.inspecao_id);
        return !!l && yo(r, l);
      }).map((t) => ({
        ..._(t),
        situacao: so(t, n),
        avaliado: e.avaliados.find((l) => l.id === t.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: e.formularios.find((l) => l.id === t.formulario_id)?.nome ?? "Formulário removido"
      })).filter((t) => (!o.situacao || t.situacao === o.situacao) && (!s || [t.avaliado, t.modelo_snapshot.nome, t.responsavel_email, t.formulario].join(" ").toLowerCase().includes(s))).sort((t, l) => l.created_at.localeCompare(t.created_at) || t.modelo_snapshot.nome.localeCompare(l.modelo_snapshot.nome, "pt-BR"));
    },
    async planosDaInspecao(r) {
      let o = await q(), e = B();
      return o.planos.filter((n) => n.inspecao_id === r).map((n) => ({ ..._(n), situacao: so(n, e) }));
    },
    async novoLinkPlano(r, o, e) {
      if (!X(o, "gerenciar_planos"))
        throw Error("Sem permissão.");
      await a.atraso();
      let n = Do(), s = await bo(n), t = Po(n);
      return await A("planos", (l) => {
        let c = l.planos.find((f) => f.id === r);
        if (!c)
          throw Error("Plano não encontrado.");
        if (c.token_hash = s, e) {
          if (!/^\S+@\S+\.\S+$/.test(e))
            throw Error("E-mail inválido.");
          c.responsavel_email = e, c.ultimo_email_em = p(), vo(l, Go(l, c, t, s));
        }
        c.updated_at = p();
      }), { link: t };
    },
    async planoPorToken(r) {
      await a.atraso();
      let o = await bo(r), e = await q(), n = e.planos.find((f) => f.token_hash === o);
      if (!n)
        throw Error("Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
      let s = e.inspecoes.find((f) => f.id === n.inspecao_id), l = e.versoes.find((f) => f.id === s.formulario_versao_id).definicao.topicos.flatMap((f) => f.questoes), c = n.questao_keys.map((f) => {
        let D = l.findIndex((k) => k.key === f), w = D >= 0 ? l[D] : null;
        return { key: f, numero: D + 1, titulo: w?.titulo ?? "Questão", resposta: s.respostas[f], questao: w, reincidente: !!s.resultado.questoes[f]?.reincidente };
      });
      return {
        plano: { ..._(n), situacao: so(n, B()) },
        org: i,
        avaliado: e.avaliados.find((f) => f.id === n.avaliado_id)?.nome ?? "",
        formulario: e.formularios.find((f) => f.id === n.formulario_id)?.nome ?? "",
        inspecao: { finalizada_em: s.finalizada_em, nota_pct: s.nota_pct, classificacao: s.classificacao, responsavel: e.membros.find((f) => f.id === s.responsavel_id)?.nome ?? "" },
        ncs: c
      };
    },
    async responderPlano(r, o) {
      await a.atraso();
      let e = await bo(r);
      for (let n of o.fotos)
        await a.guardarAnexo(n.client_uuid, n.dataUrl);
      await A("planos", (n) => {
        let s = n.planos.find((t) => t.token_hash === e);
        if (!s)
          throw Error("Este link não vale mais.");
        if (s.status === "finalizado")
          throw Error("Este plano já foi respondido.");
        if (s.status === "em_aprovacao")
          throw Error("A resposta já foi enviada e está em análise.");
        if (!o.nome.trim())
          throw Error("Informe seu nome.");
        for (let t of s.questao_keys) {
          let l = { ...o.respostas[t] ?? {} };
          for (let f of o.fotos.filter((D) => D.nc_key === t)) {
            let D = l[f.questao_key] ??= {};
            D.fotos = (D.fotos ?? 0) + 1;
          }
          if (Ao(s.modelo_snapshot.definicao, l).pendentes.length)
            throw Error("Ainda há perguntas obrigatórias sem resposta.");
          s.respostas[t] = l;
        }
        if (s.anexos = o.fotos.map((t) => ({ client_uuid: t.client_uuid, questao_key: t.questao_key, nc_key: t.nc_key, tipo: "foto", mime: "image/jpeg", bytes: t.bytes })), s.respondido_por = o.nome.trim(), s.respondido_em = p(), s.modelo_snapshot.exige_aprovacao)
          s.status = "em_aprovacao";
        else
          s.status = "finalizado", s.finalizado_em = p();
        s.updated_at = p();
      });
    },
    async decidirPlano(r, o, e, n = "") {
      if (M(r, "gerenciar_planos"), e === "reprovada" && n.trim().length < 3)
        throw Error("Diga o que falta na correção.");
      await a.atraso();
      let s = Do(), t = await bo(s);
      return A("planos", (l) => {
        let c = l.planos.find((f) => f.id === o);
        if (!c)
          throw Error("Plano não encontrado.");
        if (c.status !== "em_aprovacao")
          throw Error("Este plano não está esperando aprovação.");
        if (e === "aprovada")
          c.status = "finalizado", c.finalizado_em = p(), c.aprovado_por = r.id;
        else {
          (c.reprovacoes ??= []).push({ em: p(), por: r.id, comentario: n.trim(), respondido_por: c.respondido_por, respostas: _(c.respostas) });
          let f = l.planosModelo.find((D) => D.id === c.modelo_id)?.prazo_dias ?? 3;
          if (Object.assign(c, { status: "aberto", respostas: {}, anexos: [], respondido_por: void 0, respondido_em: null, prazo: Q(B(), f), token_hash: t }), c.responsavel_email) {
            c.ultimo_email_em = p();
            let D = l.avaliados.find((w) => w.id === c.avaliado_id)?.nome ?? "";
            vo(l, {
              idem_key: `plano-devolvido:${c.id}:${t.slice(0, 16)}`,
              para: c.responsavel_email,
              assunto: `Correção devolvida: ${c.modelo_snapshot.nome} — ${D}`,
              texto: `A correção enviada não foi aceita: "${n.trim()}". Responda de novo até ${c.prazo.split("-").reverse().join("/")}.`,
              link: Po(s)
            });
          }
        }
        return c.updated_at = p(), c.status;
      });
    },
    async caixaDeSaida() {
      return await a.atraso(), _((await q()).emails).sort((r, o) => o.criado_em.localeCompare(r.criado_em));
    },
    async importarAvaliados(r, o = {}) {
      await a.atraso();
      let e = (n) => {
        let s = { novos: 0, atualizados: 0, erros: [] }, t = /* @__PURE__ */ new Map;
        return r.forEach((l, c) => {
          let f = c + 2, D = (l.nome ?? "").trim(), w = (l.codigo_externo ?? "").trim() || void 0;
          if (!D) {
            s.erros.push({ linha: f, motivo: "sem nome" });
            return;
          }
          if (l.email && !/^\S+@\S+\.\S+$/.test(l.email.trim())) {
            s.erros.push({ linha: f, motivo: `e-mail inválido: ${l.email}` });
            return;
          }
          if (w) {
            if (t.has(w)) {
              s.erros.push({ linha: f, motivo: `código ${w} repetido (já está na linha ${t.get(w)})` });
              return;
            }
            t.set(w, f);
          }
          let k = w ? n.avaliados.find((Z) => Z.codigo_externo === w) : n.avaliados.find((Z) => !Z.codigo_externo && Z.nome.toLowerCase() === D.toLowerCase()), R = Lo(n.camposAvaliado, { ...k?.campos ?? {}, ...l.campos ?? {} });
          if (R.erros.length) {
            s.erros.push({ linha: f, motivo: R.erros.join("; ") });
            return;
          }
          let I = {
            campos: R.valores,
            nome: D,
            codigo_externo: w,
            documento: l.documento?.trim() || void 0,
            email: l.email?.trim() || void 0,
            telefone: l.telefone?.trim() || void 0,
            endereco: l.endereco?.trim() || void 0
          };
          if (k) {
            for (let [Z, F] of Object.entries(I))
              if (F !== void 0)
                k[Z] = F;
            k.updated_at = p(), s.atualizados++;
          } else
            n.avaliados.push({ ...I, id: m(), org_id: i.id, ativo: !0, created_at: p(), updated_at: p() }), s.novos++;
        }), s;
      };
      if (o.simular)
        return e(_(await q()));
      return A("avaliados", e);
    },
    async aprovacoesPendentes(r) {
      await a.atraso();
      let o = await q();
      return o.inspecoes.filter((e) => e.status === "em_aprovacao" && mo(o, e).includes(r.id) && e.responsavel_id !== r.id).map((e) => ({
        ..._(e),
        etapas: T(o, e).length,
        avaliado: o.avaliados.find((n) => n.id === e.avaliado_id)?.nome ?? "",
        formulario: o.formularios.find((n) => n.id === e.formulario_id)?.nome ?? "",
        responsavel: o.membros.find((n) => n.id === e.responsavel_id)?.nome ?? ""
      })).sort((e, n) => (e.finalizada_em ?? "").localeCompare(n.finalizada_em ?? ""));
    },
    async decisoesDe(r) {
      await a.atraso();
      let o = await q();
      return o.aprovacoes.filter((e) => e.aprovador_id === r.id).map((e) => {
        let n = o.inspecoes.find((s) => s.id === e.inspecao_id);
        return { ..._(e), status: n?.status ?? "completa", avaliado: o.avaliados.find((s) => s.id === n?.avaliado_id)?.nome ?? "", formulario: o.formularios.find((s) => s.id === n?.formulario_id)?.nome ?? "", nota_pct: n?.nota_pct ?? null };
      }).sort((e, n) => n.em.localeCompare(e.em));
    },
    async aprovacaoDaInspecao(r) {
      let o = await q(), e = o.inspecoes.find((s) => s.id === r);
      if (!e)
        throw Error("Inspeção não encontrada.");
      let n = (s) => o.membros.find((t) => t.id === s)?.nome ?? "—";
      return T(o, e).map((s, t) => ({
        etapa: t + 1,
        aprovadores: s.aprovadores.map((l) => ({ id: l, nome: n(l) })),
        decisao: o.aprovacoes.filter((l) => l.inspecao_id === r && l.etapa === t + 1).map((l) => ({ ..._(l), aprovador: n(l.aprovador_id) }))[0] ?? null,
        atual: e.status === "em_aprovacao" && e.aprovacao_etapa === t + 1
      }));
    },
    decidir(r, o, e, n = "") {
      return M(r, "aprovar"), A("inspecoes", (s) => {
        let t = s.inspecoes.find((f) => f.id === o);
        if (!t)
          throw Error("Inspeção não encontrada.");
        if (t.status !== "em_aprovacao")
          throw Error("Esta inspeção não está esperando aprovação.");
        if (t.responsavel_id === r.id)
          throw Error("Quem aplicou não aprova a própria inspeção.");
        if (!mo(s, t).includes(r.id))
          throw Error("Esta etapa não é sua.");
        if (e === "reprovada" && n.trim().length < 3)
          throw Error("Diga o motivo da reprovação.");
        let l = t.aprovacao_etapa ?? 1;
        if (s.aprovacoes.some((f) => f.inspecao_id === t.id && f.etapa === l))
          throw Error("Esta etapa já foi decidida.");
        s.aprovacoes.push({ id: m(), org_id: i.id, inspecao_id: t.id, etapa: l, aprovador_id: r.id, decisao: e, comentario: n.trim() || void 0, em: p() });
        let c = T(s, t).length;
        if (e === "reprovada")
          t.status = "reprovada", t.aprovacao_etapa = null;
        else if (l >= c)
          t.status = "aprovada", t.aprovacao_etapa = null;
        else
          t.aprovacao_etapa = l + 1, W(s, t.id);
        return t.updated_at = p(), j(s, t.id, r.id, e, { etapa: l, de: c, comentario: n.trim() || void 0 }), t.status;
      });
    },
    gerarDadosDemo(r) {
      if (!r.is_master)
        return Promise.reject(Error("Só o dono da conta pode gerar dados de exemplo."));
      return A("inspecoes", (o) => {
        let e = 0;
        for (let n of we(B())) {
          if (o.inspecoes.some((t) => t.client_uuid === n.client_uuid))
            continue;
          if (Y(o, E(o, n.responsavel_id), { ...n, respostas: n.respostas, status: "completa", anexos: [], device_id: "demo" }, n.finalizada_em).ok)
            e++;
        }
        return e;
      });
    },
    async painel(r, o) {
      if (!X(r, "ver_painel"))
        throw Error("Você não tem acesso ao painel.");
      await a.atraso();
      let e = await q(), n = (S) => O(S), s = (Date.parse(o.ate) - Date.parse(o.de)) / 86400000 + 1, t = no(o.de, -s), l = no(o.de, -1), c = Object.entries(o.campos ?? {}).filter(([, S]) => S), f = (S) => !c.length || c.every(([C, U]) => e.avaliados.find((V) => V.id === S)?.campos?.[C] === U), D = e.inspecoes.filter((S) => S.status !== "rascunho" && S.finalizada_em && yo(r, S) && (!o.formulario_id || S.formulario_id === o.formulario_id) && f(S.avaliado_id)), w = (S, C) => D.filter((U) => {
        let V = n(U.finalizada_em);
        return V >= S && V <= C;
      }), k = w(o.de, o.ate), R = w(t, l), I = (S) => {
        let C = S.map((U) => U.nota_pct).filter((U) => U !== null);
        return C.length ? C.reduce((U, V) => U + V, 0) / C.length : null;
      }, Z = (S) => S.length ? S.reduce((C, U) => C + U.qtd_nao_conformidades, 0) / S.length : null, F = Date.now(), wo = e.ocorrencias.flatMap((S) => {
        let C = e.agendamentos.find((V) => V.id === S.agendamento_id);
        if (!C || !lo(r, C) || o.formulario_id && C.formulario_id !== o.formulario_id)
          return [];
        let U = n(S.previsto_em);
        return U >= o.de && U <= o.ate ? [zo(S, C, F)] : [];
      }), po = wo.filter((S) => S === "completa").length, fo = wo.filter((S) => S === "atrasada").length, Wo = (S) => no(S, -(((/* @__PURE__ */ new Date(S + "T12:00:00Z")).getUTCDay() + 6) % 7)), Xo = [];
      for (let S = Wo(o.de);S <= o.ate; S = no(S, 7)) {
        let C = k.filter((U) => Wo(n(U.finalizada_em)) === S);
        Xo.push({ semana: S, nota: I(C), qtd: C.length });
      }
      let Pe = [...new Set(k.map((S) => S.avaliado_id))].map((S) => {
        let C = k.filter((U) => U.avaliado_id === S);
        return { id: S, nome: e.avaliados.find((U) => U.id === S)?.nome ?? "Avaliado removido", nota: I(C), qtd: C.length, ncs: C.reduce((U, V) => U + V.qtd_nao_conformidades, 0) };
      }).sort((S, C) => (S.nota ?? 101) - (C.nota ?? 101) || S.nome.localeCompare(C.nome, "pt-BR")), Ho = /* @__PURE__ */ new Map, Io = /* @__PURE__ */ new Map;
      for (let S of k) {
        let C = e.versoes.find((V) => V.id === S.formulario_versao_id), U = e.formularios.find((V) => V.id === S.formulario_id)?.nome ?? "";
        for (let V of C?.definicao.topicos.flatMap((So) => So.questoes) ?? [])
          Ho.set(S.formulario_id + "|" + V.key, V.titulo);
        for (let [V, So] of Object.entries(S.resultado.questoes)) {
          if (So.conforme === null)
            continue;
          let Mo = Io.get(S.formulario_id + "|" + V) ?? { n: 0, aplicaveis: 0, formulario: U };
          if (Mo.aplicaveis++, So.conforme === !1)
            Mo.n++;
          Io.set(S.formulario_id + "|" + V, Mo);
        }
      }
      let Ie = [...Io.entries()].filter(([, S]) => S.n > 0).map(([S, C]) => ({ chave: S, titulo: Ho.get(S) ?? "Questão", formulario: C.formulario, n: C.n, pct: C.n / C.aplicaveis * 100 })).sort((S, C) => C.n - S.n || C.pct - S.pct).slice(0, 8);
      return {
        periodo: { de: o.de, ate: o.ate, anterior: { de: t, ate: l } },
        kpis: {
          inspecoes: { atual: k.length, anterior: R.length },
          nota: { atual: I(k), anterior: I(R) },
          ncs_por_inspecao: { atual: Z(k), anterior: Z(R) },
          agenda: { cumpridas: po, atrasadas: fo, pct: po + fo ? po / (po + fo) * 100 : null },
          planos_em_atraso: e.planos.filter((S) => so(S, B()) === "em_atraso" && (!o.formulario_id || S.formulario_id === o.formulario_id) && D.some((C) => C.id === S.inspecao_id)).length
        },
        semanas: Xo,
        porAvaliado: Pe,
        topNcs: Ie,
        formularios: e.formularios.filter((S) => !S.arquivado).map((S) => ({ id: S.id, nome: S.nome })),
        camposFiltro: e.camposAvaliado.filter((S) => S.tipo === "lista").map((S) => ({ id: S.id, nome: S.nome, opcoes: S.opcoes ?? [] }))
      };
    },
    async rodarAgenda() {
      return uo();
    },
    async listarOcorrencias(r, o = {}) {
      await uo(), await a.atraso();
      let e = await q(), n = Date.now(), s = (o.busca ?? "").trim().toLowerCase(), t = new Map(e.membros.map((l) => [l.id, l.nome]));
      return e.ocorrencias.flatMap((l) => {
        let c = e.agendamentos.find((k) => k.id === l.agendamento_id);
        if (!c || !lo(r, c))
          return [];
        let f = O(l.previsto_em, c.fuso_horario);
        if (o.de && f < o.de)
          return [];
        if (o.ate && f > o.ate)
          return [];
        let D = zo(l, c, n);
        if (o.situacao && D !== o.situacao)
          return [];
        let w = {
          ..._(l),
          situacao: D,
          agendamento: _(c),
          descricao: jo(c),
          formulario: e.formularios.find((k) => k.id === c.formulario_id)?.nome ?? "Formulário removido",
          avaliado: e.avaliados.find((k) => k.id === c.avaliado_id)?.nome ?? "Avaliado removido",
          responsaveis: c.responsaveis.map((k) => t.get(k) ?? "—")
        };
        if (s && ![w.formulario, w.avaliado, ...w.responsaveis].join(" ").toLowerCase().includes(s))
          return [];
        return [w];
      }).sort((l, c) => l.previsto_em.localeCompare(c.previsto_em) || l.avaliado.localeCompare(c.avaliado, "pt-BR"));
    },
    async obterAgendamento(r) {
      let o = (await q()).agendamentos.find((e) => e.id === r);
      if (!o)
        throw Error("Agendamento não encontrado.");
      return _(o);
    },
    async salvarAgendamento(r, o) {
      return M(r, "gerenciar_agendamentos"), await a.atraso(), await A("agenda", (n) => {
        let s = {
          data_inicio: o.data_inicio,
          horarios: o.dia_inteiro ? [] : [...new Set(o.horarios)].sort(),
          dia_inteiro: o.dia_inteiro,
          fuso_horario: i.fuso_horario,
          recorrencia: o.recorrencia,
          dias_semana: o.recorrencia === "semanal" ? [...new Set(o.dias_semana ?? [])].sort() : void 0,
          termino: o.recorrencia === "nenhuma" ? "nunca" : o.termino,
          termino_data: o.termino === "data" ? o.termino_data : void 0,
          termino_qtd: o.termino === "quantidade" ? o.termino_qtd : void 0
        }, t = me(s), l = n.formularios.find((w) => w.id === o.formulario_id && !w.arquivado);
        if (!l)
          t.push("Escolha um formulário.");
        else if (!l.versao_publicada_id)
          t.push("Este formulário ainda não foi publicado.");
        if (!n.avaliados.some((w) => w.id === o.avaliado_id))
          t.push("Escolha o avaliado.");
        else if (l && l.avaliados_vinculados.length && !l.avaliados_vinculados.includes(o.avaliado_id))
          t.push("Este formulário não vale para o avaliado escolhido.");
        if (!o.responsaveis.length)
          t.push("Escolha quem vai aplicar.");
        let c = co(n.membros, n.funcoes, n.equipes);
        for (let w of o.responsaveis) {
          let k = c.find((R) => R.id === w);
          if (!k || !k.ativo)
            t.push("Uma das pessoas escolhidas não está mais ativa.");
          else if (!X(k, "aplicar") || !K(k, o.formulario_id) || !N(k, o.avaliado_id))
            t.push(`${k.nome} não tem acesso a este formulário ou avaliado. Libere em Permissões.`);
        }
        if (t.length)
          throw Error(t.join(" "));
        let f;
        if (o.id) {
          let w = n.agendamentos.find((R) => R.id === o.id);
          if (!w)
            throw Error("Agendamento não encontrado.");
          let k = p();
          if (n.ocorrencias = n.ocorrencias.filter((R) => !(R.agendamento_id === w.id && R.status === "pendente" && R.previsto_em > k)), Object.assign(w, s, { formulario_id: o.formulario_id, avaliado_id: o.avaliado_id, responsaveis: [...o.responsaveis], ativo: !0, updated_at: k }), delete w.dias_semana, s.dias_semana)
            w.dias_semana = s.dias_semana;
          f = w;
        } else
          f = {
            ...s,
            id: m(),
            org_id: i.id,
            formulario_id: o.formulario_id,
            avaliado_id: o.avaliado_id,
            responsaveis: [...o.responsaveis],
            ativo: !0,
            materializado_ate: null,
            criado_por: r.id,
            created_at: p(),
            updated_at: p()
          }, n.agendamentos.push(f);
        let D = ro(n, f);
        return { agendamento: _(f), geradas: D };
      });
    },
    inativarOcorrencia(r, o, e, n) {
      return A("agenda", (s) => {
        let t = s.ocorrencias.find((f) => f.id === o);
        if (!t)
          throw Error("Ocorrência não encontrada.");
        let l = s.agendamentos.find((f) => f.id === t.agendamento_id);
        if (!X(r, "gerenciar_agendamentos") && !l.responsaveis.includes(r.id))
          throw Error("Você não tem permissão para isso.");
        if (n.trim().length < 3)
          throw Error("Escreva o motivo.");
        if (t.status !== "pendente")
          throw Error("Só dá para inativar o que ainda está pendente.");
        let c = e === "esta" ? [t] : s.ocorrencias.filter((f) => f.agendamento_id === l.id && f.status === "pendente" && f.previsto_em >= t.previsto_em);
        for (let f of c)
          Object.assign(f, { status: "inativa", justificativa: n.trim(), inativada_por: r.id, updated_at: p() });
        if (e === "seguintes")
          l.ativo = !1, l.updated_at = p();
        return c.length;
      });
    },
    async listarPessoas() {
      return await a.atraso(), _((await q()).membros).sort((r, o) => Number(o.ativo) - Number(r.ativo) || r.nome.localeCompare(o.nome, "pt-BR"));
    },
    convidarPessoa(r, o) {
      M(r, "gerenciar_permissoes");
      let e = o.nome.trim(), n = o.email.trim().toLowerCase();
      if (!e)
        return Promise.reject(Error("Informe o nome."));
      if (!/^\S+@\S+\.\S+$/.test(n))
        return Promise.reject(Error("Informe um e-mail válido."));
      return A("membros", (s) => {
        if (s.membros.some((l) => l.email.toLowerCase() === n))
          throw Error("Já existe uma pessoa com esse e-mail.");
        if (!s.funcoes.some((l) => l.id === o.funcao_id))
          throw Error("Escolha uma função.");
        let t = { id: m(), org_id: i.id, nome: e, email: n, funcao_id: o.funcao_id, is_master: !1, ativo: !0, acesso: _(ee), created_at: p() };
        return s.membros.push(t), vo(s, {
          idem_key: `convite:${t.id}`,
          para: n,
          assunto: `Você foi convidado para ${i.nome} no Inspeta`,
          texto: `${r.nome} liberou seu acesso como ${s.funcoes.find((l) => l.id === t.funcao_id)?.nome}. Entre com este e-mail e crie sua senha no primeiro acesso.`,
          link: `${a.urlApp()}#/entrar`
        }), _(t);
      });
    },
    salvarPessoa(r, o, e) {
      return M(r, "gerenciar_permissoes"), A("membros", (n) => {
        let s = n.membros.find((t) => t.id === o);
        if (!s)
          throw Error("Pessoa não encontrada.");
        if (s.is_master && (e.funcao_id !== void 0 && e.funcao_id !== s.funcao_id || e.ativo === !1))
          throw Error("O dono da conta é sempre Administrador e não pode ser desativado.");
        if (e.ativo === !1 && o === r.id)
          throw Error("Você não pode desativar o seu próprio acesso.");
        if (e.funcao_id && !n.funcoes.some((t) => t.id === e.funcao_id))
          throw Error("Função não encontrada.");
        if (e.nome !== void 0 && !e.nome.trim())
          throw Error("Informe o nome.");
        if (e.acesso)
          e = { ...e, acesso: oo(n, e.acesso, o) };
        return Object.assign(s, _(e)), _(s);
      });
    },
    async listarFuncoes() {
      await a.atraso();
      let r = await q();
      return r.funcoes.map((o) => ({ ..._(o), qtd_pessoas: r.membros.filter((e) => e.ativo && e.funcao_id === o.id).length }));
    },
    criarFuncao(r, o, e) {
      return M(r, "gerenciar_permissoes"), A("membros", (n) => {
        let s = o.trim();
        if (!s)
          throw Error("Dê um nome à função.");
        if (n.funcoes.some((c) => c.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        let t = n.funcoes.find((c) => c.id === e), l = { id: m(), nome: s, acoes: t ? [...t.acoes] : ["aplicar"] };
        return n.funcoes.push(l), _(l);
      });
    },
    salvarFuncao(r, o) {
      return M(r, "gerenciar_permissoes"), A("membros", (e) => {
        let n = e.funcoes.find((t) => t.id === o.id);
        if (!n)
          throw Error("Função não encontrada.");
        if (n.sistema)
          throw Error("A função Administrador tem todas as ações e não pode ser alterada.");
        let s = o.nome.trim();
        if (!s)
          throw Error("Dê um nome à função.");
        if (e.funcoes.some((t) => t.id !== o.id && t.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        return n.nome = s, n.acoes = [...new Set(o.acoes)], _(n);
      });
    },
    excluirFuncao(r, o) {
      return M(r, "gerenciar_permissoes"), A("membros", (e) => {
        let n = e.funcoes.find((t) => t.id === o);
        if (!n)
          return;
        if (n.sistema)
          throw Error("A função Administrador não pode ser excluída.");
        let s = e.membros.filter((t) => t.funcao_id === o).length;
        if (s)
          throw Error(`Há ${s} ${s === 1 ? "pessoa" : "pessoas"} com esta função. Troque a função delas antes de excluir.`);
        e.funcoes = e.funcoes.filter((t) => t.id !== o);
      });
    },
    async listarEquipes() {
      return await a.atraso(), _((await q()).equipes).sort((r, o) => r.nome.localeCompare(o.nome, "pt-BR"));
    },
    criarEquipe(r, o) {
      return M(r, "gerenciar_permissoes"), A("membros", (e) => {
        let n = o.trim();
        if (!n)
          throw Error("Dê um nome à equipe.");
        if (e.equipes.some((t) => t.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        let s = { id: m(), org_id: i.id, nome: n, membros: [], acesso: _(ae) };
        return e.equipes.push(s), _(s);
      });
    },
    salvarEquipe(r, o) {
      return M(r, "gerenciar_permissoes"), A("membros", (e) => {
        let n = e.equipes.find((t) => t.id === o.id);
        if (!n)
          throw Error("Equipe não encontrada.");
        let s = o.nome.trim();
        if (!s)
          throw Error("Dê um nome à equipe.");
        if (e.equipes.some((t) => t.id !== o.id && t.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        return n.nome = s, n.membros = [...new Set(o.membros)].filter((t) => e.membros.some((l) => l.id === t)), n.acesso = oo(e, o.acesso), _(n);
      });
    },
    excluirEquipe(r, o) {
      return M(r, "gerenciar_permissoes"), A("membros", (e) => {
        e.equipes = e.equipes.filter((n) => n.id !== o);
        for (let n of [...e.membros.map((s) => s.acesso), ...e.equipes.map((s) => s.acesso)])
          n.ver_equipes = n.ver_equipes.filter((s) => s !== o);
      });
    },
    async _podeVer(r, o, e) {
      let n = await q(), s = (c) => !!c && (yo(r, c) || eo(n, r, c));
      if (o === "inspecao")
        return s(n.inspecoes.find((c) => c.id === e));
      if (e.startsWith("logo-"))
        return !0;
      let t = n.inspecoes.find((c) => c.anexos.some((f) => f.client_uuid === e));
      if (t)
        return s(t);
      let l = n.planos.find((c) => c.anexos.some((f) => f.client_uuid === e));
      if (l)
        return X(r, "gerenciar_planos") || s(n.inspecoes.find((c) => c.id === l.inspecao_id));
      return !1;
    },
    async _membroPorEmail(r) {
      let o = await q();
      return co(o.membros, o.funcoes, o.equipes).find((e) => e.email.toLowerCase() === r.toLowerCase()) ?? null;
    },
    async _membrosResolvidos() {
      let r = await q();
      return co(r.membros, r.funcoes, r.equipes);
    },
    async _reset() {
      await a.local.limpar(), a.aviso("reset");
    }
  };
  function oo(r, o, e) {
    let n = new Set(r.formularios.map((c) => c.id)), s = new Set(r.avaliados.map((c) => c.id)), t = new Set(r.membros.map((c) => c.id)), l = new Set(r.equipes.map((c) => c.id));
    return {
      formularios: o.formularios === "todos" ? "todos" : [...new Set(o.formularios)].filter((c) => n.has(c)),
      avaliados: o.avaliados === "todos" ? "todos" : [...new Set(o.avaliados)].filter((c) => s.has(c)),
      ver_membros: [...new Set(o.ver_membros)].filter((c) => t.has(c) && c !== e),
      ver_equipes: [...new Set(o.ver_equipes)].filter((c) => l.has(c))
    };
  }
  function lo(r, o) {
    return X(r, "gerenciar_agendamentos") || X(r, "ver_todas_inspecoes") || o.responsaveis.some((e) => e === r.id || r.ve_inspecoes_de.includes(e));
  }
  function O(r, o = i.fuso_horario) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: o }).format(new Date(r));
  }
  function ro(r, o, e = Date.now()) {
    if (!o.ativo)
      return 0;
    let n = O(new Date(e).toISOString(), o.fuso_horario), s = no(n, 14), t = 0;
    for (let l of ue(o, n, s)) {
      if (Date.parse(ko(l, o)) <= e)
        continue;
      if (r.ocorrencias.some((c) => c.agendamento_id === o.id && c.previsto_em === l))
        continue;
      r.ocorrencias.push({ id: m(), org_id: i.id, agendamento_id: o.id, previsto_em: l, status: "pendente", created_at: p(), updated_at: p() }), t++;
    }
    return o.materializado_ate = s, t;
  }
  function uo() {
    return a.exclusivo(async () => {
      let r = await q(), o = B(), e = r.agendamentos.filter((s) => s.ativo && s.materializado_ate !== no(o, 14)), n = 0;
      for (let s of e)
        n += ro(r, s);
      if (e.length)
        await b(r, n ? "agenda" : "agenda-silencioso");
      return n;
    });
  }
  function _o(r, o, e, n) {
    if (!e.ocorrencia_id)
      return null;
    let s = r.ocorrencias.find((l) => l.id === e.ocorrencia_id), t = s && r.agendamentos.find((l) => l.id === s.agendamento_id);
    if (!s || !t || !t.responsaveis.includes(o.id) || t.formulario_id !== e.formulario_id || t.avaliado_id !== e.avaliado_id)
      return null;
    if (s.status === "completa" && s.inspecao_id && s.inspecao_id === n)
      return s.id;
    if (s.status !== "pendente")
      return null;
    return s.status = "completa", s.updated_at = p(), s.id;
  }
  function T(r, o) {
    return r.versoes.find((e) => e.id === o.formulario_versao_id)?.definicao.config.aprovacao?.etapas ?? [];
  }
  function mo(r, o) {
    return o.status === "em_aprovacao" ? T(r, o)[(o.aprovacao_etapa ?? 1) - 1]?.aprovadores ?? [] : [];
  }
  function eo(r, o, e) {
    return X(o, "aprovar") && T(r, e).some((n) => n.aprovadores.includes(o.id));
  }
  function W(r, o) {
    let e = r.inspecoes.find((t) => t.id === o), n = r.avaliados.find((t) => t.id === e.avaliado_id)?.nome ?? "", s = r.formularios.find((t) => t.id === e.formulario_id)?.nome ?? "";
    for (let t of mo(r, e)) {
      let l = r.membros.find((c) => c.id === t);
      if (!l?.ativo || t === e.responsavel_id)
        continue;
      vo(r, {
        idem_key: `aprovacao:${e.id}:${e.aprovacao_etapa}:${t}`,
        para: l.email,
        assunto: `Aprovação pendente: ${s} — ${n}`,
        texto: `A inspeção em ${n} (nota ${e.nota_pct === null ? "—" : String(e.nota_pct).replace(".", ",") + "%"}) espera a sua decisão na etapa ${e.aprovacao_etapa} de ${T(r, e).length}.`,
        link: `${a.urlApp()}#/web/inspecoes/${e.id}`
      });
    }
  }
  function B() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: i.fuso_horario }).format(/* @__PURE__ */ new Date);
  }
  function Q(r, o) {
    let e = /* @__PURE__ */ new Date(r + "T12:00:00Z");
    return e.setUTCDate(e.getUTCDate() + o), e.toISOString().slice(0, 10);
  }
  function so(r, o) {
    return r.status === "aberto" && r.prazo < o ? "em_atraso" : r.status;
  }
  function Do() {
    let r = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(r, (o) => o.toString(16).padStart(2, "0")).join("");
  }
  async function bo(r) {
    let o = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(r));
    return Array.from(new Uint8Array(o), (e) => e.toString(16).padStart(2, "0")).join("");
  }
  function Po(r) {
    return `${a.urlApp()}#/p/${r}`;
  }
  function vo(r, o) {
    if (r.emails.some((e) => e.idem_key === o.idem_key))
      return !1;
    return r.emails.push({ ...o, id: m(), criado_em: p(), status: o.para ? a.enviaEmails ? "pendente" : "enviado" : "sem_destinatario" }), !0;
  }
  function Go(r, o, e, n) {
    let s = r.avaliados.find((l) => l.id === o.avaliado_id)?.nome ?? "", t = o.prazo.split("-").reverse().join("/");
    return {
      idem_key: `plano:${o.id}:${n.slice(0, 16)}`,
      para: o.responsavel_email ?? "",
      assunto: `Plano de ação: ${o.modelo_snapshot.nome} — ${s}`,
      texto: `A inspeção em ${s} encontrou ${o.questao_keys.length} ${o.questao_keys.length === 1 ? "não conformidade" : "não conformidades"} que precisam de correção até ${t}.
Abra o link para registrar o que foi feito. Não precisa de senha.`,
      link: e
    };
  }
  async function De(r) {
    let o = await q(), e = o.inspecoes.find((c) => c.id === r);
    if (!e || e.status === "rascunho")
      return;
    let n = o.versoes.find((c) => c.id === e.formulario_versao_id), s = new Map(n.definicao.topicos.flatMap((c) => c.questoes).map((c) => [c.key, c])), t = [];
    for (let c of e.resultado.nao_conformidades) {
      let f = s.get(c)?.plano_acao_modelo_id, D = f ? o.planosModelo.find((k) => k.id === f) : void 0;
      if (!D)
        continue;
      let w = D.agrupamento === "por_inspecao" ? t.find((k) => k.modelo.id === D.id) : void 0;
      if (w)
        w.keys.push(c);
      else
        t.push({ modelo: D, keys: [c] });
    }
    let l = await Promise.all(t.map(async () => {
      let c = Do();
      return { t: c, h: await bo(c) };
    }));
    await A("planos", (c) => {
      let f = c.avaliados.find((I) => I.id === e.avaliado_id);
      t.forEach((I, Z) => {
        let F = [...I.keys].sort().join(",");
        if (c.planos.some((fo) => fo.inspecao_id === e.id && fo.modelo_id === I.modelo.id && [...fo.questao_keys].sort().join(",") === F))
          return;
        let wo = I.modelo.destinatario === "fixo" ? I.modelo.email_fixo ?? null : f?.email ?? null, po = {
          id: m(),
          org_id: i.id,
          modelo_id: I.modelo.id,
          modelo_snapshot: { nome: I.modelo.nome, definicao: _(I.modelo.definicao), exige_aprovacao: !!I.modelo.exige_aprovacao },
          inspecao_id: e.id,
          avaliado_id: e.avaliado_id,
          formulario_id: e.formulario_id,
          questao_keys: I.keys,
          responsavel_email: wo,
          token_hash: l[Z].h,
          prazo: Q(B(), I.modelo.prazo_dias),
          status: "aberto",
          respostas: {},
          anexos: [],
          finalizado_em: null,
          ultimo_email_em: wo ? p() : null,
          created_at: p(),
          updated_at: p()
        };
        c.planos.push(po), vo(c, Go(c, po, Po(l[Z].t), l[Z].h));
      });
      let D = n.definicao.config.relatorio?.emails, w = /* @__PURE__ */ new Set;
      if (D?.avaliado && f?.email)
        w.add(f.email);
      for (let I of D?.extras ?? [])
        if (I.trim())
          w.add(I.trim());
      let k = c.formularios.find((I) => I.id === e.formulario_id)?.nome ?? "", R = [];
      for (let I of w)
        if (vo(c, {
          idem_key: `relatorio:${e.id}:${I}`,
          para: I,
          assunto: `Relatório: ${k} — ${f?.nome ?? ""} — ${e.nota_pct === null ? "sem nota" : String(e.nota_pct).replace(".", ",") + "%"}`,
          texto: `Segue o relatório da inspeção finalizada em ${new Date(e.finalizada_em ?? e.iniciada_em).toLocaleString("pt-BR", { timeZone: i.fuso_horario })}. ${e.qtd_nao_conformidades} não conformidade(s).`,
          anexo: { tipo: "relatorio_pdf", inspecao_id: e.id }
        }))
          R.push(I);
      if (R.length)
        j(c, e.id, null, "relatorio_enviado", { para: R });
    });
  }
  return to;
}

// backend/repo.ts
async function Se(a, i) {
  await a`select set_config('inspeta.org_id', ${i}, true)`, await a`set local role inspeta_api`;
}
function ho(a, i, d) {
  return a.begin(async (u) => (await Se(u, i), d(u)));
}
var Ke = [
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
function xe() {
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
function qe(a) {
  return {
    async get(i, d) {
      return (await ho(a, i, async (v) => v`select data_url from anexos where org_id = ${i} and id = ${d}`))[0]?.data_url;
    },
    async set(i, d, u) {
      let v = Math.round((u.length - u.indexOf(",") - 1) * 3 / 4);
      await ho(a, i, async (m) => m`insert into anexos (org_id, id, data_url, bytes) values (${i}, ${d}, ${u}, ${v})
        on conflict (org_id, id) do nothing`);
    },
    async presentes(i, d) {
      if (!d.length)
        return /* @__PURE__ */ new Set;
      let u = await ho(a, i, async (v) => v`select id from anexos where org_id = ${i} and id = any(string_to_array(${d.join(",")}, ','))`);
      return new Set(u.map((v) => v.id));
    }
  };
}
function Ze(a, i, d) {
  let u = null, v = /* @__PURE__ */ new Map, m = 0, p = (b) => u ? b(u) : ho(a, i.id, b), _ = /* @__PURE__ */ new Map, q = /* @__PURE__ */ new Set;
  return {
    org: i,
    avisos: q,
    enviaEmails: d.enviaEmails,
    async carregar() {
      let [b, g] = await p(async (x) => [
        await x`select colecao, id, dados from registros where org_id = ${i.id} order by seq`,
        await x`select contadores from orgs where id = ${i.id}`
      ]), h = xe();
      v = /* @__PURE__ */ new Map;
      for (let x of b) {
        let E = typeof x.dados === "string" ? JSON.parse(x.dados) : x.dados;
        h[x.colecao].push(E), v.set(`${x.colecao}:${x.id}`, JSON.stringify(E));
      }
      let y = g[0]?.contadores;
      return h.eventoSeq = m = Number((typeof y === "string" ? JSON.parse(y) : y)?.eventoSeq ?? 0), h;
    },
    async gravar(b) {
      await p(async (g) => {
        let h = /* @__PURE__ */ new Set;
        for (let y of Ke)
          for (let x of b[y]) {
            let E = `${y}:${x.id}`;
            h.add(E);
            let A = JSON.stringify(x);
            if (v.get(E) === A)
              continue;
            await g`insert into registros (org_id, colecao, id, dados) values (${i.id}, ${y}, ${String(x.id)}, ${A}::text::jsonb)
            on conflict (org_id, colecao, id) do update set dados = excluded.dados, atualizado = now()`, v.set(E, A);
          }
        for (let y of [...v.keys()]) {
          if (h.has(y))
            continue;
          let x = y.indexOf(":");
          await g`delete from registros where org_id = ${i.id} and colecao = ${y.slice(0, x)} and id = ${y.slice(x + 1)}`, v.delete(y);
        }
        if (b.eventoSeq !== m)
          await g`update orgs set contadores = jsonb_set(contadores, '{eventoSeq}', ${String(b.eventoSeq)}::text::jsonb) where id = ${i.id}`, m = b.eventoSeq;
      });
    },
    async exclusivo(b) {
      if (u)
        return b();
      return a.begin(async (g) => {
        await Se(g, i.id), await g`select pg_advisory_xact_lock(hashtext(${i.id}))`, u = g;
        try {
          return await b();
        } finally {
          u = null;
        }
      });
    },
    estadoInicial: xe,
    anexo: (b) => d.anexos.get(i.id, b),
    guardarAnexo: (b, g) => d.anexos.set(i.id, b, g),
    anexosPresentes: (b) => d.anexos.presentes(i.id, b),
    urlApp: () => d.urlApp,
    atraso: async () => {
      return;
    },
    aviso: (b) => {
      q.add(b);
    },
    exigirRede: () => {
      return;
    },
    local: { get: (b) => _.get(b) ?? null, set: (b, g) => {
      _.set(b, g);
    }, del: (b) => {
      _.delete(b);
    }, limpar: async () => {
      _.clear();
    } }
  };
}
function Jo(a, i, d) {
  let u = Ze(a, i, d);
  return { servidor: ye(u), avisos: u.avisos };
}

// backend/api.ts
var Ye = { porIp: 600, porUsuario: 300, publicoPorIp: 30, falhasPorIp: 20, convitesPorOrg: 30 }, P = (a, i = {}) => ({ acao: a, ...i }), Ge = {
  listarFormularios: P("membro"),
  obterFormulario: P("membro"),
  obterVersao: P("membro"),
  criarFormulario: P("gerenciar_formularios"),
  salvarRascunho: P("gerenciar_formularios"),
  publicar: P("gerenciar_formularios", { quemId: 1 }),
  salvarLogo: P("gerenciar_formularios"),
  layoutRelatorio: P("membro"),
  listarAvaliados: P("membro"),
  listarCamposAvaliado: P("membro"),
  criarAvaliado: P("gerenciar_avaliados"),
  salvarAvaliado: P("gerenciar_avaliados"),
  importarAvaliados: P("gerenciar_avaliados"),
  salvarCamposAvaliado: P("gerenciar_avaliados", { quem: 0 }),
  listarInspecoes: P("membro", { quem: 0 }),
  obterInspecao: P("membro", { quem: 0 }),
  eventos: P("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  aprovacaoDaInspecao: P("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  planosDaInspecao: P("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  registrarRelatorio: P("membro", { quemId: 1, ver: { tipo: "inspecao", arg: 0 } }),
  anexo: P("membro", { ver: { tipo: "anexo", arg: 0 } }),
  pacote: P("aplicar", { quemId: 0 }),
  enviarAnexo: P("aplicar", { quemId: 0 }),
  enviarInspecoes: P("aplicar", { quemId: 0 }),
  listarPlanosModelo: P("membro"),
  obterPlanoModelo: P("membro"),
  criarPlanoModelo: P("gerenciar_planos"),
  salvarPlanoModelo: P("gerenciar_planos"),
  listarPlanos: P("membro", { quem: 0 }),
  novoLinkPlano: P("gerenciar_planos", { quem: 1 }),
  decidirPlano: P("gerenciar_planos", { quem: 0 }),
  caixaDeSaida: P("gerenciar_planos"),
  aprovacoesPendentes: P("membro", { quem: 0 }),
  decisoesDe: P("membro", { quem: 0 }),
  decidir: P("aprovar", { quem: 0 }),
  gerarDadosDemo: P("dono", { quem: 0 }),
  painel: P("ver_painel", { quem: 0 }),
  rodarAgenda: P("membro"),
  listarOcorrencias: P("membro", { quem: 0 }),
  obterAgendamento: P("membro"),
  salvarAgendamento: P("gerenciar_agendamentos", { quem: 0 }),
  inativarOcorrencia: P("membro", { quem: 0 }),
  listarPessoas: P("membro"),
  listarFuncoes: P("membro"),
  listarEquipes: P("membro"),
  convidarPessoa: P("gerenciar_permissoes", { quem: 0 }),
  salvarPessoa: P("gerenciar_permissoes", { quem: 0 }),
  criarFuncao: P("gerenciar_permissoes", { quem: 0 }),
  salvarFuncao: P("gerenciar_permissoes", { quem: 0 }),
  excluirFuncao: P("gerenciar_permissoes", { quem: 0 }),
  criarEquipe: P("gerenciar_permissoes", { quem: 0 }),
  salvarEquipe: P("gerenciar_permissoes", { quem: 0 }),
  excluirEquipe: P("gerenciar_permissoes", { quem: 0 })
}, We = /* @__PURE__ */ new Set(["planoPorToken", "responderPlano"]);

class H extends Error {
  status;
  esperar;
  constructor(a, i, d) {
    super(i);
    this.status = a;
    this.esperar = d;
  }
}
var Ae = (a) => new H(429, "Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.", a);
async function Ko(a) {
  let i = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(a));
  return Array.from(new Uint8Array(i), (d) => d.toString(16).padStart(2, "0")).join("");
}
function ke(a) {
  let i = /* @__PURE__ */ new Map, d = a.agora ?? Date.now, u = a.limites === !1 ? null : { ...Ye, ...a.limites ?? {} };
  async function v(x, E, A) {
    if (!u)
      return;
    let [j] = await a.sql`select interno.consumir(${x}, ${E}, ${A}) as ok`;
    if (!j?.ok)
      throw Ae(A);
  }
  async function m(x, E, A) {
    if (!u)
      return;
    let [j] = await a.sql`select interno.contagem(${x}, ${A}) as n`;
    if (Number(j?.n ?? 0) >= E)
      throw Ae(A);
  }
  async function p(x) {
    let E = (x.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || x.headers.get("x-real-ip") || "sem-ip";
    return (await Ko("inspeta-ip:" + E)).slice(0, 24);
  }
  async function _(x) {
    let E = i.get(x);
    if (E && E.ate > d())
      return E.email;
    let A = await fetch(`${a.authUrl}/user`, { headers: { Authorization: `Bearer ${x}`, apikey: a.anonKey } });
    if (!A.ok)
      throw new H(401, "Sua sessão expirou. Entre de novo.");
    let j = await A.json();
    if (!j.email)
      throw new H(401, "Sessão sem e-mail.");
    if (i.size > 500)
      i.clear();
    return i.set(x, { email: j.email.toLowerCase(), ate: d() + 60000 }), j.email.toLowerCase();
  }
  async function q(x) {
    let E = await a.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'membros' and lower(r.dados->>'email') = ${x}
      order by coalesce((r.dados->>'ativo')::boolean, true) desc, o.criado_em limit 1`;
    if (!E[0])
      throw new H(403, "Este e-mail não tem acesso a nenhuma conta do Inspeta. Peça um convite ao administrador.");
    return { id: E[0].id, nome: E[0].nome, fuso_horario: E[0].fuso_horario };
  }
  async function b(x) {
    let E = await Ko(String(x)), A = await a.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'planos' and r.dados->>'token_hash' = ${E} limit 1`;
    if (!A[0])
      throw new H(404, "Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
    return { id: A[0].id, nome: A[0].nome, fuso_horario: A[0].fuso_horario };
  }
  async function g(x) {
    if (!a.serviceKey)
      return;
    let E = await fetch(`${a.authUrl}/invite${a.urlApp ? `?redirect_to=${encodeURIComponent(a.urlApp)}` : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.serviceKey}`, apikey: a.serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: x, data: {} })
    });
    if (!E.ok && E.status !== 422)
      console.error("convite falhou", E.status);
  }
  function h(x) {
    let E = x.headers.get("Origin") ?? "";
    return {
      "Access-Control-Allow-Origin": !a.origens?.length || a.origens.includes(E) ? E || "*" : "null",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin"
    };
  }
  let y = (x, E, A) => new Response(JSON.stringify(A), { status: E, headers: { "Content-Type": "application/json; charset=utf-8", ...h(x) } });
  return async (x) => {
    if (x.method === "OPTIONS")
      return new Response(null, { status: 204, headers: h(x) });
    if (x.method !== "POST")
      return y(x, 405, { ok: !1, erro: "Use POST." });
    let E;
    try {
      let z = await x.text();
      if (z.length > 20971520)
        throw new H(413, "Envio grande demais (máx. 20 MB).");
      E = JSON.parse(z);
    } catch (z) {
      return y(x, z instanceof H ? z.status : 400, { ok: !1, erro: z instanceof H ? z.message : "Corpo inválido." });
    }
    let A = String(E.metodo ?? ""), j = Array.isArray(E.args) ? [...E.args] : [], G = "";
    try {
      if (u)
        G = await p(x), await v(`ip:${G}`, u.porIp, 60);
      if (We.has(A)) {
        if (u)
          await v(`pub:${G}`, u.publicoPorIp, 60);
        let O = await b(String(j[0] ?? "")), { servidor: ro, avisos: uo } = Jo(a.sql, O, { urlApp: a.urlApp, anexos: a.anexos, enviaEmails: a.enviaEmails }), _o = ro[A], T = await _o(...j);
        return y(x, 200, { ok: !0, valor: T, avisos: [...uo] });
      }
      let z = x.headers.get("Authorization") ?? "";
      if (u)
        await m(`falha:${G}`, u.falhasPorIp, 600);
      if (!z.startsWith("Bearer "))
        throw new H(401, "Entre para continuar.");
      let J = await _(z.slice(7));
      if (u)
        await v(`u:${(await Ko(J)).slice(0, 24)}`, u.porUsuario, 60);
      let Y = await q(J), { servidor: K, avisos: N } = Jo(a.sql, Y, { urlApp: a.urlApp, anexos: a.anexos, enviaEmails: a.enviaEmails }), M = await K._membroPorEmail(J);
      if (!M || !M.ativo)
        throw new H(403, "Este acesso foi desativado. Fale com o administrador da conta.");
      if (A === "eu")
        return y(x, 200, { ok: !0, valor: { membro: M, membros: await K._membrosResolvidos(), org: Y } });
      let L = Ge[A];
      if (!L)
        throw new H(404, `Operação desconhecida: ${A}`);
      if (L.acao === "dono" ? !M.is_master : L.acao !== "membro" && !X(M, L.acao))
        throw new H(403, "Você não tem permissão para isso.");
      if (L.quem !== void 0)
        j[L.quem] = M;
      if (L.quemId !== void 0)
        j[L.quemId] = M.id;
      if (L.ver && !await K._podeVer(M, L.ver.tipo, String(j[L.ver.arg] ?? "")))
        throw new H(404, L.ver.tipo === "inspecao" ? "Inspeção não encontrada." : "Arquivo não encontrado.");
      if (A === "convidarPessoa" && u)
        await v(`convite:${Y.id}`, u.convitesPorOrg, 3600);
      let oo = await K[A].apply(K, j);
      if (A === "convidarPessoa" && oo && typeof oo === "object" && "email" in oo)
        await g(String(oo.email));
      if (N.size && A !== "rodarAgenda")
        await ho(a.sql, Y.id, async (O) => O`insert into auditoria (org_id, membro_id, metodo) values (${Y.id}, ${M.id}, ${A})`);
      let lo = N.has("membros") ? { membros: await K._membrosResolvidos() } : {};
      return y(x, 200, { ok: !0, valor: oo ?? null, avisos: [...N], ...lo });
    } catch (z) {
      if (z instanceof H) {
        if (z.status === 401 && u && G)
          await v(`falha:${G}`, 2147483647, 600).catch(() => {
            return;
          });
        let K = y(x, z.status, { ok: !1, erro: z.message });
        if (z.esperar)
          K.headers.set("Retry-After", String(z.esperar));
        return K;
      }
      let J = z instanceof Error ? z.message : String(z), Y = !(z instanceof Error && z.constructor === Error);
      if (Y)
        console.error(A, z);
      return y(x, Y ? 500 : 400, { ok: !1, erro: Y ? "Erro no servidor. Tente de novo em instantes." : J });
    }
  };
}

// backend/configInterna.ts
function Ee(a, i = 60000) {
  let d = null;
  return async () => {
    if (d && Date.now() - d.em < i)
      return d.v;
    let u = await a`select nome, valor from interno.config`, v = new Map(u.map((p) => [p.nome, p.valor])), m = {
      app_url: v.get("app_url") ?? "",
      origens: (v.get("origens") ?? "").split(",").map((p) => p.trim()).filter(Boolean),
      cron_secret: v.get("cron_secret") ?? "",
      url_jobs: v.get("url_jobs") ?? ""
    };
    return d = { em: Date.now(), v: m }, m;
  };
}

// backend/funcao-api.ts
var xo = (a) => Deno.env.get(a) ?? "", Yo = Xe(xo("SUPABASE_DB_URL"), { prepare: !1, max: 3, idle_timeout: 20 }), He = Ee(Yo), oa = qe(Yo), Zo = null;
Deno.serve(async (a) => {
  let i = await He(), d = i.app_url + "|" + i.origens.join(",");
  if (Zo?.chave !== d)
    Zo = { chave: d, h: ke({
      sql: Yo,
      authUrl: `${xo("SUPABASE_URL")}/auth/v1`,
      anonKey: xo("SUPABASE_ANON_KEY"),
      serviceKey: xo("SUPABASE_SERVICE_ROLE_KEY"),
      urlApp: i.app_url,
      origens: i.origens,
      anexos: oa,
      enviaEmails: !!xo("RESEND_API_KEY")
    }) };
  return Zo.h(a);
});
