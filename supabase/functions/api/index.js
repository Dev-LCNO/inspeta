// backend/funcao-api.ts
import Ze from "npm:postgres@3.4.5";

// app/src/data/acesso.ts
var Ee = { id: "", nome: "Sem função", acoes: [] };
function Xo(r, i) {
  if (r === "todos" || i === "todos")
    return "todos";
  return [.../* @__PURE__ */ new Set([...r, ...i])];
}
function so(r, i, d) {
  let u = (b) => d.filter((_) => b.includes(_.id)).flatMap((_) => _.membros);
  return r.map((b) => {
    let _ = i.find((p) => p.id === b.funcao_id) ?? Ee, m = d.filter((p) => p.membros.includes(b.id)), h = [b.acesso, ...m.map((p) => p.acesso)], y = h.reduce((p, x) => Xo(p, x.formularios), []), v = h.reduce((p, x) => Xo(p, x.avaliados), []), f = /* @__PURE__ */ new Set;
    for (let p of h) {
      for (let x of p.ver_membros)
        f.add(x);
      for (let x of u(p.ver_equipes))
        f.add(x);
    }
    return f.delete(b.id), {
      id: b.id,
      org_id: b.org_id,
      nome: b.nome,
      email: b.email,
      funcao_id: _.id,
      funcao: _.nome,
      acoes: b.is_master ? [.../* @__PURE__ */ new Set([..._.acoes])] : [..._.acoes],
      is_master: b.is_master,
      ativo: b.ativo,
      equipes: m.map((p) => p.id),
      formularios_permitidos: y,
      avaliados_permitidos: v,
      ve_inspecoes_de: [...f]
    };
  });
}
var Ho = { formularios: [], avaliados: "todos", ver_membros: [], ver_equipes: [] }, oe = { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] };
// packages/form-engine/src/formula.ts
class oo extends Error {
}
function ee(r) {
  let i = [], d = 0;
  while (d < r.length) {
    let u = r[d];
    if (u === " " || u === "\t") {
      d++;
      continue;
    }
    if (u === "[") {
      let b = r.indexOf("]", d);
      if (b < 0)
        throw new oo("colchete sem fechar");
      let _ = Number(r.slice(d + 1, b).trim());
      if (!Number.isInteger(_) || _ < 1)
        throw new oo(`referência inválida: ${r.slice(d, b + 1)}`);
      i.push({ t: "ref", v: _ }), d = b + 1;
      continue;
    }
    if (/[0-9.,]/.test(u)) {
      let b = d;
      while (b < r.length && /[0-9.,]/.test(r[b]))
        b++;
      let _ = r.slice(d, b).replace(",", "."), m = Number(_);
      if (!Number.isFinite(m))
        throw new oo(`número inválido: ${_}`);
      i.push({ t: "num", v: m }), d = b;
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
    throw new oo(`caractere não permitido: "${u}"`);
  }
  return i;
}
function Mo(r) {
  return ee(r).filter((i) => i.t === "ref").map((i) => i.v);
}
function Oo(r, i) {
  let d = ee(r), u = 0, b = !1, _ = () => d[u];
  function m() {
    let f = d[u++];
    if (!f)
      throw new oo("fórmula incompleta");
    if (f.t === "num")
      return f.v;
    if (f.t === "ref") {
      let p = i(f.v);
      if (p === null || p === void 0 || !Number.isFinite(p))
        return b = !0, 0;
      return p;
    }
    if (f.t === "op" && f.v === "-")
      return -m();
    if (f.t === "lp") {
      let p = y(), x = d[u++];
      if (!x || x.t !== "rp")
        throw new oo("parêntese sem fechar");
      return p;
    }
    throw new oo("termo inesperado");
  }
  function h() {
    let f = m();
    for (;; ) {
      let p = _();
      if (p && p.t === "op" && (p.v === "*" || p.v === "/")) {
        u++;
        let x = m();
        f = p.v === "*" ? f * x : f / x;
      } else
        return f;
    }
  }
  function y() {
    let f = h();
    for (;; ) {
      let p = _();
      if (p && p.t === "op" && (p.v === "+" || p.v === "-")) {
        u++;
        let x = h();
        f = p.v === "+" ? f + x : f - x;
      } else
        return f;
    }
  }
  let v = y();
  if (u !== d.length)
    throw new oo("sobrou texto depois da fórmula");
  if (b)
    return null;
  if (!Number.isFinite(v))
    return null;
  return v;
}

// packages/form-engine/src/engine.ts
function _o(r, i) {
  let d = 10 ** i;
  return Math.sign(r) * Math.round(Math.abs(r) * d + Number.EPSILON) / d;
}
function So(r) {
  let i = /* @__PURE__ */ new Map, d = /* @__PURE__ */ new Map, u = /* @__PURE__ */ new Map, b = /* @__PURE__ */ new Map, _ = 0;
  for (let m of r.topicos) {
    u.set(m.key, m);
    for (let h of m.questoes) {
      _++, i.set(h.key, { q: h, topic: m, numero: _ }), d.set(_, h);
      for (let y of h.opcoes ?? [])
        b.set(y.key, { option: y, question: h });
    }
  }
  return { questions: i, byNumber: d, topics: u, options: b };
}
function De(r, i) {
  if (!i)
    return !1;
  if (i.na)
    return !0;
  switch (r.tipo) {
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
function Pe(r, i) {
  if (!i?.opcoes?.length)
    return [];
  let d = new Set(i.opcoes);
  return (r.opcoes ?? []).filter((u) => d.has(u.key));
}
function Ie(r, i) {
  let d = r.numerica?.faixas_nota;
  if (!d?.length)
    return null;
  for (let u of d)
    if (u.ate === null || i <= u.ate)
      return u.pontos;
  return d[d.length - 1].pontos;
}
function ae(r) {
  switch (r.tipo) {
    case "escolha_simples": {
      let i = (r.opcoes ?? []).filter((d) => !d.na && typeof d.pontos === "number").map((d) => d.pontos);
      return i.length ? Math.max(...i) : null;
    }
    case "escolha_multipla": {
      let i = (r.opcoes ?? []).filter((d) => !d.na && typeof d.pontos === "number").map((d) => d.pontos);
      return i.length ? i.filter((d) => d > 0).reduce((d, u) => d + u, 0) : null;
    }
    case "numerica": {
      let i = r.numerica?.faixas_nota;
      return i?.length ? Math.max(...i.map((d) => d.pontos)) : null;
    }
    default:
      return null;
  }
}
function re(r, i) {
  let d = r.numerica?.limite;
  if (!d || d.min == null && d.max == null)
    return null;
  if (d.min != null && i < d.min)
    return !1;
  if (d.max != null && i > d.max)
    return !1;
  return !0;
}
function ie(r, i, d = So(r)) {
  let u = /* @__PURE__ */ new Map, b = /* @__PURE__ */ new Set, _ = (v) => {
    if (!v)
      return !0;
    if (!h(v.questao))
      return !1;
    return (i[v.questao]?.opcoes ?? []).includes(v.opcao);
  }, m = (v) => {
    let f = "t:" + v;
    if (u.has(f))
      return u.get(f);
    if (b.has(f))
      return !1;
    b.add(f);
    let p = _(d.topics.get(v)?.depende_de);
    return b.delete(f), u.set(f, p), p;
  };
  function h(v) {
    let f = "q:" + v;
    if (u.has(f))
      return u.get(f);
    let p = d.questions.get(v);
    if (!p)
      return !1;
    if (b.has(f))
      return !1;
    b.add(f);
    let x = m(p.topic.key) && _(p.q.depende_de);
    return b.delete(f), u.set(f, x), x;
  }
  let y = /* @__PURE__ */ new Set;
  for (let v of r.topicos)
    if (m(v.key))
      y.add(v.key);
  for (let v of d.questions.keys())
    if (h(v))
      y.add(v);
  return y;
}
function qo(r, i, d = {}) {
  let u = So(r), b = ie(r, i, u), _ = r.config.casas_decimais ?? 1, m = /* @__PURE__ */ new Map, h = /* @__PURE__ */ new Set, y = (N) => {
    let T = u.byNumber.get(N);
    if (!T || !b.has(T.key))
      return null;
    if (T.tipo === "numerica") {
      let J = i[T.key]?.numero;
      return typeof J === "number" && !i[T.key]?.na ? J : null;
    }
    if (T.tipo === "calculo")
      return v(T);
    return null;
  };
  function v(N) {
    if (m.has(N.key))
      return m.get(N.key);
    if (h.has(N.key) || !N.calculo?.formula)
      return null;
    h.add(N.key);
    let T = null, J = N.calculo.valor_se_vazio;
    try {
      T = Oo(N.calculo.formula, (ao) => {
        let io = y(ao);
        return io === null && J != null ? J : io;
      });
    } catch {
      T = null;
    }
    return h.delete(N.key), m.set(N.key, T), T;
  }
  let f = {}, p = {}, x = 1, k = 0, I = 0, D = [], L = [], H = 0, Q = 0;
  for (let N of r.topicos) {
    let T = 0, J = 0, ao = 1;
    for (let C of N.questoes) {
      let no = i[C.key], vo = u.questions.get(C.key).numero, yo = b.has(C.key), R = {
        key: C.key,
        numero: vo,
        visivel: yo,
        respondida: !1,
        na: !1,
        pontos: null,
        pontos_max: null,
        conforme: null,
        pendencias: [],
        reincidente: !1
      };
      if (f[C.key] = R, !yo)
        continue;
      if (C.tipo !== "calculo")
        Q++;
      if (R.respondida = De(C, no), C.tipo !== "calculo" && R.respondida)
        H++;
      let uo = Pe(C, no);
      if (R.na = !!no?.na || uo.length > 0 && uo.every((Z) => Z.na), C.tipo === "calculo")
        R.valor_calculado = v(C);
      if (R.respondida && !R.na) {
        if (C.tipo === "escolha_simples" || C.tipo === "escolha_multipla") {
          let Z = uo.filter((B) => !B.na), U = ae(C);
          if (U !== null)
            R.pontos_max = U, R.pontos = Z.reduce((B, to) => B + (to.pontos ?? 0), 0);
          if (Z.some((B) => B.conforme === !1))
            R.conforme = !1;
          else if (Z.some((B) => B.conforme === !0))
            R.conforme = !0;
          for (let B of Z)
            if (B.desconto && B.desconto.pct > 0) {
              let to = 1 - Math.min(100, B.desconto.pct) / 100;
              if (B.desconto.escopo === "formulario")
                x *= to;
              else
                ao *= to;
            }
        } else if (C.tipo === "numerica") {
          let Z = no.numero, U = Ie(C, Z);
          if (U !== null)
            R.pontos = U, R.pontos_max = ae(C);
          R.conforme = re(C, Z);
        }
      }
      if (R.pontos !== null && R.pontos_max !== null)
        T += R.pontos, J += R.pontos_max;
      let X = [];
      if (C.obrigatoria && !R.respondida && C.tipo !== "calculo")
        X.push({ tipo: "obrigatoria" });
      if (R.respondida && !R.na) {
        let Z = no?.fotos ?? 0, U = (no?.observacao ?? "").trim().length > 0;
        if (C.foto_obrigatoria && Z < 1)
          X.push({ tipo: "foto" });
        if (R.conforme === !1) {
          if (C.nc_exige?.foto && Z < 1 && !X.some((B) => B.tipo === "foto"))
            X.push({ tipo: "foto" });
          if (C.nc_exige?.observacao && !U)
            X.push({ tipo: "observacao" });
          if (C.tipo === "numerica" && C.numerica?.limite?.obs_obrigatoria && !U && !X.some((B) => B.tipo === "observacao"))
            X.push({ tipo: "observacao" });
        }
      }
      if (R.pendencias = X, X.length)
        L.push(C.key);
      if (R.conforme === !1) {
        if (D.push(C.key), d[C.key]?.conforme === !1)
          R.reincidente = !0;
      }
    }
    let io = b.has(N.key), co = T * ao;
    p[N.key] = {
      key: N.key,
      visivel: io,
      pontos: co,
      pontos_max: J,
      desconto_pct: _o((1 - ao) * 100, 2),
      pct: J > 0 ? _o(co / J * 100, _) : null
    }, k += co, I += J;
  }
  let z = k * x, W = r.config.calcular_nota !== !1 && I > 0 ? _o(z / I * 100, _) : null;
  return {
    questoes: f,
    topicos: p,
    pontos: _o(z, 2),
    pontos_max: _o(I, 2),
    nota_pct: W,
    classificacao: W === null ? null : ne(r.config.classificacoes ?? [], W),
    nao_conformidades: D,
    pendentes: L,
    respondidas: H,
    visiveis: Q
  };
}
function ne(r, i) {
  let d = r.filter((u) => i >= u.min && i <= u.max);
  if (!d.length)
    return null;
  return d.reduce((u, b) => b.min > u.min ? b : u);
}
function Co(r) {
  let i = [], d = So(r), u = /* @__PURE__ */ new Set, b = (v, f) => {
    if (u.has(v))
      i.push({ onde: f, problema: `chave duplicada ${v}` });
    u.add(v);
  };
  if (!r.topicos.length)
    i.push({ onde: "formulário", problema: "precisa de pelo menos um tópico" });
  let _ = 0;
  for (let v of r.topicos) {
    if (b(v.key, `tópico "${v.titulo}"`), !v.titulo.trim())
      i.push({ onde: "tópico", problema: "tópico sem título" });
    if (!v.questoes.length)
      i.push({ onde: `tópico "${v.titulo}"`, problema: "tópico sem questões" });
    y(v.depende_de, `tópico "${v.titulo}"`);
    for (let f of v.questoes) {
      _++;
      let p = `questão ${d.questions.get(f.key).numero} "${f.titulo || "sem título"}"`;
      if (b(f.key, p), !f.titulo.trim())
        i.push({ onde: p, problema: "sem título" });
      if (y(f.depende_de, p), f.tipo === "escolha_simples" || f.tipo === "escolha_multipla") {
        let x = f.opcoes ?? [];
        if (x.length < 2)
          i.push({ onde: p, problema: "precisa de pelo menos 2 opções" });
        for (let k of x) {
          if (b(k.key, p), !k.texto.trim())
            i.push({ onde: p, problema: "opção sem texto" });
          if (k.desconto && (k.desconto.pct < 0 || k.desconto.pct > 100))
            i.push({ onde: p, problema: "desconto deve estar entre 0 e 100%" });
        }
      }
      if (f.tipo === "numerica") {
        let x = f.numerica?.faixas_nota ?? [], k = -1 / 0;
        x.forEach((D, L) => {
          if (D.ate === null && L !== x.length - 1)
            i.push({ onde: p, problema: 'só a última faixa pode ser "acima"' });
          if (D.ate !== null) {
            if (D.ate <= k)
              i.push({ onde: p, problema: "faixas de nota precisam ser crescentes e não podem se cruzar" });
            k = D.ate;
          }
        });
        let I = f.numerica?.limite;
        if (I?.min != null && I?.max != null && I.min > I.max)
          i.push({ onde: p, problema: "limite mínimo maior que o máximo" });
      }
      if (f.tipo === "calculo")
        try {
          let x = Mo(f.calculo?.formula ?? "");
          if (!x.length && !(f.calculo?.formula ?? "").trim())
            i.push({ onde: p, problema: "fórmula vazia" });
          for (let k of x) {
            let I = d.byNumber.get(k);
            if (!I)
              i.push({ onde: p, problema: `a fórmula usa [${k}], que não existe` });
            else if (I.tipo !== "numerica" && I.tipo !== "calculo")
              i.push({ onde: p, problema: `a fórmula usa [${k}], que não é numérica` });
            else if (I.key === f.key)
              i.push({ onde: p, problema: "a fórmula se refere a ela mesma" });
          }
        } catch (x) {
          i.push({ onde: p, problema: x instanceof oo ? `fórmula: ${x.message}` : "fórmula inválida" });
        }
    }
  }
  if (_ === 0 && r.topicos.length)
    i.push({ onde: "formulário", problema: "nenhuma questão" });
  let m = /* @__PURE__ */ new Map;
  for (let [v, { q: f, topic: p }] of d.questions) {
    if (f.depende_de)
      m.set(v, f.depende_de.questao);
    if (p.depende_de)
      m.set("t:" + p.key, p.depende_de.questao);
  }
  let h = (v) => {
    let f = [], p = m.get(v);
    if (p)
      f.push(p);
    let x = d.questions.get(v)?.topic;
    if (x?.depende_de)
      f.push(x.depende_de.questao);
    return f;
  };
  for (let v of d.questions.keys()) {
    let f = [...h(v)], p = /* @__PURE__ */ new Set;
    while (f.length) {
      let x = f.pop();
      if (x === v) {
        i.push({ onde: `questão ${d.questions.get(v).numero}`, problema: "dependência circular" });
        break;
      }
      if (p.has(x))
        continue;
      p.add(x), f.push(...h(x));
    }
  }
  return (r.config.aprovacao?.etapas ?? []).forEach((v, f) => {
    if (!v.aprovadores.length)
      i.push({ onde: `aprovação, etapa ${f + 1}`, problema: "etapa sem aprovador" });
  }), i;
  function y(v, f) {
    if (!v)
      return;
    let p = d.questions.get(v.questao)?.q;
    if (!p)
      return i.push({ onde: f, problema: "depende de uma questão que não existe" });
    if (p.tipo !== "escolha_simples" && p.tipo !== "escolha_multipla")
      return i.push({ onde: f, problema: "só pode depender de questão de escolha" });
    if (!(p.opcoes ?? []).some((x) => x.key === v.opcao))
      i.push({ onde: f, problema: "depende de uma opção que não existe" });
  }
}
// app/src/data/agenda.ts
var Me = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
var Fo = (r) => Date.parse(r + "T00:00:00Z"), Oe = (r) => new Date(r).toISOString().slice(0, 10), ro = (r, i) => Oe(Fo(r) + i * 86400000), $o = (r) => new Date(Fo(r)).getUTCDay(), Ce = (r, i) => new Date(Date.UTC(r, i + 1, 0)).getUTCDate();
function Re(r, i) {
  switch (r.recorrencia) {
    case "nenhuma":
      return i === r.data_inicio;
    case "diaria":
      return !0;
    case "semanal":
      return ((r.dias_semana?.length) ? r.dias_semana : [$o(r.data_inicio)]).includes($o(i));
    case "mensal": {
      let d = Number(r.data_inicio.slice(8, 10)), u = new Date(Fo(i));
      return u.getUTCDate() === Math.min(d, Ce(u.getUTCFullYear(), u.getUTCMonth()));
    }
  }
}
function $e(r, i, d) {
  let u = r.termino === "data" && r.termino_data && r.termino_data < d ? r.termino_data : d, b = [], _ = 0;
  for (let m = r.data_inicio;m <= u; m = ro(m, 1)) {
    if (!Re(r, m))
      continue;
    if (_++, r.termino === "quantidade" && r.termino_qtd && _ > r.termino_qtd)
      break;
    if (m >= i)
      b.push(m);
    if (r.recorrencia === "nenhuma")
      break;
  }
  return b;
}
function te(r, i) {
  let d = new Intl.DateTimeFormat("en-US", {
    timeZone: r,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(i)), u = (b) => Number(d.find((_) => _.type === b).value);
  return (Date.UTC(u("year"), u("month") - 1, u("day"), u("hour"), u("minute"), u("second")) - i) / 60000;
}
function ce(r, i, d) {
  let [u, b, _] = r.split("-").map(Number), [m, h] = i.split(":").map(Number), y = Date.UTC(u, b - 1, _, m, h), v = y - te(d, y) * 60000;
  return v = y - te(d, v) * 60000, new Date(v).toISOString();
}
function Fe(r, i) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: i }).format(new Date(r));
}
function de(r, i, d) {
  let u = r.dia_inteiro ? ["08:00"] : [...new Set(r.horarios)].sort();
  return $e(r, i, d).flatMap((b) => u.map((_) => ce(b, _, r.fuso_horario)));
}
function Ao(r, i) {
  if (i.dia_inteiro)
    return ce(ro(Fe(r, i.fuso_horario), 1), "00:00", i.fuso_horario);
  return new Date(Date.parse(r) + 7200000).toISOString();
}
function To(r, i, d = Date.now()) {
  if (r.status !== "pendente")
    return r.status;
  return d > Date.parse(Ao(r.previsto_em, i)) ? "atrasada" : "pendente";
}
function le(r) {
  let i = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_inicio))
    i.push("Informe a data de início.");
  if (!r.dia_inteiro && !r.horarios.length)
    i.push("Informe pelo menos um horário ou marque o dia inteiro.");
  if (r.horarios.some((d) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(d)))
    i.push("Há um horário inválido.");
  if (r.recorrencia === "semanal" && !r.dias_semana?.length)
    i.push("Escolha pelo menos um dia da semana.");
  if (r.termino === "data" && (!r.termino_data || r.termino_data < r.data_inicio))
    i.push("A data de término precisa ser depois do início.");
  if (r.termino === "quantidade" && !(r.termino_qtd && r.termino_qtd > 0 && r.termino_qtd <= 999))
    i.push("Informe quantas vezes (de 1 a 999).");
  return i;
}
var Ro = (r) => r.split("-").reverse().join("/");
function se(r) {
  return r.length <= 1 ? r.join("") : `${r.slice(0, -1).join(", ")} e ${r[r.length - 1]}`;
}
function zo(r) {
  let i = r.dia_inteiro ? ", o dia inteiro" : ` às ${se([...new Set(r.horarios)].sort())}`, d;
  switch (r.recorrencia) {
    case "nenhuma":
      return `Uma vez, em ${Ro(r.data_inicio)}${r.dia_inteiro ? i : "," + i}`;
    case "diaria":
      d = "Todo dia";
      break;
    case "semanal": {
      let b = [...r.dias_semana?.length ? r.dias_semana : [$o(r.data_inicio)]].sort();
      if (d = b.length === 7 ? "Todo dia" : `${b.every((_) => _ === 0 || _ === 6) ? "Todo" : "Toda"} ${se(b.map((_) => Me[_]))}`, b.length === 5 && !b.includes(0) && !b.includes(6))
        d = "De segunda a sexta";
      break;
    }
    case "mensal":
      d = `Todo mês no dia ${Number(r.data_inicio.slice(8, 10))}`;
      break;
  }
  let u = r.termino === "data" && r.termino_data ? ` até ${Ro(r.termino_data)}` : r.termino === "quantidade" && r.termino_qtd ? `, ${r.termino_qtd} ${r.termino_qtd === 1 ? "vez" : "vezes"}` : "";
  return `${d}${i}, a partir de ${Ro(r.data_inicio)}${u}`;
}

// app/src/data/camposAvaliado.ts
function ue(r, i) {
  return !r.depende_de || (i[r.depende_de.campo_id] ?? "") === r.depende_de.valor;
}
function jo(r, i = {}) {
  let d = [...r].sort((_, m) => _.ordem - m.ordem), u = {};
  for (let _ of d) {
    let m = (i[_.id] ?? "").trim();
    if (m && _.tipo === "lista")
      m = (_.opcoes ?? []).find((h) => h.localeCompare(m, "pt-BR", { sensitivity: "base" }) === 0) ?? m;
    if (m)
      u[_.id] = m;
  }
  let b = [];
  for (let _ = !0;_; ) {
    _ = !1;
    for (let m of d)
      if (u[m.id] !== void 0 && !ue(m, u))
        delete u[m.id], _ = !0;
  }
  for (let _ of d) {
    if (!ue(_, u))
      continue;
    let m = u[_.id];
    if (!m) {
      if (_.obrigatorio)
        b.push(`${_.nome} é obrigatório`);
      continue;
    }
    if (_.tipo === "lista" && !(_.opcoes ?? []).includes(m))
      b.push(`${_.nome}: "${m}" não está entre as opções (${(_.opcoes ?? []).join(", ")})`);
    if (_.tipo === "numero" && !Number.isFinite(Number(m.replace(/\./g, "").replace(",", "."))))
      b.push(`${_.nome}: "${m}" não é um número`);
    if (_.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(m)) {
      let h = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(m);
      if (h)
        u[_.id] = `${h[3]}-${h[2]}-${h[1]}`;
      else
        b.push(`${_.nome}: use a data como dd/mm/aaaa`);
    }
  }
  return { valores: u, erros: b };
}
function me(r) {
  let i = [], d = /* @__PURE__ */ new Set;
  for (let u of r) {
    let b = u.nome.trim().toLowerCase();
    if (!b)
      i.push("Há um campo sem nome.");
    else if (d.has(b))
      i.push(`Já existe um campo chamado "${u.nome}".`);
    if (d.add(b), ["nome", "código", "codigo", "cnpj", "e-mail", "email", "telefone", "endereço", "endereco"].includes(b))
      i.push(`"${u.nome}" já é um campo padrão do cadastro.`);
    if (u.tipo === "lista" && (u.opcoes ?? []).filter((_) => _.trim()).length < 2)
      i.push(`${u.nome}: a lista precisa de pelo menos 2 opções.`);
    if (u.depende_de) {
      let _ = r.find((y) => y.id === u.depende_de.campo_id);
      if (!_ || _.tipo !== "lista")
        i.push(`${u.nome}: só pode depender de um campo do tipo lista.`);
      else if (!(_.opcoes ?? []).includes(u.depende_de.valor))
        i.push(`${u.nome}: "${u.depende_de.valor}" não é opção de ${_.nome}.`);
      let m = /* @__PURE__ */ new Set([u.id]), h = _;
      while (h?.depende_de) {
        if (m.has(h.id)) {
          i.push(`${u.nome}: dependência circular.`);
          break;
        }
        if (m.add(h.id), h = r.find((y) => y.id === h.depende_de.campo_id), h && m.has(h.id)) {
          i.push(`${u.nome}: dependência circular.`);
          break;
        }
      }
    }
  }
  return [...new Set(i)];
}

// app/src/data/seed.ts
var eo = { id: "org-1", nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco" }, Te = [
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
  { id: "fn-admin", nome: "Administrador", acoes: Te, sistema: !0 },
  { id: "fn-qualidade", nome: "Analista de qualidade", acoes: ["gerenciar_formularios", "aplicar", "editar_inspecao", "ver_todas_inspecoes", "gerenciar_avaliados", "gerenciar_planos", "aprovar", "ver_painel"] },
  { id: "fn-supervisor", nome: "Supervisor de lojas", acoes: ["aplicar", "ver_painel", "aprovar"] },
  { id: "fn-aplicador", nome: "Aplicador", acoes: ["aplicar"] }
], ze = { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] };
var Uo = [
  { id: "m-rogerio", org_id: eo.id, nome: "Rogério Marinho", email: "rogerio@exemplo.com", funcao_id: "fn-admin", is_master: !0, ativo: !0, acesso: ze, created_at: "2026-09-01T12:00:00.000Z" },
  {
    id: "m-ana",
    org_id: eo.id,
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
    org_id: eo.id,
    nome: "Carlos Eduardo Lima",
    email: "carlos@exemplo.com",
    funcao_id: "fn-supervisor",
    is_master: !1,
    ativo: !0,
    acesso: { formularios: ["f-flv"], avaliados: ["a-bosque", "a-centro"], ver_membros: [], ver_equipes: ["eq-lojas"] },
    created_at: "2026-09-01T12:00:00.000Z"
  }
], Bo = [
  { id: "eq-lojas", org_id: eo.id, nome: "Equipe de lojas", membros: ["m-ana"], acesso: { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] } }
];
var No = (r, i, d, u, b) => ({
  id: r,
  org_id: eo.id,
  nome: i,
  codigo_externo: d,
  endereco: u,
  email: b,
  ativo: !0,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z"
}), ko = [
  No("a-bosque", "Loja 01 — Bosque", "LJ01", "Av. Ceará, 1500 — Bosque", "gerencia.lj01@exemplo.com"),
  No("a-centro", "Loja 02 — Centro", "LJ02", "Rua Marechal Deodoro, 210 — Centro", "gerencia.lj02@exemplo.com"),
  No("a-doca3", "CD — Doca 3", "CD03", "Estrada do Aeroporto, km 3")
];
ko[0].campos = { "cp-regional": "Capital", "cp-formato": "Supermercado", "cp-gerente": "Júlia Andrade" };
ko[1].campos = { "cp-regional": "Capital", "cp-formato": "Express", "cp-gerente": "Paulo Neri" };
ko[2].campos = { "cp-regional": "Capital", "cp-formato": "Centro de distribuição" };
var pe = [
  { id: "cp-regional", nome: "Regional", tipo: "lista", opcoes: ["Capital", "Interior"], obrigatorio: !1, na_lista: !0, ordem: 1 },
  { id: "cp-cidade", nome: "Cidade", tipo: "texto", obrigatorio: !0, na_lista: !1, depende_de: { campo_id: "cp-regional", valor: "Interior" }, ordem: 2 },
  { id: "cp-formato", nome: "Formato", tipo: "lista", opcoes: ["Supermercado", "Express", "Atacarejo", "Centro de distribuição"], obrigatorio: !1, na_lista: !0, ordem: 3 },
  { id: "cp-gerente", nome: "Gerente", tipo: "texto", obrigatorio: !1, na_lista: !1, ordem: 4 }
], fe = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
  { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
  { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
], Lo = (r, i, d = {}) => ({
  key: r,
  titulo: i,
  tipo: "escolha_simples",
  obrigatoria: !0,
  opcoes: [
    { key: `${r}-sim`, texto: "Sim", pontos: 10, conforme: !0 },
    { key: `${r}-nao`, texto: "Não", pontos: 0, conforme: !1 },
    { key: `${r}-na`, texto: "Não se aplica", na: !0 }
  ],
  ...d
}), je = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: fe, geo: "off", reincidencia_meses: 3, relatorio: { emails: { avaliado: !0, extras: ["qualidade@exemplo.com"] } } },
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
        Lo("q-preco", "Todos os itens da bancada têm preço visível?", { nc_exige: { observacao: !0 } }),
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
        Lo("q-porta", "A porta da câmara veda sem frestas?", { plano_acao_modelo_id: "pm-manutencao" }),
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
}, Ne = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: fe },
  topicos: [
    {
      key: "r-doc",
      titulo: "Documentação",
      questoes: [
        { key: "r-nf", titulo: "Número da nota fiscal", tipo: "texto", obrigatoria: !0, texto: { leitura_codigo: !0 } },
        Lo("r-lacre", "O lacre do baú chegou intacto?", { nc_exige: { foto: !0 } })
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
}, Le = [
  { id: "f-flv", org_id: eo.id, nome: "Checklist FLV e perecíveis", rascunho: je, versao_publicada_id: "fv-flv-1", avaliados_vinculados: ["a-bosque", "a-centro"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" },
  { id: "f-receb", org_id: eo.id, nome: "Recebimento de refrigerados", rascunho: Ne, versao_publicada_id: "fv-receb-1", avaliados_vinculados: ["a-doca3"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" }
];
var _e = [
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
], ve = [
  {
    id: "pm-retirada",
    org_id: eo.id,
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
    org_id: eo.id,
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
function ge(r) {
  let i = { org_id: eo.id, fuso_horario: eo.fuso_horario, ativo: !0, materializado_ate: null, criado_por: "m-rogerio", created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" };
  return [
    {
      ...i,
      id: "ag-flv-centro",
      formulario_id: "f-flv",
      avaliado_id: "a-centro",
      responsaveis: ["m-ana"],
      data_inicio: r,
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
      data_inicio: r,
      horarios: ["07:30"],
      dia_inteiro: !1,
      recorrencia: "semanal",
      dias_semana: [1, 3, 5],
      termino: "nunca"
    }
  ];
}
function Ve(r) {
  return () => {
    r = r + 1831565813 | 0;
    let i = Math.imul(r ^ r >>> 15, 1 | r);
    return i = i + Math.imul(i ^ i >>> 7, 61 | i) ^ i, ((i ^ i >>> 14) >>> 0) / 4294967296;
  };
}
function he(r) {
  let i = Ve(20261014), d = [], u = Date.parse(r + "T12:00:00Z") - 7257600000, b = 0;
  for (let _ = 0;_ < 12; _++) {
    let m = _ / 11;
    for (let [h, y, v] of [["a-bosque", 0.15 + 0.35 * m, [1, 4]], ["a-centro", 0.45 - 0.35 * m, [2, 5]], ["a-doca3", 0.25, [1, 3]]])
      for (let f of v) {
        let p = u + (_ * 7 + f) * 86400000 + Math.floor(i() * 6) * 3600000;
        if (p >= Date.parse(r + "T00:00:00Z"))
          continue;
        let x = (z) => i() < z, k = `demo-${String(++b).padStart(3, "0")}`;
        if (h === "a-doca3") {
          let z = Math.round((3 + i() * (x(y) ? 7 : 3.5)) * 10) / 10, lo = !x(y / 2);
          d.push({
            client_uuid: k,
            formulario_id: "f-receb",
            formulario_versao_id: "fv-receb-1",
            avaliado_id: h,
            responsavel_id: "m-rogerio",
            iniciada_em: new Date(p).toISOString(),
            finalizada_em: new Date(p + 900000).toISOString(),
            respostas: {
              "r-nf": { texto: String(1e5 + Math.floor(i() * 899999)) },
              "r-lacre": lo ? { opcoes: ["r-lacre-sim"] } : { opcoes: ["r-lacre-nao"], fotos: 1 },
              "r-bruto": { numero: 12 + Math.round(i() * 30) / 10 },
              "r-tara": { numero: 0.6 },
              "r-temp": z > 7 ? { numero: z, observacao: "Acima do limite na chegada." } : { numero: z }
            }
          });
          continue;
        }
        let I = Math.round((1 + i() * (x(y) ? 7 : 3)) * 10) / 10, D = x(y), L = x(y * 0.8), H = x(y * 0.6), Q = x(y * 0.7);
        d.push({
          client_uuid: k,
          formulario_id: "f-flv",
          formulario_versao_id: "fv-flv-1",
          avaliado_id: h,
          responsavel_id: x(0.5) ? "m-ana" : "m-carlos",
          iniciada_em: new Date(p).toISOString(),
          finalizada_em: new Date(p + 1500000).toISOString(),
          respostas: {
            "q-vencidos": D ? { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Lote vencido na bancada." } : { opcoes: ["q-vencidos-sim"] },
            "q-preco": L ? { opcoes: ["q-preco-nao"], observacao: "Itens sem etiqueta." } : { opcoes: ["q-preco-sim"] },
            "q-gondola": { opcoes: Q ? ["q-gondola-limpa", "q-gondola-avaria"] : ["q-gondola-limpa", "q-gondola-abastecida"] },
            "q-temp": I > 4 ? { numero: I, fotos: 1, observacao: "Fora da faixa." } : { numero: I, fotos: 1 },
            "q-porta": H ? { opcoes: ["q-porta-nao"] } : { opcoes: ["q-porta-sim"] },
            ...H ? { "q-porta-motivo": { texto: "Borracha ressecada." } } : {},
            "q-ass": { assinatura: "demo" }
          }
        });
      }
  }
  return d.sort((_, m) => _.finalizada_em.localeCompare(m.finalizada_em));
}

// app/src/data/nucleo.ts
function Y(r, i) {
  return r.is_master || r.acoes.includes(i);
}
function bo(r, i) {
  return Y(r, "ver_todas_inspecoes") || i.responsavel_id === r.id || r.ve_inspecoes_de.includes(i.responsavel_id);
}
function be(r) {
  let i = r.org, d = "srv:state", u = "inspeta:sessao", b = "inspeta:membros", _ = () => crypto.randomUUID(), m = () => (/* @__PURE__ */ new Date()).toISOString(), h = (a) => structuredClone(a);
  async function y() {
    let a = await r.carregar();
    if (a) {
      if (a.planosModelo ??= h(ve), a.planos ??= [], a.emails ??= [], a.membros ??= h(Uo), a.funcoes ??= h(Vo), a.equipes ??= h(Bo), a.agendamentos ??= ge(U()), a.ocorrencias ??= [], a.aprovacoes ??= [], a.camposAvaliado ??= h(pe), r.local.get("inspeta:membros") === null)
        f(a);
      return a;
    }
    let o = r.estadoInicial();
    if (o.inspecoes.length === 0 && o.formularios.some((e) => e.id === "f-flv"))
      for (let e of _e) {
        let n = I(o, e.responsavel_id);
        lo(o, n, { ...e, status: "completa", anexos: [], device_id: "seed" }, e.finalizada_em);
      }
    return await r.gravar(o), o;
  }
  async function v(a, o) {
    if (await r.gravar(a), o === "membros")
      f(a), r.aviso("sessao");
    r.aviso(o);
  }
  function f(a) {
    r.local.set("inspeta:membros", JSON.stringify(so(a.membros, a.funcoes, a.equipes)));
  }
  let p = null, x = [];
  function k() {
    let a = r.local.get("inspeta:membros") ?? "seed";
    if (a !== p)
      x = a === "seed" ? so(Uo, Vo, Bo) : JSON.parse(a), p = a;
    return x;
  }
  function I(a, o) {
    let e = so(a.membros, a.funcoes, a.equipes).find((n) => n.id === o);
    if (!e || !e.ativo)
      throw Error("Sessão inválida");
    return e;
  }
  function D(a, o) {
    return r.exclusivo(async () => {
      let e = await y(), n = o(e);
      return await v(e, a), n;
    });
  }
  function L(a, o, e, n, s = {}, t = m()) {
    a.eventos.push({ id: ++a.eventoSeq, inspecao_id: o, membro_id: e, acao: n, dados: s, em: t });
  }
  function H(a, o, e, n) {
    let t = a.formularios.find((A) => A.id === o)?.rascunho.config.reincidencia_meses ?? 3, l = Date.now() - t * 31 * 86400000, c = a.inspecoes.filter((A) => A.formulario_id === o && A.avaliado_id === e && A.status !== "rascunho" && A.client_uuid !== n && A.finalizada_em && Date.parse(A.finalizada_em) >= l).sort((A, w) => (w.finalizada_em ?? "").localeCompare(A.finalizada_em ?? ""))[0];
    if (!c)
      return {};
    let g = {};
    for (let [A, w] of Object.entries(c.resultado.questoes))
      g[A] = { conforme: w.conforme, resposta: c.respostas[A] };
    return g;
  }
  function Q(a) {
    return a.topicos.flatMap((o) => o.questoes).filter((o) => o.preenchimento_automatico || o.preenchimento_unico);
  }
  function z(a, o, e, n, s) {
    let t = Q(o);
    if (!t.length)
      return {};
    let l = {}, c = a.inspecoes.filter((g) => g.formulario_id === e && g.avaliado_id === n && g.status !== "rascunho" && g.client_uuid !== s).sort((g, A) => (A.finalizada_em ?? "").localeCompare(g.finalizada_em ?? ""));
    for (let g of t) {
      let A = c.find((w) => {
        let q = w.respostas[g.key];
        return q && (q.opcoes?.length || q.numero != null || q.texto || q.data || q.na);
      })?.respostas[g.key];
      if (A)
        l[g.key] = { opcoes: A.opcoes, numero: A.numero, texto: A.texto, data: A.data, na: A.na };
    }
    return l;
  }
  function lo(a, o, e, n = m()) {
    let s = a.versoes.find((F) => F.id === e.formulario_versao_id && F.formulario_id === e.formulario_id);
    if (!s)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
    if (!Y(o, "aplicar") || !W(o, e.formulario_id) || !N(o, e.avaliado_id))
      return { client_uuid: e.client_uuid, ok: !1, erro: "sem_permissao", mensagem: "Você não tem permissão para este formulário." };
    let t = a.inspecoes.find((F) => F.client_uuid === e.client_uuid);
    if (t) {
      if (t.responsavel_id !== o.id)
        return { client_uuid: e.client_uuid, ok: !1, erro: "conflito", mensagem: "Inspeção pertence a outra pessoa." };
      if (t.status !== "rascunho")
        return { client_uuid: e.client_uuid, ok: !0, id: t.id, nota_pct: t.nota_pct, classificacao: t.classificacao };
    }
    let l = z(a, s.definicao, e.formulario_id, e.avaliado_id, e.client_uuid);
    for (let F of Q(s.definicao))
      if (F.preenchimento_unico && l[F.key])
        e = { ...e, respostas: { ...e.respostas, [F.key]: { ...e.respostas[F.key], ...l[F.key] } } };
    let c = H(a, e.formulario_id, e.avaliado_id, e.client_uuid), g = qo(s.definicao, e.respostas, c);
    if (e.status === "completa" && g.pendentes.length)
      return { client_uuid: e.client_uuid, ok: !1, erro: "invalido", mensagem: `${g.pendentes.length} questão(ões) com pendência.` };
    let A = {
      nao_conformidades: g.nao_conformidades,
      questoes: Object.fromEntries(Object.values(g.questoes).filter((F) => F.visivel).map((F) => [F.key, {
        conforme: F.conforme,
        pontos: F.pontos,
        pontos_max: F.pontos_max,
        reincidente: F.reincidente,
        valor_calculado: F.valor_calculado
      }])),
      topicos: Object.fromEntries(Object.values(g.topicos).map((F) => [F.key, { pct: F.pct, desconto_pct: F.desconto_pct }]))
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
      nota_pct: g.nota_pct,
      pontos: g.pontos,
      pontos_max: g.pontos_max,
      classificacao: g.classificacao?.nome ?? null,
      classificacao_cor: g.classificacao?.cor ?? null,
      qtd_nao_conformidades: g.nao_conformidades.length,
      resultado: A,
      device_id: e.device_id,
      sincronizada_em: n,
      ocorrencia_id: e.status === "completa" ? yo(a, o, e, t?.id) : null
    }, q = s.definicao.config.aprovacao?.etapas ?? [], O = e.status === "completa" && q.length ? "em_aprovacao" : e.status;
    Object.assign(w, { status: O, aprovacao_etapa: O === "em_aprovacao" ? 1 : null });
    let P;
    if (t)
      Object.assign(t, w, { updated_at: n }), P = t.id;
    else
      P = _(), a.inspecoes.push({ id: P, ...w, created_at: n, updated_at: n }), L(a, P, o.id, "criada", { device_id: e.device_id }, e.iniciada_em);
    L(a, P, o.id, "sincronizada", { device_id: e.device_id }, n);
    let K = w.ocorrencia_id ? a.ocorrencias.find((F) => F.id === w.ocorrencia_id) : void 0;
    if (K)
      K.inspecao_id = P;
    if (e.status === "completa")
      L(a, P, o.id, "finalizada", { nota_pct: g.nota_pct, ncs: g.nao_conformidades.length }, e.finalizada_em ?? n);
    if (O === "em_aprovacao")
      L(a, P, null, "enviada_aprovacao", { etapa: 1, de: q.length }, n), Z(a, P);
    return { client_uuid: e.client_uuid, ok: !0, id: P, nota_pct: g.nota_pct, classificacao: g.classificacao?.nome ?? null };
  }
  function W(a, o) {
    return Y(a, "gerenciar_formularios") || a.formularios_permitidos === "todos" || a.formularios_permitidos.includes(o);
  }
  function N(a, o) {
    return a.avaliados_permitidos === "todos" || a.avaliados_permitidos.includes(o);
  }
  function T(a, o) {
    let e = k().find((n) => n.id === a.id) ?? a;
    if (!e.ativo || !Y(e, o))
      throw Error("Você não tem permissão para isso.");
  }
  function J() {
    r.exigirRede();
  }
  let ao = {
    async entrar(a, o) {
      await r.atraso();
      let e = await y(), n = so(e.membros, e.funcoes, e.equipes).find((s) => s.email.toLowerCase() === a.trim().toLowerCase());
      if (!n || o.length < 4)
        throw Error("E-mail ou senha incorretos.");
      if (!n.ativo)
        throw Error("Este acesso foi desativado. Fale com o administrador da conta.");
      return r.local.set("inspeta:sessao", n.id), r.aviso("sessao"), n;
    },
    sessao() {
      let a = r.local.get("inspeta:sessao"), o = a ? k().find((e) => e.id === a) : void 0;
      return o && o.ativo ? o : null;
    },
    sair() {
      r.local.del("inspeta:sessao"), r.aviso("sessao");
    },
    org() {
      return i;
    },
    async recuperarSenha(a) {
      await r.atraso();
    },
    async definirSenha(a) {
      throw Error("Na demonstração qualquer senha com 4+ caracteres funciona.");
    },
    capturarRetornoAuth() {
      return null;
    },
    membros() {
      return k();
    },
    async listarFormularios() {
      await r.atraso();
      let a = await y();
      return a.formularios.filter((o) => !o.arquivado).map((o) => {
        let e = a.versoes.find((n) => n.id === o.versao_publicada_id) ?? null;
        return {
          ...o,
          versao_numero: e?.numero ?? null,
          tem_alteracoes: !e || JSON.stringify(e.definicao) !== JSON.stringify(o.rascunho),
          qtd_questoes: o.rascunho.topicos.reduce((n, s) => n + s.questoes.length, 0),
          qtd_inspecoes: a.inspecoes.filter((n) => n.formulario_id === o.id && n.status !== "rascunho").length
        };
      }).sort((o, e) => e.updated_at.localeCompare(o.updated_at));
    },
    async obterFormulario(a) {
      let o = (await y()).formularios.find((e) => e.id === a);
      if (!o)
        throw Error("Formulário não encontrado.");
      return h(o);
    },
    async criarFormulario(a, o) {
      if (await r.atraso(), !a.trim())
        throw Error("Dê um nome ao formulário.");
      let e = o ? h(o) : {
        config: { calcular_nota: !0, casas_decimais: 1, classificacoes: [
          { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
          { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
          { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
        ] },
        topicos: [{ key: _(), titulo: "Tópico 1", questoes: [{ key: _(), titulo: "", tipo: "escolha_simples", obrigatoria: !0, opcoes: [
          { key: _(), texto: "Sim", pontos: 10, conforme: !0 },
          { key: _(), texto: "Não", pontos: 0, conforme: !1 }
        ] }] }]
      };
      return D("formularios", (n) => {
        let s = { id: _(), org_id: i.id, nome: a.trim(), rascunho: e, versao_publicada_id: null, avaliados_vinculados: [], arquivado: !1, created_at: m(), updated_at: m() };
        return n.formularios.push(s), h(s);
      });
    },
    salvarRascunho(a, o, e) {
      return D("formularios", (n) => {
        let s = n.formularios.find((t) => t.id === a);
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
        return s.updated_at = m(), h(s);
      });
    },
    async publicar(a, o) {
      return await r.atraso(), D("formularios", (e) => {
        let n = e.formularios.find((c) => c.id === a);
        if (!n)
          throw Error("Formulário não encontrado.");
        let s = Co(n.rascunho);
        if (s.length)
          return { ok: !1, problemas: s };
        let t = Math.max(0, ...e.versoes.filter((c) => c.formulario_id === a).map((c) => c.numero)) + 1, l = { id: _(), formulario_id: a, numero: t, definicao: h(n.rascunho), publicado_em: m(), publicado_por: o };
        return e.versoes.push(l), n.versao_publicada_id = l.id, n.updated_at = m(), { ok: !0, versao: h(l) };
      });
    },
    async obterVersao(a) {
      let o = (await y()).versoes.find((e) => e.id === a);
      if (!o)
        throw Error("Versão não encontrada.");
      return h(o);
    },
    async listarAvaliados() {
      return await r.atraso(), h((await y()).avaliados).sort((a, o) => a.nome.localeCompare(o.nome, "pt-BR"));
    },
    criarAvaliado(a) {
      return ao.salvarAvaliado(null, a);
    },
    salvarAvaliado(a, o) {
      if (o.nome !== void 0 && !o.nome.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (a === null && !o.nome?.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (o.email && !/^\S+@\S+\.\S+$/.test(o.email))
        return Promise.reject(Error("E-mail inválido."));
      return D("avaliados", (e) => {
        let n = a ? e.avaliados.find((l) => l.id === a) : void 0;
        if (a && !n)
          throw Error("Avaliado não encontrado.");
        if (o.codigo_externo && e.avaliados.some((l) => l.codigo_externo === o.codigo_externo && l.id !== a))
          throw Error(`Já existe um avaliado com o código ${o.codigo_externo}.`);
        let s = jo(e.camposAvaliado, o.campos ?? n?.campos ?? {});
        if (s.erros.length)
          throw Error(s.erros.join(". ") + ".");
        if (n)
          return Object.assign(n, h(o), { nome: (o.nome ?? n.nome).trim(), campos: s.valores, updated_at: m() }), h(n);
        let t = { ...h(o), id: _(), org_id: i.id, nome: o.nome.trim(), campos: s.valores, ativo: !0, created_at: m(), updated_at: m() };
        return e.avaliados.push(t), h(t);
      });
    },
    async listarCamposAvaliado() {
      return h((await y()).camposAvaliado).sort((a, o) => a.ordem - o.ordem);
    },
    salvarCamposAvaliado(a, o) {
      T(a, "gerenciar_avaliados");
      let e = me(o);
      if (e.length)
        return Promise.reject(Error(e.join(" ")));
      return D("avaliados", (n) => {
        let s = new Set(o.map((t) => t.id));
        n.camposAvaliado = o.map((t, l) => ({
          ...h(t),
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
        return h(n.camposAvaliado);
      });
    },
    async listarInspecoes(a, o = {}) {
      await r.atraso();
      let e = await y(), n = (o.busca ?? "").trim().toLowerCase(), s = new Map(e.avaliados.map((c) => [c.id, c.nome])), t = new Map(e.formularios.map((c) => [c.id, c.nome])), l = new Map(k().map((c) => [c.id, c.nome]));
      return h(e.inspecoes.filter((c) => {
        if (!bo(a, c) && !X(e, a, c))
          return !1;
        if (o.status && c.status !== o.status)
          return !1;
        let g = (c.finalizada_em ?? c.iniciada_em).slice(0, 10);
        if (o.de && g < o.de)
          return !1;
        if (o.ate && g > o.ate)
          return !1;
        if (n) {
          if (![s.get(c.avaliado_id), t.get(c.formulario_id), l.get(c.responsavel_id), c.id.slice(0, 8)].join(" ").toLowerCase().includes(n))
            return !1;
        }
        return !0;
      }).sort((c, g) => (g.finalizada_em ?? g.iniciada_em).localeCompare(c.finalizada_em ?? c.iniciada_em)));
    },
    async obterInspecao(a, o) {
      let e = await y(), n = e.inspecoes.find((s) => s.id === o);
      if (!n || !bo(a, n) && !X(e, a, n))
        throw Error("Inspeção não encontrada.");
      return h(n);
    },
    async eventos(a) {
      return h((await y()).eventos.filter((o) => o.inspecao_id === a));
    },
    async anexo(a) {
      return r.anexo(a);
    },
    async salvarLogo(a) {
      if (!/^data:image\/(png|jpeg);base64,/.test(a))
        throw Error("Use uma imagem PNG ou JPG.");
      if (a.length > 409600)
        throw Error("Logo acima de 300 KB mesmo depois de reduzido.");
      let o = "logo-" + _();
      return await r.guardarAnexo(o, a), o;
    },
    async layoutRelatorio(a) {
      let o = await y(), e = o.formularios.find((t) => t.id === a), s = o.versoes.find((t) => t.id === e?.versao_publicada_id)?.definicao.config.relatorio?.layout ?? {};
      return { layout: s, logo: s.logo_id ? await r.anexo(s.logo_id) ?? null : null };
    },
    registrarRelatorio(a, o) {
      return D("inspecoes", (e) => L(e, a, o, "relatorio_enviado", { formato: "pdf" }));
    },
    async pacote(a) {
      J(), await r.atraso(), await vo();
      let o = await y(), e = I(o, a), n = o.formularios.filter((w) => !w.arquivado && w.versao_publicada_id && W(e, w.id)).map((w) => ({
        formulario_id: w.id,
        nome: w.nome,
        versao: h(o.versoes.find((q) => q.id === w.versao_publicada_id)),
        avaliados: w.avaliados_vinculados.length ? w.avaliados_vinculados : "todos"
      })), s = {};
      for (let w of n)
        for (let q of o.avaliados) {
          let O = H(o, w.formulario_id, q.id);
          if (Object.keys(O).length)
            s[`${w.formulario_id}|${q.id}`] = O;
        }
      let t = h(o.avaliados.filter((w) => w.ativo && N(e, w.id))), l = U(), c = new Date(Date.parse(ro(l, -7) + "T00:00:00Z")).toISOString(), g = o.ocorrencias.filter((w) => w.status === "pendente" && w.previsto_em >= c).flatMap((w) => {
        let q = o.agendamentos.find((O) => O.id === w.agendamento_id);
        if (!q || !q.responsaveis.includes(e.id) || !n.some((O) => O.formulario_id === q.formulario_id) || !t.some((O) => O.id === q.avaliado_id))
          return [];
        return [{ id: w.id, formulario_id: q.formulario_id, avaliado_id: q.avaliado_id, previsto_em: w.previsto_em, dia_inteiro: q.dia_inteiro, limite: Ao(w.previsto_em, q), descricao: zo(q) }];
      }).sort((w, q) => w.previsto_em.localeCompare(q.previsto_em)), A = {};
      for (let w of n)
        for (let q of t) {
          let O = z(o, w.versao.definicao, w.formulario_id, q.id);
          if (Object.keys(O).length)
            A[`${w.formulario_id}|${q.id}`] = O;
        }
      return { cursor: m(), membro: e, org: i, formularios: n, avaliados: t, anteriores: s, ultimas: A, agenda: g };
    },
    async enviarAnexo(a, o, e) {
      if (J(), I(await y(), a), await r.atraso(), e.length > 21548236.8)
        throw Error("Arquivo acima de 15 MB.");
      await r.guardarAnexo(o, e);
    },
    async enviarInspecoes(a, o) {
      J();
      let e = I(await y(), a);
      if (await r.atraso(), o.length > 20)
        throw Error("Lote acima de 20 inspeções.");
      let n = await r.anexosPresentes(o.flatMap((t) => t.anexos.map((l) => l.client_uuid))), s = await D("inspecoes", (t) => o.map((l) => {
        if (l.anexos.find((g) => !n.has(g.client_uuid)))
          return { client_uuid: l.client_uuid, ok: !1, erro: "anexo_faltando", mensagem: "Foto ainda não enviada." };
        return lo(t, e, l);
      }));
      for (let t of s) {
        let l = o.find((c) => c.client_uuid === t.client_uuid);
        if (t.ok && l?.status === "completa")
          await qe(t.id);
      }
      return s;
    },
    async listarPlanosModelo() {
      return await r.atraso(), h((await y()).planosModelo).sort((a, o) => a.nome.localeCompare(o.nome, "pt-BR"));
    },
    async obterPlanoModelo(a) {
      let o = (await y()).planosModelo.find((e) => e.id === a);
      if (!o)
        throw Error("Modelo de plano não encontrado.");
      return h(o);
    },
    criarPlanoModelo(a) {
      if (!a.trim())
        return Promise.reject(Error("Dê um nome ao modelo."));
      return D("planos", (o) => {
        if (o.planosModelo.some((n) => n.nome.toLowerCase() === a.trim().toLowerCase()))
          throw Error("Já existe um modelo com esse nome.");
        let e = {
          id: _(),
          org_id: i.id,
          nome: a.trim(),
          agrupamento: "por_inspecao",
          prazo_dias: 3,
          destinatario: "avaliado",
          definicao: { config: { calcular_nota: !1 }, topicos: [{ key: _(), titulo: "Correção", questoes: [
            { key: _(), titulo: "O que foi feito para corrigir?", tipo: "texto", obrigatoria: !0 }
          ] }] },
          created_at: m(),
          updated_at: m()
        };
        return o.planosModelo.push(e), h(e);
      });
    },
    salvarPlanoModelo(a) {
      return D("planos", (o) => {
        let e = o.planosModelo.findIndex((n) => n.id === a.id);
        if (e < 0)
          throw Error("Modelo de plano não encontrado.");
        if (!a.nome.trim())
          throw Error("Dê um nome ao modelo.");
        if (a.destinatario === "fixo" && !/^\S+@\S+\.\S+$/.test(a.email_fixo ?? ""))
          throw Error("Informe um e-mail válido para o destinatário fixo.");
        return o.planosModelo[e] = { ...h(a), updated_at: m() }, h(o.planosModelo[e]);
      });
    },
    async listarPlanos(a, o = {}) {
      await r.atraso();
      let e = await y(), n = U(), s = (o.busca ?? "").trim().toLowerCase();
      return e.planos.filter((t) => {
        if (Y(a, "gerenciar_planos"))
          return !0;
        let l = e.inspecoes.find((c) => c.id === t.inspecao_id);
        return !!l && bo(a, l);
      }).map((t) => ({
        ...h(t),
        situacao: to(t, n),
        avaliado: e.avaliados.find((l) => l.id === t.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: e.formularios.find((l) => l.id === t.formulario_id)?.nome ?? "Formulário removido"
      })).filter((t) => (!o.situacao || t.situacao === o.situacao) && (!s || [t.avaliado, t.modelo_snapshot.nome, t.responsavel_email, t.formulario].join(" ").toLowerCase().includes(s))).sort((t, l) => l.created_at.localeCompare(t.created_at) || t.modelo_snapshot.nome.localeCompare(l.modelo_snapshot.nome, "pt-BR"));
    },
    async planosDaInspecao(a) {
      let o = await y(), e = U();
      return o.planos.filter((n) => n.inspecao_id === a).map((n) => ({ ...h(n), situacao: to(n, e) }));
    },
    async novoLinkPlano(a, o, e) {
      if (!Y(o, "gerenciar_planos"))
        throw Error("Sem permissão.");
      await r.atraso();
      let n = Eo(), s = await go(n), t = Do(n);
      return await D("planos", (l) => {
        let c = l.planos.find((g) => g.id === a);
        if (!c)
          throw Error("Plano não encontrado.");
        if (c.token_hash = s, e) {
          if (!/^\S+@\S+\.\S+$/.test(e))
            throw Error("E-mail inválido.");
          c.responsavel_email = e, c.ultimo_email_em = m(), fo(l, Zo(l, c, t, s));
        }
        c.updated_at = m();
      }), { link: t };
    },
    async planoPorToken(a) {
      await r.atraso();
      let o = await go(a), e = await y(), n = e.planos.find((g) => g.token_hash === o);
      if (!n)
        throw Error("Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
      let s = e.inspecoes.find((g) => g.id === n.inspecao_id), l = e.versoes.find((g) => g.id === s.formulario_versao_id).definicao.topicos.flatMap((g) => g.questoes), c = n.questao_keys.map((g) => {
        let A = l.findIndex((q) => q.key === g), w = A >= 0 ? l[A] : null;
        return { key: g, numero: A + 1, titulo: w?.titulo ?? "Questão", resposta: s.respostas[g], questao: w, reincidente: !!s.resultado.questoes[g]?.reincidente };
      });
      return {
        plano: { ...h(n), situacao: to(n, U()) },
        org: i,
        avaliado: e.avaliados.find((g) => g.id === n.avaliado_id)?.nome ?? "",
        formulario: e.formularios.find((g) => g.id === n.formulario_id)?.nome ?? "",
        inspecao: { finalizada_em: s.finalizada_em, nota_pct: s.nota_pct, classificacao: s.classificacao, responsavel: e.membros.find((g) => g.id === s.responsavel_id)?.nome ?? "" },
        ncs: c
      };
    },
    async responderPlano(a, o) {
      await r.atraso();
      let e = await go(a);
      for (let n of o.fotos)
        await r.guardarAnexo(n.client_uuid, n.dataUrl);
      await D("planos", (n) => {
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
          for (let g of o.fotos.filter((A) => A.nc_key === t)) {
            let A = l[g.questao_key] ??= {};
            A.fotos = (A.fotos ?? 0) + 1;
          }
          if (qo(s.modelo_snapshot.definicao, l).pendentes.length)
            throw Error("Ainda há perguntas obrigatórias sem resposta.");
          s.respostas[t] = l;
        }
        if (s.anexos = o.fotos.map((t) => ({ client_uuid: t.client_uuid, questao_key: t.questao_key, nc_key: t.nc_key, tipo: "foto", mime: "image/jpeg", bytes: t.bytes })), s.respondido_por = o.nome.trim(), s.respondido_em = m(), s.modelo_snapshot.exige_aprovacao)
          s.status = "em_aprovacao";
        else
          s.status = "finalizado", s.finalizado_em = m();
        s.updated_at = m();
      });
    },
    async decidirPlano(a, o, e, n = "") {
      if (T(a, "gerenciar_planos"), e === "reprovada" && n.trim().length < 3)
        throw Error("Diga o que falta na correção.");
      await r.atraso();
      let s = Eo(), t = await go(s);
      return D("planos", (l) => {
        let c = l.planos.find((g) => g.id === o);
        if (!c)
          throw Error("Plano não encontrado.");
        if (c.status !== "em_aprovacao")
          throw Error("Este plano não está esperando aprovação.");
        if (e === "aprovada")
          c.status = "finalizado", c.finalizado_em = m(), c.aprovado_por = a.id;
        else {
          (c.reprovacoes ??= []).push({ em: m(), por: a.id, comentario: n.trim(), respondido_por: c.respondido_por, respostas: h(c.respostas) });
          let g = l.planosModelo.find((A) => A.id === c.modelo_id)?.prazo_dias ?? 3;
          if (Object.assign(c, { status: "aberto", respostas: {}, anexos: [], respondido_por: void 0, respondido_em: null, prazo: B(U(), g), token_hash: t }), c.responsavel_email) {
            c.ultimo_email_em = m();
            let A = l.avaliados.find((w) => w.id === c.avaliado_id)?.nome ?? "";
            fo(l, {
              idem_key: `plano-devolvido:${c.id}:${t.slice(0, 16)}`,
              para: c.responsavel_email,
              assunto: `Correção devolvida: ${c.modelo_snapshot.nome} — ${A}`,
              texto: `A correção enviada não foi aceita: "${n.trim()}". Responda de novo até ${c.prazo.split("-").reverse().join("/")}.`,
              link: Do(s)
            });
          }
        }
        return c.updated_at = m(), c.status;
      });
    },
    async caixaDeSaida() {
      return await r.atraso(), h((await y()).emails).sort((a, o) => o.criado_em.localeCompare(a.criado_em));
    },
    async importarAvaliados(a, o = {}) {
      await r.atraso();
      let e = (n) => {
        let s = { novos: 0, atualizados: 0, erros: [] }, t = /* @__PURE__ */ new Map;
        return a.forEach((l, c) => {
          let g = c + 2, A = (l.nome ?? "").trim(), w = (l.codigo_externo ?? "").trim() || void 0;
          if (!A) {
            s.erros.push({ linha: g, motivo: "sem nome" });
            return;
          }
          if (l.email && !/^\S+@\S+\.\S+$/.test(l.email.trim())) {
            s.erros.push({ linha: g, motivo: `e-mail inválido: ${l.email}` });
            return;
          }
          if (w) {
            if (t.has(w)) {
              s.erros.push({ linha: g, motivo: `código ${w} repetido (já está na linha ${t.get(w)})` });
              return;
            }
            t.set(w, g);
          }
          let q = w ? n.avaliados.find((K) => K.codigo_externo === w) : n.avaliados.find((K) => !K.codigo_externo && K.nome.toLowerCase() === A.toLowerCase()), O = jo(n.camposAvaliado, { ...q?.campos ?? {}, ...l.campos ?? {} });
          if (O.erros.length) {
            s.erros.push({ linha: g, motivo: O.erros.join("; ") });
            return;
          }
          let P = {
            campos: O.valores,
            nome: A,
            codigo_externo: w,
            documento: l.documento?.trim() || void 0,
            email: l.email?.trim() || void 0,
            telefone: l.telefone?.trim() || void 0,
            endereco: l.endereco?.trim() || void 0
          };
          if (q) {
            for (let [K, F] of Object.entries(P))
              if (F !== void 0)
                q[K] = F;
            q.updated_at = m(), s.atualizados++;
          } else
            n.avaliados.push({ ...P, id: _(), org_id: i.id, ativo: !0, created_at: m(), updated_at: m() }), s.novos++;
        }), s;
      };
      if (o.simular)
        return e(h(await y()));
      return D("avaliados", e);
    },
    async aprovacoesPendentes(a) {
      await r.atraso();
      let o = await y();
      return o.inspecoes.filter((e) => e.status === "em_aprovacao" && uo(o, e).includes(a.id) && e.responsavel_id !== a.id).map((e) => ({
        ...h(e),
        etapas: R(o, e).length,
        avaliado: o.avaliados.find((n) => n.id === e.avaliado_id)?.nome ?? "",
        formulario: o.formularios.find((n) => n.id === e.formulario_id)?.nome ?? "",
        responsavel: o.membros.find((n) => n.id === e.responsavel_id)?.nome ?? ""
      })).sort((e, n) => (e.finalizada_em ?? "").localeCompare(n.finalizada_em ?? ""));
    },
    async decisoesDe(a) {
      await r.atraso();
      let o = await y();
      return o.aprovacoes.filter((e) => e.aprovador_id === a.id).map((e) => {
        let n = o.inspecoes.find((s) => s.id === e.inspecao_id);
        return { ...h(e), status: n?.status ?? "completa", avaliado: o.avaliados.find((s) => s.id === n?.avaliado_id)?.nome ?? "", formulario: o.formularios.find((s) => s.id === n?.formulario_id)?.nome ?? "", nota_pct: n?.nota_pct ?? null };
      }).sort((e, n) => n.em.localeCompare(e.em));
    },
    async aprovacaoDaInspecao(a) {
      let o = await y(), e = o.inspecoes.find((s) => s.id === a);
      if (!e)
        throw Error("Inspeção não encontrada.");
      let n = (s) => o.membros.find((t) => t.id === s)?.nome ?? "—";
      return R(o, e).map((s, t) => ({
        etapa: t + 1,
        aprovadores: s.aprovadores.map((l) => ({ id: l, nome: n(l) })),
        decisao: o.aprovacoes.filter((l) => l.inspecao_id === a && l.etapa === t + 1).map((l) => ({ ...h(l), aprovador: n(l.aprovador_id) }))[0] ?? null,
        atual: e.status === "em_aprovacao" && e.aprovacao_etapa === t + 1
      }));
    },
    decidir(a, o, e, n = "") {
      return T(a, "aprovar"), D("inspecoes", (s) => {
        let t = s.inspecoes.find((g) => g.id === o);
        if (!t)
          throw Error("Inspeção não encontrada.");
        if (t.status !== "em_aprovacao")
          throw Error("Esta inspeção não está esperando aprovação.");
        if (t.responsavel_id === a.id)
          throw Error("Quem aplicou não aprova a própria inspeção.");
        if (!uo(s, t).includes(a.id))
          throw Error("Esta etapa não é sua.");
        if (e === "reprovada" && n.trim().length < 3)
          throw Error("Diga o motivo da reprovação.");
        let l = t.aprovacao_etapa ?? 1;
        if (s.aprovacoes.some((g) => g.inspecao_id === t.id && g.etapa === l))
          throw Error("Esta etapa já foi decidida.");
        s.aprovacoes.push({ id: _(), org_id: i.id, inspecao_id: t.id, etapa: l, aprovador_id: a.id, decisao: e, comentario: n.trim() || void 0, em: m() });
        let c = R(s, t).length;
        if (e === "reprovada")
          t.status = "reprovada", t.aprovacao_etapa = null;
        else if (l >= c)
          t.status = "aprovada", t.aprovacao_etapa = null;
        else
          t.aprovacao_etapa = l + 1, Z(s, t.id);
        return t.updated_at = m(), L(s, t.id, a.id, e, { etapa: l, de: c, comentario: n.trim() || void 0 }), t.status;
      });
    },
    gerarDadosDemo(a) {
      if (!a.is_master)
        return Promise.reject(Error("Só o dono da conta pode gerar dados de exemplo."));
      return D("inspecoes", (o) => {
        let e = 0;
        for (let n of he(U())) {
          if (o.inspecoes.some((t) => t.client_uuid === n.client_uuid))
            continue;
          if (lo(o, I(o, n.responsavel_id), { ...n, respostas: n.respostas, status: "completa", anexos: [], device_id: "demo" }, n.finalizada_em).ok)
            e++;
        }
        return e;
      });
    },
    async painel(a, o) {
      if (!Y(a, "ver_painel"))
        throw Error("Você não tem acesso ao painel.");
      await r.atraso();
      let e = await y(), n = (S) => C(S), s = (Date.parse(o.ate) - Date.parse(o.de)) / 86400000 + 1, t = ro(o.de, -s), l = ro(o.de, -1), c = Object.entries(o.campos ?? {}).filter(([, S]) => S), g = (S) => !c.length || c.every(([M, j]) => e.avaliados.find((V) => V.id === S)?.campos?.[M] === j), A = e.inspecoes.filter((S) => S.status !== "rascunho" && S.finalizada_em && bo(a, S) && (!o.formulario_id || S.formulario_id === o.formulario_id) && g(S.avaliado_id)), w = (S, M) => A.filter((j) => {
        let V = n(j.finalizada_em);
        return V >= S && V <= M;
      }), q = w(o.de, o.ate), O = w(t, l), P = (S) => {
        let M = S.map((j) => j.nota_pct).filter((j) => j !== null);
        return M.length ? M.reduce((j, V) => j + V, 0) / M.length : null;
      }, K = (S) => S.length ? S.reduce((M, j) => M + j.qtd_nao_conformidades, 0) / S.length : null, F = Date.now(), ho = e.ocorrencias.flatMap((S) => {
        let M = e.agendamentos.find((V) => V.id === S.agendamento_id);
        if (!M || !co(a, M) || o.formulario_id && M.formulario_id !== o.formulario_id)
          return [];
        let j = n(S.previsto_em);
        return j >= o.de && j <= o.ate ? [To(S, M, F)] : [];
      }), mo = ho.filter((S) => S === "completa").length, po = ho.filter((S) => S === "atrasada").length, Yo = (S) => ro(S, -(((/* @__PURE__ */ new Date(S + "T12:00:00Z")).getUTCDay() + 6) % 7)), Go = [];
      for (let S = Yo(o.de);S <= o.ate; S = ro(S, 7)) {
        let M = q.filter((j) => Yo(n(j.finalizada_em)) === S);
        Go.push({ semana: S, nota: P(M), qtd: M.length });
      }
      let Ae = [...new Set(q.map((S) => S.avaliado_id))].map((S) => {
        let M = q.filter((j) => j.avaliado_id === S);
        return { id: S, nome: e.avaliados.find((j) => j.id === S)?.nome ?? "Avaliado removido", nota: P(M), qtd: M.length, ncs: M.reduce((j, V) => j + V.qtd_nao_conformidades, 0) };
      }).sort((S, M) => (S.nota ?? 101) - (M.nota ?? 101) || S.nome.localeCompare(M.nome, "pt-BR")), Wo = /* @__PURE__ */ new Map, Po = /* @__PURE__ */ new Map;
      for (let S of q) {
        let M = e.versoes.find((V) => V.id === S.formulario_versao_id), j = e.formularios.find((V) => V.id === S.formulario_id)?.nome ?? "";
        for (let V of M?.definicao.topicos.flatMap((xo) => xo.questoes) ?? [])
          Wo.set(S.formulario_id + "|" + V.key, V.titulo);
        for (let [V, xo] of Object.entries(S.resultado.questoes)) {
          if (xo.conforme === null)
            continue;
          let Io = Po.get(S.formulario_id + "|" + V) ?? { n: 0, aplicaveis: 0, formulario: j };
          if (Io.aplicaveis++, xo.conforme === !1)
            Io.n++;
          Po.set(S.formulario_id + "|" + V, Io);
        }
      }
      let ke = [...Po.entries()].filter(([, S]) => S.n > 0).map(([S, M]) => ({ chave: S, titulo: Wo.get(S) ?? "Questão", formulario: M.formulario, n: M.n, pct: M.n / M.aplicaveis * 100 })).sort((S, M) => M.n - S.n || M.pct - S.pct).slice(0, 8);
      return {
        periodo: { de: o.de, ate: o.ate, anterior: { de: t, ate: l } },
        kpis: {
          inspecoes: { atual: q.length, anterior: O.length },
          nota: { atual: P(q), anterior: P(O) },
          ncs_por_inspecao: { atual: K(q), anterior: K(O) },
          agenda: { cumpridas: mo, atrasadas: po, pct: mo + po ? mo / (mo + po) * 100 : null },
          planos_em_atraso: e.planos.filter((S) => to(S, U()) === "em_atraso" && (!o.formulario_id || S.formulario_id === o.formulario_id) && A.some((M) => M.id === S.inspecao_id)).length
        },
        semanas: Go,
        porAvaliado: Ae,
        topNcs: ke,
        formularios: e.formularios.filter((S) => !S.arquivado).map((S) => ({ id: S.id, nome: S.nome })),
        camposFiltro: e.camposAvaliado.filter((S) => S.tipo === "lista").map((S) => ({ id: S.id, nome: S.nome, opcoes: S.opcoes ?? [] }))
      };
    },
    async rodarAgenda() {
      return vo();
    },
    async listarOcorrencias(a, o = {}) {
      await vo(), await r.atraso();
      let e = await y(), n = Date.now(), s = (o.busca ?? "").trim().toLowerCase(), t = new Map(e.membros.map((l) => [l.id, l.nome]));
      return e.ocorrencias.flatMap((l) => {
        let c = e.agendamentos.find((q) => q.id === l.agendamento_id);
        if (!c || !co(a, c))
          return [];
        let g = C(l.previsto_em, c.fuso_horario);
        if (o.de && g < o.de)
          return [];
        if (o.ate && g > o.ate)
          return [];
        let A = To(l, c, n);
        if (o.situacao && A !== o.situacao)
          return [];
        let w = {
          ...h(l),
          situacao: A,
          agendamento: h(c),
          descricao: zo(c),
          formulario: e.formularios.find((q) => q.id === c.formulario_id)?.nome ?? "Formulário removido",
          avaliado: e.avaliados.find((q) => q.id === c.avaliado_id)?.nome ?? "Avaliado removido",
          responsaveis: c.responsaveis.map((q) => t.get(q) ?? "—")
        };
        if (s && ![w.formulario, w.avaliado, ...w.responsaveis].join(" ").toLowerCase().includes(s))
          return [];
        return [w];
      }).sort((l, c) => l.previsto_em.localeCompare(c.previsto_em) || l.avaliado.localeCompare(c.avaliado, "pt-BR"));
    },
    async obterAgendamento(a) {
      let o = (await y()).agendamentos.find((e) => e.id === a);
      if (!o)
        throw Error("Agendamento não encontrado.");
      return h(o);
    },
    async salvarAgendamento(a, o) {
      return T(a, "gerenciar_agendamentos"), await r.atraso(), await D("agenda", (n) => {
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
        }, t = le(s), l = n.formularios.find((w) => w.id === o.formulario_id && !w.arquivado);
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
        let c = so(n.membros, n.funcoes, n.equipes);
        for (let w of o.responsaveis) {
          let q = c.find((O) => O.id === w);
          if (!q || !q.ativo)
            t.push("Uma das pessoas escolhidas não está mais ativa.");
          else if (!Y(q, "aplicar") || !W(q, o.formulario_id) || !N(q, o.avaliado_id))
            t.push(`${q.nome} não tem acesso a este formulário ou avaliado. Libere em Permissões.`);
        }
        if (t.length)
          throw Error(t.join(" "));
        let g;
        if (o.id) {
          let w = n.agendamentos.find((O) => O.id === o.id);
          if (!w)
            throw Error("Agendamento não encontrado.");
          let q = m();
          if (n.ocorrencias = n.ocorrencias.filter((O) => !(O.agendamento_id === w.id && O.status === "pendente" && O.previsto_em > q)), Object.assign(w, s, { formulario_id: o.formulario_id, avaliado_id: o.avaliado_id, responsaveis: [...o.responsaveis], ativo: !0, updated_at: q }), delete w.dias_semana, s.dias_semana)
            w.dias_semana = s.dias_semana;
          g = w;
        } else
          g = {
            ...s,
            id: _(),
            org_id: i.id,
            formulario_id: o.formulario_id,
            avaliado_id: o.avaliado_id,
            responsaveis: [...o.responsaveis],
            ativo: !0,
            materializado_ate: null,
            criado_por: a.id,
            created_at: m(),
            updated_at: m()
          }, n.agendamentos.push(g);
        let A = no(n, g);
        return { agendamento: h(g), geradas: A };
      });
    },
    inativarOcorrencia(a, o, e, n) {
      return D("agenda", (s) => {
        let t = s.ocorrencias.find((g) => g.id === o);
        if (!t)
          throw Error("Ocorrência não encontrada.");
        let l = s.agendamentos.find((g) => g.id === t.agendamento_id);
        if (!Y(a, "gerenciar_agendamentos") && !l.responsaveis.includes(a.id))
          throw Error("Você não tem permissão para isso.");
        if (n.trim().length < 3)
          throw Error("Escreva o motivo.");
        if (t.status !== "pendente")
          throw Error("Só dá para inativar o que ainda está pendente.");
        let c = e === "esta" ? [t] : s.ocorrencias.filter((g) => g.agendamento_id === l.id && g.status === "pendente" && g.previsto_em >= t.previsto_em);
        for (let g of c)
          Object.assign(g, { status: "inativa", justificativa: n.trim(), inativada_por: a.id, updated_at: m() });
        if (e === "seguintes")
          l.ativo = !1, l.updated_at = m();
        return c.length;
      });
    },
    async listarPessoas() {
      return await r.atraso(), h((await y()).membros).sort((a, o) => Number(o.ativo) - Number(a.ativo) || a.nome.localeCompare(o.nome, "pt-BR"));
    },
    convidarPessoa(a, o) {
      T(a, "gerenciar_permissoes");
      let e = o.nome.trim(), n = o.email.trim().toLowerCase();
      if (!e)
        return Promise.reject(Error("Informe o nome."));
      if (!/^\S+@\S+\.\S+$/.test(n))
        return Promise.reject(Error("Informe um e-mail válido."));
      return D("membros", (s) => {
        if (s.membros.some((l) => l.email.toLowerCase() === n))
          throw Error("Já existe uma pessoa com esse e-mail.");
        if (!s.funcoes.some((l) => l.id === o.funcao_id))
          throw Error("Escolha uma função.");
        let t = { id: _(), org_id: i.id, nome: e, email: n, funcao_id: o.funcao_id, is_master: !1, ativo: !0, acesso: h(Ho), created_at: m() };
        return s.membros.push(t), fo(s, {
          idem_key: `convite:${t.id}`,
          para: n,
          assunto: `Você foi convidado para ${i.nome} no Inspeta`,
          texto: `${a.nome} liberou seu acesso como ${s.funcoes.find((l) => l.id === t.funcao_id)?.nome}. Entre com este e-mail e crie sua senha no primeiro acesso.`,
          link: `${r.urlApp()}#/entrar`
        }), h(t);
      });
    },
    salvarPessoa(a, o, e) {
      return T(a, "gerenciar_permissoes"), D("membros", (n) => {
        let s = n.membros.find((t) => t.id === o);
        if (!s)
          throw Error("Pessoa não encontrada.");
        if (s.is_master && (e.funcao_id !== void 0 && e.funcao_id !== s.funcao_id || e.ativo === !1))
          throw Error("O dono da conta é sempre Administrador e não pode ser desativado.");
        if (e.ativo === !1 && o === a.id)
          throw Error("Você não pode desativar o seu próprio acesso.");
        if (e.funcao_id && !n.funcoes.some((t) => t.id === e.funcao_id))
          throw Error("Função não encontrada.");
        if (e.nome !== void 0 && !e.nome.trim())
          throw Error("Informe o nome.");
        if (e.acesso)
          e = { ...e, acesso: io(n, e.acesso, o) };
        return Object.assign(s, h(e)), h(s);
      });
    },
    async listarFuncoes() {
      await r.atraso();
      let a = await y();
      return a.funcoes.map((o) => ({ ...h(o), qtd_pessoas: a.membros.filter((e) => e.ativo && e.funcao_id === o.id).length }));
    },
    criarFuncao(a, o, e) {
      return T(a, "gerenciar_permissoes"), D("membros", (n) => {
        let s = o.trim();
        if (!s)
          throw Error("Dê um nome à função.");
        if (n.funcoes.some((c) => c.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        let t = n.funcoes.find((c) => c.id === e), l = { id: _(), nome: s, acoes: t ? [...t.acoes] : ["aplicar"] };
        return n.funcoes.push(l), h(l);
      });
    },
    salvarFuncao(a, o) {
      return T(a, "gerenciar_permissoes"), D("membros", (e) => {
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
        return n.nome = s, n.acoes = [...new Set(o.acoes)], h(n);
      });
    },
    excluirFuncao(a, o) {
      return T(a, "gerenciar_permissoes"), D("membros", (e) => {
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
      return await r.atraso(), h((await y()).equipes).sort((a, o) => a.nome.localeCompare(o.nome, "pt-BR"));
    },
    criarEquipe(a, o) {
      return T(a, "gerenciar_permissoes"), D("membros", (e) => {
        let n = o.trim();
        if (!n)
          throw Error("Dê um nome à equipe.");
        if (e.equipes.some((t) => t.nome.toLowerCase() === n.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        let s = { id: _(), org_id: i.id, nome: n, membros: [], acesso: h(oe) };
        return e.equipes.push(s), h(s);
      });
    },
    salvarEquipe(a, o) {
      return T(a, "gerenciar_permissoes"), D("membros", (e) => {
        let n = e.equipes.find((t) => t.id === o.id);
        if (!n)
          throw Error("Equipe não encontrada.");
        let s = o.nome.trim();
        if (!s)
          throw Error("Dê um nome à equipe.");
        if (e.equipes.some((t) => t.id !== o.id && t.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        return n.nome = s, n.membros = [...new Set(o.membros)].filter((t) => e.membros.some((l) => l.id === t)), n.acesso = io(e, o.acesso), h(n);
      });
    },
    excluirEquipe(a, o) {
      return T(a, "gerenciar_permissoes"), D("membros", (e) => {
        e.equipes = e.equipes.filter((n) => n.id !== o);
        for (let n of [...e.membros.map((s) => s.acesso), ...e.equipes.map((s) => s.acesso)])
          n.ver_equipes = n.ver_equipes.filter((s) => s !== o);
      });
    },
    async _podeVer(a, o, e) {
      let n = await y(), s = (c) => !!c && (bo(a, c) || X(n, a, c));
      if (o === "inspecao")
        return s(n.inspecoes.find((c) => c.id === e));
      if (e.startsWith("logo-"))
        return !0;
      let t = n.inspecoes.find((c) => c.anexos.some((g) => g.client_uuid === e));
      if (t)
        return s(t);
      let l = n.planos.find((c) => c.anexos.some((g) => g.client_uuid === e));
      if (l)
        return Y(a, "gerenciar_planos") || s(n.inspecoes.find((c) => c.id === l.inspecao_id));
      return !1;
    },
    async _membroPorEmail(a) {
      let o = await y();
      return so(o.membros, o.funcoes, o.equipes).find((e) => e.email.toLowerCase() === a.toLowerCase()) ?? null;
    },
    async _membrosResolvidos() {
      let a = await y();
      return so(a.membros, a.funcoes, a.equipes);
    },
    async _reset() {
      await r.local.limpar(), r.aviso("reset");
    }
  };
  function io(a, o, e) {
    let n = new Set(a.formularios.map((c) => c.id)), s = new Set(a.avaliados.map((c) => c.id)), t = new Set(a.membros.map((c) => c.id)), l = new Set(a.equipes.map((c) => c.id));
    return {
      formularios: o.formularios === "todos" ? "todos" : [...new Set(o.formularios)].filter((c) => n.has(c)),
      avaliados: o.avaliados === "todos" ? "todos" : [...new Set(o.avaliados)].filter((c) => s.has(c)),
      ver_membros: [...new Set(o.ver_membros)].filter((c) => t.has(c) && c !== e),
      ver_equipes: [...new Set(o.ver_equipes)].filter((c) => l.has(c))
    };
  }
  function co(a, o) {
    return Y(a, "gerenciar_agendamentos") || Y(a, "ver_todas_inspecoes") || o.responsaveis.some((e) => e === a.id || a.ve_inspecoes_de.includes(e));
  }
  function C(a, o = i.fuso_horario) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: o }).format(new Date(a));
  }
  function no(a, o, e = Date.now()) {
    if (!o.ativo)
      return 0;
    let n = C(new Date(e).toISOString(), o.fuso_horario), s = ro(n, 14), t = 0;
    for (let l of de(o, n, s)) {
      if (Date.parse(Ao(l, o)) <= e)
        continue;
      if (a.ocorrencias.some((c) => c.agendamento_id === o.id && c.previsto_em === l))
        continue;
      a.ocorrencias.push({ id: _(), org_id: i.id, agendamento_id: o.id, previsto_em: l, status: "pendente", created_at: m(), updated_at: m() }), t++;
    }
    return o.materializado_ate = s, t;
  }
  function vo() {
    return r.exclusivo(async () => {
      let a = await y(), o = U(), e = a.agendamentos.filter((s) => s.ativo && s.materializado_ate !== ro(o, 14)), n = 0;
      for (let s of e)
        n += no(a, s);
      if (e.length)
        await v(a, n ? "agenda" : "agenda-silencioso");
      return n;
    });
  }
  function yo(a, o, e, n) {
    if (!e.ocorrencia_id)
      return null;
    let s = a.ocorrencias.find((l) => l.id === e.ocorrencia_id), t = s && a.agendamentos.find((l) => l.id === s.agendamento_id);
    if (!s || !t || !t.responsaveis.includes(o.id) || t.formulario_id !== e.formulario_id || t.avaliado_id !== e.avaliado_id)
      return null;
    if (s.status === "completa" && s.inspecao_id && s.inspecao_id === n)
      return s.id;
    if (s.status !== "pendente")
      return null;
    return s.status = "completa", s.updated_at = m(), s.id;
  }
  function R(a, o) {
    return a.versoes.find((e) => e.id === o.formulario_versao_id)?.definicao.config.aprovacao?.etapas ?? [];
  }
  function uo(a, o) {
    return o.status === "em_aprovacao" ? R(a, o)[(o.aprovacao_etapa ?? 1) - 1]?.aprovadores ?? [] : [];
  }
  function X(a, o, e) {
    return Y(o, "aprovar") && R(a, e).some((n) => n.aprovadores.includes(o.id));
  }
  function Z(a, o) {
    let e = a.inspecoes.find((t) => t.id === o), n = a.avaliados.find((t) => t.id === e.avaliado_id)?.nome ?? "", s = a.formularios.find((t) => t.id === e.formulario_id)?.nome ?? "";
    for (let t of uo(a, e)) {
      let l = a.membros.find((c) => c.id === t);
      if (!l?.ativo || t === e.responsavel_id)
        continue;
      fo(a, {
        idem_key: `aprovacao:${e.id}:${e.aprovacao_etapa}:${t}`,
        para: l.email,
        assunto: `Aprovação pendente: ${s} — ${n}`,
        texto: `A inspeção em ${n} (nota ${e.nota_pct === null ? "—" : String(e.nota_pct).replace(".", ",") + "%"}) espera a sua decisão na etapa ${e.aprovacao_etapa} de ${R(a, e).length}.`,
        link: `${r.urlApp()}#/web/inspecoes/${e.id}`
      });
    }
  }
  function U() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: i.fuso_horario }).format(/* @__PURE__ */ new Date);
  }
  function B(a, o) {
    let e = /* @__PURE__ */ new Date(a + "T12:00:00Z");
    return e.setUTCDate(e.getUTCDate() + o), e.toISOString().slice(0, 10);
  }
  function to(a, o) {
    return a.status === "aberto" && a.prazo < o ? "em_atraso" : a.status;
  }
  function Eo() {
    let a = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(a, (o) => o.toString(16).padStart(2, "0")).join("");
  }
  async function go(a) {
    let o = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(a));
    return Array.from(new Uint8Array(o), (e) => e.toString(16).padStart(2, "0")).join("");
  }
  function Do(a) {
    return `${r.urlApp()}#/p/${a}`;
  }
  function fo(a, o) {
    if (a.emails.some((e) => e.idem_key === o.idem_key))
      return !1;
    return a.emails.push({ ...o, id: _(), criado_em: m(), status: o.para ? r.enviaEmails ? "pendente" : "enviado" : "sem_destinatario" }), !0;
  }
  function Zo(a, o, e, n) {
    let s = a.avaliados.find((l) => l.id === o.avaliado_id)?.nome ?? "", t = o.prazo.split("-").reverse().join("/");
    return {
      idem_key: `plano:${o.id}:${n.slice(0, 16)}`,
      para: o.responsavel_email ?? "",
      assunto: `Plano de ação: ${o.modelo_snapshot.nome} — ${s}`,
      texto: `A inspeção em ${s} encontrou ${o.questao_keys.length} ${o.questao_keys.length === 1 ? "não conformidade" : "não conformidades"} que precisam de correção até ${t}.
Abra o link para registrar o que foi feito. Não precisa de senha.`,
      link: e
    };
  }
  async function qe(a) {
    let o = await y(), e = o.inspecoes.find((c) => c.id === a);
    if (!e || e.status === "rascunho")
      return;
    let n = o.versoes.find((c) => c.id === e.formulario_versao_id), s = new Map(n.definicao.topicos.flatMap((c) => c.questoes).map((c) => [c.key, c])), t = [];
    for (let c of e.resultado.nao_conformidades) {
      let g = s.get(c)?.plano_acao_modelo_id, A = g ? o.planosModelo.find((q) => q.id === g) : void 0;
      if (!A)
        continue;
      let w = A.agrupamento === "por_inspecao" ? t.find((q) => q.modelo.id === A.id) : void 0;
      if (w)
        w.keys.push(c);
      else
        t.push({ modelo: A, keys: [c] });
    }
    let l = await Promise.all(t.map(async () => {
      let c = Eo();
      return { t: c, h: await go(c) };
    }));
    await D("planos", (c) => {
      let g = c.avaliados.find((P) => P.id === e.avaliado_id);
      t.forEach((P, K) => {
        let F = [...P.keys].sort().join(",");
        if (c.planos.some((po) => po.inspecao_id === e.id && po.modelo_id === P.modelo.id && [...po.questao_keys].sort().join(",") === F))
          return;
        let ho = P.modelo.destinatario === "fixo" ? P.modelo.email_fixo ?? null : g?.email ?? null, mo = {
          id: _(),
          org_id: i.id,
          modelo_id: P.modelo.id,
          modelo_snapshot: { nome: P.modelo.nome, definicao: h(P.modelo.definicao), exige_aprovacao: !!P.modelo.exige_aprovacao },
          inspecao_id: e.id,
          avaliado_id: e.avaliado_id,
          formulario_id: e.formulario_id,
          questao_keys: P.keys,
          responsavel_email: ho,
          token_hash: l[K].h,
          prazo: B(U(), P.modelo.prazo_dias),
          status: "aberto",
          respostas: {},
          anexos: [],
          finalizado_em: null,
          ultimo_email_em: ho ? m() : null,
          created_at: m(),
          updated_at: m()
        };
        c.planos.push(mo), fo(c, Zo(c, mo, Do(l[K].t), l[K].h));
      });
      let A = n.definicao.config.relatorio?.emails, w = /* @__PURE__ */ new Set;
      if (A?.avaliado && g?.email)
        w.add(g.email);
      for (let P of A?.extras ?? [])
        if (P.trim())
          w.add(P.trim());
      let q = c.formularios.find((P) => P.id === e.formulario_id)?.nome ?? "", O = [];
      for (let P of w)
        if (fo(c, {
          idem_key: `relatorio:${e.id}:${P}`,
          para: P,
          assunto: `Relatório: ${q} — ${g?.nome ?? ""} — ${e.nota_pct === null ? "sem nota" : String(e.nota_pct).replace(".", ",") + "%"}`,
          texto: `Segue o relatório da inspeção finalizada em ${new Date(e.finalizada_em ?? e.iniciada_em).toLocaleString("pt-BR", { timeZone: i.fuso_horario })}. ${e.qtd_nao_conformidades} não conformidade(s).`,
          anexo: { tipo: "relatorio_pdf", inspecao_id: e.id }
        }))
          O.push(P);
      if (O.length)
        L(c, e.id, null, "relatorio_enviado", { para: O });
    });
  }
  return ao;
}

// backend/repo.ts
var Ue = [
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
function we() {
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
function ye(r) {
  return {
    async get(i, d) {
      return (await r`select data_url from anexos where org_id = ${i} and id = ${d}`)[0]?.data_url;
    },
    async set(i, d, u) {
      let b = Math.round((u.length - u.indexOf(",") - 1) * 3 / 4);
      await r`insert into anexos (org_id, id, data_url, bytes) values (${i}, ${d}, ${u}, ${b})
        on conflict (org_id, id) do nothing`;
    },
    async presentes(i, d) {
      if (!d.length)
        return /* @__PURE__ */ new Set;
      let u = await r`select id from anexos where org_id = ${i} and id = any(string_to_array(${d.join(",")}, ','))`;
      return new Set(u.map((b) => b.id));
    }
  };
}
function Be(r, i, d) {
  let u = null, b = /* @__PURE__ */ new Map, _ = 0, m = () => u ?? r, h = /* @__PURE__ */ new Map, y = /* @__PURE__ */ new Set;
  return {
    org: i,
    avisos: y,
    enviaEmails: d.enviaEmails,
    async carregar() {
      let [v, f] = await Promise.all([
        m()`select colecao, id, dados from registros where org_id = ${i.id} order by seq`,
        m()`select contadores from orgs where id = ${i.id}`
      ]), p = we();
      b = /* @__PURE__ */ new Map;
      for (let k of v) {
        let I = typeof k.dados === "string" ? JSON.parse(k.dados) : k.dados;
        p[k.colecao].push(I), b.set(`${k.colecao}:${k.id}`, JSON.stringify(I));
      }
      let x = f[0]?.contadores;
      return p.eventoSeq = _ = Number((typeof x === "string" ? JSON.parse(x) : x)?.eventoSeq ?? 0), p;
    },
    async gravar(v) {
      let f = /* @__PURE__ */ new Set;
      for (let p of Ue)
        for (let x of v[p]) {
          let k = `${p}:${x.id}`;
          f.add(k);
          let I = JSON.stringify(x);
          if (b.get(k) === I)
            continue;
          await m()`insert into registros (org_id, colecao, id, dados) values (${i.id}, ${p}, ${String(x.id)}, ${I}::text::jsonb)
            on conflict (org_id, colecao, id) do update set dados = excluded.dados, atualizado = now()`, b.set(k, I);
        }
      for (let p of [...b.keys()]) {
        if (f.has(p))
          continue;
        let x = p.indexOf(":");
        await m()`delete from registros where org_id = ${i.id} and colecao = ${p.slice(0, x)} and id = ${p.slice(x + 1)}`, b.delete(p);
      }
      if (v.eventoSeq !== _)
        await m()`update orgs set contadores = jsonb_set(contadores, '{eventoSeq}', ${String(v.eventoSeq)}::text::jsonb) where id = ${i.id}`, _ = v.eventoSeq;
    },
    async exclusivo(v) {
      if (u)
        return v();
      return r.begin(async (f) => {
        await f`select pg_advisory_xact_lock(hashtext(${i.id}))`, u = f;
        try {
          return await v();
        } finally {
          u = null;
        }
      });
    },
    estadoInicial: we,
    anexo: (v) => d.anexos.get(i.id, v),
    guardarAnexo: (v, f) => d.anexos.set(i.id, v, f),
    anexosPresentes: (v) => d.anexos.presentes(i.id, v),
    urlApp: () => d.urlApp,
    atraso: async () => {
      return;
    },
    aviso: (v) => {
      y.add(v);
    },
    exigirRede: () => {
      return;
    },
    local: { get: (v) => h.get(v) ?? null, set: (v, f) => {
      h.set(v, f);
    }, del: (v) => {
      h.delete(v);
    }, limpar: async () => {
      h.clear();
    } }
  };
}
function Qo(r, i, d) {
  let u = Be(r, i, d);
  return { servidor: be(u), avisos: u.avisos };
}

// backend/api.ts
var E = (r, i = {}) => ({ acao: r, ...i }), Qe = {
  listarFormularios: E("membro"),
  obterFormulario: E("membro"),
  obterVersao: E("membro"),
  criarFormulario: E("gerenciar_formularios"),
  salvarRascunho: E("gerenciar_formularios"),
  publicar: E("gerenciar_formularios", { quemId: 1 }),
  salvarLogo: E("gerenciar_formularios"),
  layoutRelatorio: E("membro"),
  listarAvaliados: E("membro"),
  listarCamposAvaliado: E("membro"),
  criarAvaliado: E("gerenciar_avaliados"),
  salvarAvaliado: E("gerenciar_avaliados"),
  importarAvaliados: E("gerenciar_avaliados"),
  salvarCamposAvaliado: E("gerenciar_avaliados", { quem: 0 }),
  listarInspecoes: E("membro", { quem: 0 }),
  obterInspecao: E("membro", { quem: 0 }),
  eventos: E("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  aprovacaoDaInspecao: E("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  planosDaInspecao: E("membro", { ver: { tipo: "inspecao", arg: 0 } }),
  registrarRelatorio: E("membro", { quemId: 1, ver: { tipo: "inspecao", arg: 0 } }),
  anexo: E("membro", { ver: { tipo: "anexo", arg: 0 } }),
  pacote: E("aplicar", { quemId: 0 }),
  enviarAnexo: E("aplicar", { quemId: 0 }),
  enviarInspecoes: E("aplicar", { quemId: 0 }),
  listarPlanosModelo: E("membro"),
  obterPlanoModelo: E("membro"),
  criarPlanoModelo: E("gerenciar_planos"),
  salvarPlanoModelo: E("gerenciar_planos"),
  listarPlanos: E("membro", { quem: 0 }),
  novoLinkPlano: E("gerenciar_planos", { quem: 1 }),
  decidirPlano: E("gerenciar_planos", { quem: 0 }),
  caixaDeSaida: E("gerenciar_planos"),
  aprovacoesPendentes: E("membro", { quem: 0 }),
  decisoesDe: E("membro", { quem: 0 }),
  decidir: E("aprovar", { quem: 0 }),
  gerarDadosDemo: E("dono", { quem: 0 }),
  painel: E("ver_painel", { quem: 0 }),
  rodarAgenda: E("membro"),
  listarOcorrencias: E("membro", { quem: 0 }),
  obterAgendamento: E("membro"),
  salvarAgendamento: E("gerenciar_agendamentos", { quem: 0 }),
  inativarOcorrencia: E("membro", { quem: 0 }),
  listarPessoas: E("membro"),
  listarFuncoes: E("membro"),
  listarEquipes: E("membro"),
  convidarPessoa: E("gerenciar_permissoes", { quem: 0 }),
  salvarPessoa: E("gerenciar_permissoes", { quem: 0 }),
  criarFuncao: E("gerenciar_permissoes", { quem: 0 }),
  salvarFuncao: E("gerenciar_permissoes", { quem: 0 }),
  excluirFuncao: E("gerenciar_permissoes", { quem: 0 }),
  criarEquipe: E("gerenciar_permissoes", { quem: 0 }),
  salvarEquipe: E("gerenciar_permissoes", { quem: 0 }),
  excluirEquipe: E("gerenciar_permissoes", { quem: 0 })
}, Je = /* @__PURE__ */ new Set(["planoPorToken", "responderPlano"]);

class G extends Error {
  status;
  constructor(r, i) {
    super(i);
    this.status = r;
  }
}
async function Ke(r) {
  let i = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(r));
  return Array.from(new Uint8Array(i), (d) => d.toString(16).padStart(2, "0")).join("");
}
function xe(r) {
  let i = /* @__PURE__ */ new Map, d = r.agora ?? Date.now;
  async function u(v) {
    let f = i.get(v);
    if (f && f.ate > d())
      return f.email;
    let p = await fetch(`${r.authUrl}/user`, { headers: { Authorization: `Bearer ${v}`, apikey: r.anonKey } });
    if (!p.ok)
      throw new G(401, "Sua sessão expirou. Entre de novo.");
    let x = await p.json();
    if (!x.email)
      throw new G(401, "Sessão sem e-mail.");
    if (i.size > 500)
      i.clear();
    return i.set(v, { email: x.email.toLowerCase(), ate: d() + 60000 }), x.email.toLowerCase();
  }
  async function b(v) {
    let f = await r.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'membros' and lower(r.dados->>'email') = ${v}
      order by coalesce((r.dados->>'ativo')::boolean, true) desc, o.criado_em limit 1`;
    if (!f[0])
      throw new G(403, "Este e-mail não tem acesso a nenhuma conta do Inspeta. Peça um convite ao administrador.");
    return { id: f[0].id, nome: f[0].nome, fuso_horario: f[0].fuso_horario };
  }
  async function _(v) {
    let f = await Ke(String(v)), p = await r.sql`
      select o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
      where r.colecao = 'planos' and r.dados->>'token_hash' = ${f} limit 1`;
    if (!p[0])
      throw new G(404, "Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
    return { id: p[0].id, nome: p[0].nome, fuso_horario: p[0].fuso_horario };
  }
  async function m(v) {
    if (!r.serviceKey)
      return;
    let f = await fetch(`${r.authUrl}/invite${r.urlApp ? `?redirect_to=${encodeURIComponent(r.urlApp)}` : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.serviceKey}`, apikey: r.serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: v, data: {} })
    });
    if (!f.ok && f.status !== 422)
      console.error("convite falhou", f.status);
  }
  function h(v) {
    let f = v.headers.get("Origin") ?? "";
    return {
      "Access-Control-Allow-Origin": !r.origens?.length || r.origens.includes(f) ? f || "*" : "null",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin"
    };
  }
  let y = (v, f, p) => new Response(JSON.stringify(p), { status: f, headers: { "Content-Type": "application/json; charset=utf-8", ...h(v) } });
  return async (v) => {
    if (v.method === "OPTIONS")
      return new Response(null, { status: 204, headers: h(v) });
    if (v.method !== "POST")
      return y(v, 405, { ok: !1, erro: "Use POST." });
    let f;
    try {
      let k = await v.text();
      if (k.length > 20971520)
        throw new G(413, "Envio grande demais (máx. 20 MB).");
      f = JSON.parse(k);
    } catch (k) {
      return y(v, k instanceof G ? k.status : 400, { ok: !1, erro: k instanceof G ? k.message : "Corpo inválido." });
    }
    let p = String(f.metodo ?? ""), x = Array.isArray(f.args) ? [...f.args] : [];
    try {
      if (Je.has(p)) {
        let T = await _(String(x[0] ?? "")), { servidor: J, avisos: ao } = Qo(r.sql, T, { urlApp: r.urlApp, anexos: r.anexos, enviaEmails: r.enviaEmails }), io = J[p], co = await io(...x);
        return y(v, 200, { ok: !0, valor: co, avisos: [...ao] });
      }
      let k = v.headers.get("Authorization") ?? "";
      if (!k.startsWith("Bearer "))
        throw new G(401, "Entre para continuar.");
      let I = await u(k.slice(7)), D = await b(I), { servidor: L, avisos: H } = Qo(r.sql, D, { urlApp: r.urlApp, anexos: r.anexos, enviaEmails: r.enviaEmails }), Q = await L._membroPorEmail(I);
      if (!Q || !Q.ativo)
        throw new G(403, "Este acesso foi desativado. Fale com o administrador da conta.");
      if (p === "eu")
        return y(v, 200, { ok: !0, valor: { membro: Q, membros: await L._membrosResolvidos(), org: D } });
      let z = Qe[p];
      if (!z)
        throw new G(404, `Operação desconhecida: ${p}`);
      if (z.acao === "dono" ? !Q.is_master : z.acao !== "membro" && !Y(Q, z.acao))
        throw new G(403, "Você não tem permissão para isso.");
      if (z.quem !== void 0)
        x[z.quem] = Q;
      if (z.quemId !== void 0)
        x[z.quemId] = Q.id;
      if (z.ver && !await L._podeVer(Q, z.ver.tipo, String(x[z.ver.arg] ?? "")))
        throw new G(404, z.ver.tipo === "inspecao" ? "Inspeção não encontrada." : "Arquivo não encontrado.");
      let W = await L[p].apply(L, x);
      if (p === "convidarPessoa" && W && typeof W === "object" && "email" in W)
        await m(String(W.email));
      if (H.size && p !== "rodarAgenda")
        await r.sql`insert into auditoria (org_id, membro_id, metodo) values (${D.id}, ${Q.id}, ${p})`;
      let N = H.has("membros") ? { membros: await L._membrosResolvidos() } : {};
      return y(v, 200, { ok: !0, valor: W ?? null, avisos: [...H], ...N });
    } catch (k) {
      if (k instanceof G)
        return y(v, k.status, { ok: !1, erro: k.message });
      let I = k instanceof Error ? k.message : String(k), D = !(k instanceof Error && k.constructor === Error);
      if (D)
        console.error(p, k);
      return y(v, D ? 500 : 400, { ok: !1, erro: D ? "Erro no servidor. Tente de novo em instantes." : I });
    }
  };
}

// backend/configInterna.ts
function Se(r, i = 60000) {
  let d = null;
  return async () => {
    if (d && Date.now() - d.em < i)
      return d.v;
    let u = await r`select nome, valor from interno.config`, b = new Map(u.map((m) => [m.nome, m.valor])), _ = {
      app_url: b.get("app_url") ?? "",
      origens: (b.get("origens") ?? "").split(",").map((m) => m.trim()).filter(Boolean),
      cron_secret: b.get("cron_secret") ?? "",
      url_jobs: b.get("url_jobs") ?? ""
    };
    return d = { em: Date.now(), v: _ }, _;
  };
}

// backend/funcao-api.ts
var wo = (r) => Deno.env.get(r) ?? "", Ko = Ze(wo("SUPABASE_DB_URL"), { prepare: !1, max: 3, idle_timeout: 20 }), Ye = Se(Ko), Ge = ye(Ko), Jo = null;
Deno.serve(async (r) => {
  let i = await Ye(), d = i.app_url + "|" + i.origens.join(",");
  if (Jo?.chave !== d)
    Jo = { chave: d, h: xe({
      sql: Ko,
      authUrl: `${wo("SUPABASE_URL")}/auth/v1`,
      anonKey: wo("SUPABASE_ANON_KEY"),
      serviceKey: wo("SUPABASE_SERVICE_ROLE_KEY"),
      urlApp: i.app_url,
      origens: i.origens,
      anexos: Ge,
      enviaEmails: !!wo("RESEND_API_KEY")
    }) };
  return Jo.h(r);
});
