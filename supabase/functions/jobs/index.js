// backend/funcao-jobs.ts
import _a from "npm:postgres@3.4.5";

// backend/configInterna.ts
function de(o, n = 60000) {
  let c = null;
  return async () => {
    if (c && Date.now() - c.em < n)
      return c.v;
    let l = await o`select nome, valor from interno.config`, _ = new Map(l.map((p) => [p.nome, p.valor])), m = {
      app_url: _.get("app_url") ?? "",
      origens: (_.get("origens") ?? "").split(",").map((p) => p.trim()).filter(Boolean),
      cron_secret: _.get("cron_secret") ?? "",
      url_jobs: _.get("url_jobs") ?? ""
    };
    return c = { em: Date.now(), v: m }, m;
  };
}
function le(o, n) {
  if (!o || !n || o.length !== n.length)
    return !1;
  let c = 0;
  for (let l = 0;l < o.length; l++)
    c |= o.charCodeAt(l) ^ n.charCodeAt(l);
  return c === 0;
}

// app/src/pdf.ts
import { PDFDocument as Ge, StandardFonts as ue, rgb as go } from "npm:pdf-lib@1.17.1";

// app/src/ui/format.ts
var Ze = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Rio_Branco", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), Je = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Rio_Branco", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), Ke = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Rio_Branco", day: "2-digit", month: "2-digit", year: "numeric" }), He = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), Ye = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }), ao = {
  dataHora: (o) => o ? Ze.format(new Date(o)).replace(",", "") : "—",
  dataHoraCompleta: (o) => o ? Je.format(new Date(o)).replace(",", " às") : "—",
  data: (o) => o ? Ke.format(new Date(o)) : "—",
  pct: (o) => o === null || o === void 0 ? "—" : He.format(o) + "%",
  num: (o) => o === null || o === void 0 ? "—" : Ye.format(o),
  relativo(o) {
    if (!o)
      return "nunca";
    let n = Math.round((Date.now() - Date.parse(o)) / 1000);
    if (n < 60)
      return "agora";
    if (n < 3600)
      return `há ${Math.floor(n / 60)} min`;
    if (n < 86400)
      return `há ${Math.floor(n / 3600)} h`;
    return `há ${Math.floor(n / 86400)} d`;
  },
  iniciais: (o) => o.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join(""),
  bytes: (o) => o < 1048576 ? `${Math.round(o / 1024)} KB` : `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
};

// app/src/pdf.ts
var no = (o) => o.replace(/[−–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/✓/g, "OK").replace(/✕/g, "X").replace(/[^\x20-\x7E -ÿ—•°]/g, ""), J = {
  text: go(0.086, 0.102, 0.078),
  muted: go(0.325, 0.353, 0.314),
  border: go(0.84, 0.85, 0.815),
  accent: go(0.153, 0.275, 0.435),
  ok: go(0.078, 0.412, 0.231),
  bad: go(0.694, 0.145, 0.102),
  mid: go(0.541, 0.353, 0),
  surface: go(0.957, 0.961, 0.949)
}, me = (o) => o === "rank-good" ? J.ok : o === "rank-bad" ? J.bad : o === "rank-mid" ? J.mid : J.accent, We = (o) => {
  let n = /^#?([0-9a-f]{6})$/i.exec(o ?? "");
  if (!n)
    return J.accent;
  let c = parseInt(n[1], 16);
  return go((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255);
}, Fo = (o) => Uint8Array.from(atob(o.split(",")[1]), (n) => n.charCodeAt(0));
async function pe(o) {
  let n = o.definicao.config.relatorio?.layout ?? {}, c = We(n.cor), l = n.colunas === 2 ? 2 : 1, _ = n.fotos ?? "questao", m = await Ge.create();
  m.setTitle(no(`${o.formulario} — ${o.avaliado.nome}`)), m.setAuthor(no(o.org.nome)), m.setCreator("Inspeta");
  let p = await m.embedFont(ue.Helvetica), g = await m.embedFont(ue.HelveticaBold), b = 595.28, y = 841.89, f = 44, v = m.addPage([b, y]), h = y - f, I = /* @__PURE__ */ new Map;
  for (let q of o.inspecao.anexos) {
    let k = o.anexos[q.client_uuid];
    if (!k || _ === "nenhuma" && q.tipo === "foto")
      continue;
    try {
      I.set(q.client_uuid, q.mime === "image/png" || k.startsWith("data:image/png") ? await m.embedPng(Fo(k)) : await m.embedJpg(Fo(k)));
    } catch {}
  }
  let M = (q) => {
    if (h - q < f + 24)
      v = m.addPage([b, y]), h = y - f;
  }, P = (q, k, O, L = p, R = J.text) => v.drawText(no(q), { x: k, y: h, size: O, font: L, color: R }), V = (q, k, O, L) => {
    let R = no(q).split(/\s+/), E = [], U = "";
    for (let N of R) {
      let B = U ? U + " " + N : N;
      if (O.widthOfTextAtSize(B, k) > L && U)
        E.push(U), U = N;
      else
        U = B;
    }
    if (U)
      E.push(U);
    return E;
  };
  v.drawRectangle({ x: 0, y: y - 6, width: b, height: 6, color: c });
  let eo = 0;
  if (o.logo)
    try {
      let q = o.logo.startsWith("data:image/png") ? await m.embedPng(Fo(o.logo)) : await m.embedJpg(Fo(o.logo)), k = Math.min(40 / q.height, 120 / q.width);
      eo = q.width * k, v.drawImage(q, { x: b - f - eo, y: y - f - q.height * k + 6, width: eo, height: q.height * k });
    } catch {}
  let co = b - 2 * f - (eo ? eo + 16 : 0);
  P(o.org.nome.toUpperCase(), f, 9, g, J.muted), h -= 22;
  for (let q of V(o.formulario, 18, g, co))
    P(q, f, 18, g, c), h -= 22;
  P(`Versão ${o.versao} · Inspeção ${o.inspecao.id.slice(0, 8).toUpperCase()}`, f, 9, p, J.muted), h -= 24;
  let Q = [
    ["Avaliado", o.avaliado.nome],
    ["Responsável", o.responsavel.nome],
    ["Início", ao.dataHoraCompleta(o.inspecao.iniciada_em)],
    ["Fim", ao.dataHoraCompleta(o.inspecao.finalizada_em)]
  ];
  if (v.drawRectangle({ x: f, y: h - 44, width: b - 2 * f, height: 52, color: J.surface }), Q.forEach(([q, k], O) => {
    let L = f + 12 + O % 2 * ((b - 2 * f) / 2), R = h - 8 - Math.floor(O / 2) * 22;
    v.drawText(no(q), { x: L, y: R, size: 8, font: p, color: J.muted }), v.drawText(no(k), { x: L + 64, y: R, size: 9.5, font: g, color: J.text });
  }), h -= 70, o.inspecao.nota_pct !== null && n.mostrar_nota !== !1) {
    P("NOTA FINAL", f, 8, g, J.muted), h -= 30, P(ao.pct(o.inspecao.nota_pct), f, 28, g, me(o.inspecao.classificacao_cor));
    let q = f + g.widthOfTextAtSize(no(ao.pct(o.inspecao.nota_pct)), 28) + 14;
    v.drawText(no(o.inspecao.classificacao ?? ""), { x: q, y: h + 8, size: 12, font: g, color: me(o.inspecao.classificacao_cor) });
    let k = [`${ao.num(o.inspecao.pontos)} de ${ao.num(o.inspecao.pontos_max)} pontos`, `${o.inspecao.qtd_nao_conformidades} não conformidade(s)`];
    if (o.notaAnterior !== null && n.mostrar_anterior !== !1)
      k.push(`anterior: ${ao.pct(o.notaAnterior)}`);
    v.drawText(no(k.join(" · ")), { x: q, y: h - 6, size: 9, font: p, color: J.muted }), h -= 34;
  }
  let to = [];
  function po(q, k, O, L, R, E) {
    let U = o.inspecao.resultado.questoes[q.key], N = o.inspecao.respostas[q.key], B = U.conforme === !1 ? "NÃO CONFORME" + (U.reincidente ? " · REINC." : "") : U.conforme === !0 ? "CONFORME" : "", H = B ? g.widthOfTextAtSize(B, 7.5) + 8 : 0, Y = V(`${k}. ${q.titulo}`, 9.5, g, R - H), ro = V(Xe(q, N, U.valor_calculado), 9.5, p, R - 12), xo = N?.observacao ? V("Obs.: " + N.observacao, 9, p, R - 12) : [], ho = 13 * (Y.length + ro.length) + 12 * xo.length, uo = L;
    if (E) {
      for (let G of Y)
        v.drawText(G, { x: O, y: uo, size: 9.5, font: g, color: J.text }), uo -= 13;
      if (B)
        v.drawText(B, { x: O + R - H + 8, y: L, size: 7.5, font: g, color: U.conforme === !1 ? J.bad : J.ok });
      for (let G of ro)
        v.drawText(G, { x: O + 12, y: uo, size: 9.5, font: p, color: J.text }), uo -= 13;
      for (let G of xo)
        v.drawText(G, { x: O + 12, y: uo, size: 9, font: p, color: J.muted }), uo -= 12;
    }
    let vo = o.inspecao.anexos.filter((G) => G.questao_key === q.key && I.has(G.client_uuid)), Do = vo.filter((G) => G.tipo === "assinatura" || _ === "questao");
    if (_ === "final" && E) {
      let G = vo.filter((t) => t.tipo === "foto").map((t) => t.client_uuid);
      if (G.length)
        to.push({ n: k, titulo: q.titulo, ids: G });
    }
    if (Do.length) {
      let G = q.tipo === "assinatura" ? 56 : l === 2 ? 64 : 90, t = O + 12, e = 1;
      for (let a of Do) {
        let i = I.get(a.client_uuid), s = Math.min(G / i.height, (q.tipo === "assinatura" ? 180 : G) / i.width), r = i.width * s, u = i.height * s;
        if (t + r > O + R)
          t = O + 12, e++;
        if (E)
          v.drawImage(i, { x: t, y: uo - (e - 1) * (G + 6) - u - 2, width: r, height: u });
        t += r + 6;
      }
      ho += e * (G + 6) + 4;
    }
    return ho + 8;
  }
  let K = 0, j = 16, X = l === 2 ? (b - 2 * f - j) / 2 : b - 2 * f;
  for (let q of o.definicao.topicos) {
    let k = [], O = 0;
    for (let R of q.questoes) {
      K++;
      let E = o.inspecao.resultado.questoes[R.key];
      if (!E)
        continue;
      let U = o.inspecao.anexos.some((N) => N.questao_key === R.key && N.tipo === "assinatura");
      if (n.so_excecoes && E.conforme !== !1 && o.inspecao.respostas[R.key] && !U) {
        O++;
        continue;
      }
      k.push({ q: R, n: K });
    }
    if (!k.length && !O)
      continue;
    M(48), h -= 8, v.drawLine({ start: { x: f, y: h + 12 }, end: { x: b - f, y: h + 12 }, thickness: 0.6, color: J.border }), P(q.titulo, f, 12, g, c);
    let L = o.inspecao.resultado.topicos[q.key]?.pct;
    if (L !== null && L !== void 0 && n.mostrar_nota !== !1)
      v.drawText(no(ao.pct(L)), { x: b - f - g.widthOfTextAtSize(no(ao.pct(L)), 11), y: h, size: 11, font: g, color: J.text });
    h -= 20;
    for (let R = 0;R < k.length; R += l) {
      let E = k.slice(R, R + l), U = Math.max(...E.map((N) => po(N.q, N.n, f, h, X, !1)));
      M(U), E.forEach((N, B) => po(N.q, N.n, f + B * (X + j), h, X, !0)), h -= U;
    }
    if (O)
      M(14), P(`${O} ${O === 1 ? "questão conforme" : "questões conformes"} neste tópico`, f + 12, 9, p, J.muted), h -= 16;
  }
  if (to.length) {
    M(40), h -= 10, P("Fotos", f, 12, g, c), h -= 18;
    let q = 150;
    for (let k of to) {
      M(q + 30), P(`${k.n}. ${k.titulo}`.slice(0, 110), f, 9, g), h -= 6;
      let O = f;
      for (let L of k.ids) {
        let R = I.get(L), E = Math.min(q / R.height, 200 / R.width);
        if (O + R.width * E > b - f)
          O = f, h -= q + 8, M(q + 10);
        v.drawImage(R, { x: O, y: h - R.height * E, width: R.width * E, height: R.height * E }), O += R.width * E + 8;
      }
      h -= q + 14;
    }
  }
  if (o.inspecao.resultado.nao_conformidades.length && n.resumo_nc !== !1) {
    M(60), h -= 10, v.drawRectangle({ x: f, y: h - 6, width: b - 2 * f, height: 22, color: go(0.988, 0.922, 0.914) }), P(`Não conformidades (${o.inspecao.resultado.nao_conformidades.length})`, f + 8, 11, g, J.bad), h -= 24;
    let q = /* @__PURE__ */ new Map, k = 0;
    for (let O of o.definicao.topicos)
      for (let L of O.questoes)
        q.set(L.key, { q: L, n: ++k });
    for (let O of o.inspecao.resultado.nao_conformidades) {
      let L = q.get(O);
      if (!L)
        continue;
      let R = V(`• ${L.n}. ${L.q.titulo}${o.inspecao.resultado.questoes[O]?.reincidente ? " (reincidente)" : ""}`, 9.5, p, b - 2 * f - 16);
      M(13 * R.length + 4);
      for (let E of R)
        P(E, f + 8, 9.5), h -= 13;
    }
  }
  let lo = m.getPages(), fo = n.rodape?.trim() ? no(n.rodape.trim()).slice(0, 120) : "";
  return lo.forEach((q, k) => {
    let O = no(`Gerado em ${ao.dataHoraCompleta((/* @__PURE__ */ new Date()).toISOString())} · página ${k + 1} de ${lo.length}`);
    if (q.drawText(O, { x: b - f - p.widthOfTextAtSize(O, 8), y: 24, size: 8, font: p, color: J.muted }), fo)
      q.drawText(fo, { x: f, y: 24, size: 8, font: p, color: J.muted });
  }), m.save();
}
function Xe(o, n, c) {
  if (o.tipo === "calculo")
    return c === null || c === void 0 ? "—" : `${ao.num(c)}${o.numerica?.unidade ? " " + o.numerica.unidade : ""}`;
  if (!n)
    return "Sem resposta";
  if (n.na)
    return "Não se aplica";
  switch (o.tipo) {
    case "escolha_simples":
    case "escolha_multipla":
      return (o.opcoes ?? []).filter((l) => n.opcoes?.includes(l.key)).map((l) => l.texto).join(", ") || "Sem resposta";
    case "numerica":
      return n.numero === null || n.numero === void 0 ? "Sem resposta" : `${ao.num(n.numero)}${o.numerica?.unidade ? " " + o.numerica.unidade : ""}`;
    case "texto":
      return n.texto?.trim() || "Sem resposta";
    case "data_hora":
      return n.data ? ao.dataHoraCompleta(n.data) : "Sem resposta";
    case "assinatura":
      return n.assinatura ? "Assinado" : "Sem assinatura";
  }
}
// packages/form-engine/src/formula.ts
class so extends Error {
}
function fe(o) {
  let n = [], c = 0;
  while (c < o.length) {
    let l = o[c];
    if (l === " " || l === "\t") {
      c++;
      continue;
    }
    if (l === "[") {
      let _ = o.indexOf("]", c);
      if (_ < 0)
        throw new so("colchete sem fechar");
      let m = Number(o.slice(c + 1, _).trim());
      if (!Number.isInteger(m) || m < 1)
        throw new so(`referência inválida: ${o.slice(c, _ + 1)}`);
      n.push({ t: "ref", v: m }), c = _ + 1;
      continue;
    }
    if (/[0-9.,]/.test(l)) {
      let _ = c;
      while (_ < o.length && /[0-9.,]/.test(o[_]))
        _++;
      let m = o.slice(c, _).replace(",", "."), p = Number(m);
      if (!Number.isFinite(p))
        throw new so(`número inválido: ${m}`);
      n.push({ t: "num", v: p }), c = _;
      continue;
    }
    if (l === "+" || l === "-" || l === "*" || l === "/") {
      n.push({ t: "op", v: l }), c++;
      continue;
    }
    if (l === "x" || l === "×") {
      n.push({ t: "op", v: "*" }), c++;
      continue;
    }
    if (l === "(") {
      n.push({ t: "lp" }), c++;
      continue;
    }
    if (l === ")") {
      n.push({ t: "rp" }), c++;
      continue;
    }
    throw new so(`caractere não permitido: "${l}"`);
  }
  return n;
}
function Zo(o) {
  return fe(o).filter((n) => n.t === "ref").map((n) => n.v);
}
function Jo(o, n) {
  let c = fe(o), l = 0, _ = !1, m = () => c[l];
  function p() {
    let f = c[l++];
    if (!f)
      throw new so("fórmula incompleta");
    if (f.t === "num")
      return f.v;
    if (f.t === "ref") {
      let v = n(f.v);
      if (v === null || v === void 0 || !Number.isFinite(v))
        return _ = !0, 0;
      return v;
    }
    if (f.t === "op" && f.v === "-")
      return -p();
    if (f.t === "lp") {
      let v = b(), h = c[l++];
      if (!h || h.t !== "rp")
        throw new so("parêntese sem fechar");
      return v;
    }
    throw new so("termo inesperado");
  }
  function g() {
    let f = p();
    for (;; ) {
      let v = m();
      if (v && v.t === "op" && (v.v === "*" || v.v === "/")) {
        l++;
        let h = p();
        f = v.v === "*" ? f * h : f / h;
      } else
        return f;
    }
  }
  function b() {
    let f = g();
    for (;; ) {
      let v = m();
      if (v && v.t === "op" && (v.v === "+" || v.v === "-")) {
        l++;
        let h = g();
        f = v.v === "+" ? f + h : f - h;
      } else
        return f;
    }
  }
  let y = b();
  if (l !== c.length)
    throw new so("sobrou texto depois da fórmula");
  if (_)
    return null;
  if (!Number.isFinite(y))
    return null;
  return y;
}

// packages/form-engine/src/engine.ts
function So(o, n) {
  let c = 10 ** n;
  return Math.sign(o) * Math.round(Math.abs(o) * c + Number.EPSILON) / c;
}
function To(o) {
  let n = /* @__PURE__ */ new Map, c = /* @__PURE__ */ new Map, l = /* @__PURE__ */ new Map, _ = /* @__PURE__ */ new Map, m = 0;
  for (let p of o.topicos) {
    l.set(p.key, p);
    for (let g of p.questoes) {
      m++, n.set(g.key, { q: g, topic: p, numero: m }), c.set(m, g);
      for (let b of g.opcoes ?? [])
        _.set(b.key, { option: b, question: g });
    }
  }
  return { questions: n, byNumber: c, topics: l, options: _ };
}
function oa(o, n) {
  if (!n)
    return !1;
  if (n.na)
    return !0;
  switch (o.tipo) {
    case "escolha_simples":
    case "escolha_multipla":
      return (n.opcoes?.length ?? 0) > 0;
    case "numerica":
      return typeof n.numero === "number" && Number.isFinite(n.numero);
    case "texto":
      return (n.texto ?? "").trim().length > 0;
    case "data_hora":
      return !!n.data;
    case "assinatura":
      return !!n.assinatura;
    case "calculo":
      return !0;
  }
}
function ea(o, n) {
  if (!n?.opcoes?.length)
    return [];
  let c = new Set(n.opcoes);
  return (o.opcoes ?? []).filter((l) => c.has(l.key));
}
function aa(o, n) {
  let c = o.numerica?.faixas_nota;
  if (!c?.length)
    return null;
  for (let l of c)
    if (l.ate === null || n <= l.ate)
      return l.pontos;
  return c[c.length - 1].pontos;
}
function ge(o) {
  switch (o.tipo) {
    case "escolha_simples": {
      let n = (o.opcoes ?? []).filter((c) => !c.na && typeof c.pontos === "number").map((c) => c.pontos);
      return n.length ? Math.max(...n) : null;
    }
    case "escolha_multipla": {
      let n = (o.opcoes ?? []).filter((c) => !c.na && typeof c.pontos === "number").map((c) => c.pontos);
      return n.length ? n.filter((c) => c > 0).reduce((c, l) => c + l, 0) : null;
    }
    case "numerica": {
      let n = o.numerica?.faixas_nota;
      return n?.length ? Math.max(...n.map((c) => c.pontos)) : null;
    }
    default:
      return null;
  }
}
function _e(o, n) {
  let c = o.numerica?.limite;
  if (!c || c.min == null && c.max == null)
    return null;
  if (c.min != null && n < c.min)
    return !1;
  if (c.max != null && n > c.max)
    return !1;
  return !0;
}
function ve(o, n, c = To(o)) {
  let l = /* @__PURE__ */ new Map, _ = /* @__PURE__ */ new Set, m = (y) => {
    if (!y)
      return !0;
    if (!g(y.questao))
      return !1;
    return (n[y.questao]?.opcoes ?? []).includes(y.opcao);
  }, p = (y) => {
    let f = "t:" + y;
    if (l.has(f))
      return l.get(f);
    if (_.has(f))
      return !1;
    _.add(f);
    let v = m(c.topics.get(y)?.depende_de);
    return _.delete(f), l.set(f, v), v;
  };
  function g(y) {
    let f = "q:" + y;
    if (l.has(f))
      return l.get(f);
    let v = c.questions.get(y);
    if (!v)
      return !1;
    if (_.has(f))
      return !1;
    _.add(f);
    let h = p(v.topic.key) && m(v.q.depende_de);
    return _.delete(f), l.set(f, h), h;
  }
  let b = /* @__PURE__ */ new Set;
  for (let y of o.topicos)
    if (p(y.key))
      b.add(y.key);
  for (let y of c.questions.keys())
    if (g(y))
      b.add(y);
  return b;
}
function zo(o, n, c = {}) {
  let l = To(o), _ = ve(o, n, l), m = o.config.casas_decimais ?? 1, p = /* @__PURE__ */ new Map, g = /* @__PURE__ */ new Set, b = (K) => {
    let j = l.byNumber.get(K);
    if (!j || !_.has(j.key))
      return null;
    if (j.tipo === "numerica") {
      let X = n[j.key]?.numero;
      return typeof X === "number" && !n[j.key]?.na ? X : null;
    }
    if (j.tipo === "calculo")
      return y(j);
    return null;
  };
  function y(K) {
    if (p.has(K.key))
      return p.get(K.key);
    if (g.has(K.key) || !K.calculo?.formula)
      return null;
    g.add(K.key);
    let j = null, X = K.calculo.valor_se_vazio;
    try {
      j = Jo(K.calculo.formula, (lo) => {
        let fo = b(lo);
        return fo === null && X != null ? X : fo;
      });
    } catch {
      j = null;
    }
    return g.delete(K.key), p.set(K.key, j), j;
  }
  let f = {}, v = {}, h = 1, I = 0, M = 0, P = [], V = [], eo = 0, co = 0;
  for (let K of o.topicos) {
    let j = 0, X = 0, lo = 1;
    for (let k of K.questoes) {
      let O = n[k.key], L = l.questions.get(k.key).numero, R = _.has(k.key), E = {
        key: k.key,
        numero: L,
        visivel: R,
        respondida: !1,
        na: !1,
        pontos: null,
        pontos_max: null,
        conforme: null,
        pendencias: [],
        reincidente: !1
      };
      if (f[k.key] = E, !R)
        continue;
      if (k.tipo !== "calculo")
        co++;
      if (E.respondida = oa(k, O), k.tipo !== "calculo" && E.respondida)
        eo++;
      let U = ea(k, O);
      if (E.na = !!O?.na || U.length > 0 && U.every((B) => B.na), k.tipo === "calculo")
        E.valor_calculado = y(k);
      if (E.respondida && !E.na) {
        if (k.tipo === "escolha_simples" || k.tipo === "escolha_multipla") {
          let B = U.filter((Y) => !Y.na), H = ge(k);
          if (H !== null)
            E.pontos_max = H, E.pontos = B.reduce((Y, ro) => Y + (ro.pontos ?? 0), 0);
          if (B.some((Y) => Y.conforme === !1))
            E.conforme = !1;
          else if (B.some((Y) => Y.conforme === !0))
            E.conforme = !0;
          for (let Y of B)
            if (Y.desconto && Y.desconto.pct > 0) {
              let ro = 1 - Math.min(100, Y.desconto.pct) / 100;
              if (Y.desconto.escopo === "formulario")
                h *= ro;
              else
                lo *= ro;
            }
        } else if (k.tipo === "numerica") {
          let B = O.numero, H = aa(k, B);
          if (H !== null)
            E.pontos = H, E.pontos_max = ge(k);
          E.conforme = _e(k, B);
        }
      }
      if (E.pontos !== null && E.pontos_max !== null)
        j += E.pontos, X += E.pontos_max;
      let N = [];
      if (k.obrigatoria && !E.respondida && k.tipo !== "calculo")
        N.push({ tipo: "obrigatoria" });
      if (E.respondida && !E.na) {
        let B = O?.fotos ?? 0, H = (O?.observacao ?? "").trim().length > 0;
        if (k.foto_obrigatoria && B < 1)
          N.push({ tipo: "foto" });
        if (E.conforme === !1) {
          if (k.nc_exige?.foto && B < 1 && !N.some((Y) => Y.tipo === "foto"))
            N.push({ tipo: "foto" });
          if (k.nc_exige?.observacao && !H)
            N.push({ tipo: "observacao" });
          if (k.tipo === "numerica" && k.numerica?.limite?.obs_obrigatoria && !H && !N.some((Y) => Y.tipo === "observacao"))
            N.push({ tipo: "observacao" });
        }
      }
      if (E.pendencias = N, N.length)
        V.push(k.key);
      if (E.conforme === !1) {
        if (P.push(k.key), c[k.key]?.conforme === !1)
          E.reincidente = !0;
      }
    }
    let fo = _.has(K.key), q = j * lo;
    v[K.key] = {
      key: K.key,
      visivel: fo,
      pontos: q,
      pontos_max: X,
      desconto_pct: So((1 - lo) * 100, 2),
      pct: X > 0 ? So(q / X * 100, m) : null
    }, I += q, M += X;
  }
  let Q = I * h, po = o.config.calcular_nota !== !1 && M > 0 ? So(Q / M * 100, m) : null;
  return {
    questoes: f,
    topicos: v,
    pontos: So(Q, 2),
    pontos_max: So(M, 2),
    nota_pct: po,
    classificacao: po === null ? null : he(o.config.classificacoes ?? [], po),
    nao_conformidades: P,
    pendentes: V,
    respondidas: eo,
    visiveis: co
  };
}
function he(o, n) {
  let c = o.filter((l) => n >= l.min && n <= l.max);
  if (!c.length)
    return null;
  return c.reduce((l, _) => _.min > l.min ? _ : l);
}
function Ko(o) {
  let n = [], c = To(o), l = /* @__PURE__ */ new Set, _ = (y, f) => {
    if (l.has(y))
      n.push({ onde: f, problema: `chave duplicada ${y}` });
    l.add(y);
  };
  if (!o.topicos.length)
    n.push({ onde: "formulário", problema: "precisa de pelo menos um tópico" });
  let m = 0;
  for (let y of o.topicos) {
    if (_(y.key, `tópico "${y.titulo}"`), !y.titulo.trim())
      n.push({ onde: "tópico", problema: "tópico sem título" });
    if (!y.questoes.length)
      n.push({ onde: `tópico "${y.titulo}"`, problema: "tópico sem questões" });
    b(y.depende_de, `tópico "${y.titulo}"`);
    for (let f of y.questoes) {
      m++;
      let v = `questão ${c.questions.get(f.key).numero} "${f.titulo || "sem título"}"`;
      if (_(f.key, v), !f.titulo.trim())
        n.push({ onde: v, problema: "sem título" });
      if (b(f.depende_de, v), f.tipo === "escolha_simples" || f.tipo === "escolha_multipla") {
        let h = f.opcoes ?? [];
        if (h.length < 2)
          n.push({ onde: v, problema: "precisa de pelo menos 2 opções" });
        for (let I of h) {
          if (_(I.key, v), !I.texto.trim())
            n.push({ onde: v, problema: "opção sem texto" });
          if (I.desconto && (I.desconto.pct < 0 || I.desconto.pct > 100))
            n.push({ onde: v, problema: "desconto deve estar entre 0 e 100%" });
        }
      }
      if (f.tipo === "numerica") {
        let h = f.numerica?.faixas_nota ?? [], I = -1 / 0;
        h.forEach((P, V) => {
          if (P.ate === null && V !== h.length - 1)
            n.push({ onde: v, problema: 'só a última faixa pode ser "acima"' });
          if (P.ate !== null) {
            if (P.ate <= I)
              n.push({ onde: v, problema: "faixas de nota precisam ser crescentes e não podem se cruzar" });
            I = P.ate;
          }
        });
        let M = f.numerica?.limite;
        if (M?.min != null && M?.max != null && M.min > M.max)
          n.push({ onde: v, problema: "limite mínimo maior que o máximo" });
      }
      if (f.tipo === "calculo")
        try {
          let h = Zo(f.calculo?.formula ?? "");
          if (!h.length && !(f.calculo?.formula ?? "").trim())
            n.push({ onde: v, problema: "fórmula vazia" });
          for (let I of h) {
            let M = c.byNumber.get(I);
            if (!M)
              n.push({ onde: v, problema: `a fórmula usa [${I}], que não existe` });
            else if (M.tipo !== "numerica" && M.tipo !== "calculo")
              n.push({ onde: v, problema: `a fórmula usa [${I}], que não é numérica` });
            else if (M.key === f.key)
              n.push({ onde: v, problema: "a fórmula se refere a ela mesma" });
          }
        } catch (h) {
          n.push({ onde: v, problema: h instanceof so ? `fórmula: ${h.message}` : "fórmula inválida" });
        }
    }
  }
  if (m === 0 && o.topicos.length)
    n.push({ onde: "formulário", problema: "nenhuma questão" });
  let p = /* @__PURE__ */ new Map;
  for (let [y, { q: f, topic: v }] of c.questions) {
    if (f.depende_de)
      p.set(y, f.depende_de.questao);
    if (v.depende_de)
      p.set("t:" + v.key, v.depende_de.questao);
  }
  let g = (y) => {
    let f = [], v = p.get(y);
    if (v)
      f.push(v);
    let h = c.questions.get(y)?.topic;
    if (h?.depende_de)
      f.push(h.depende_de.questao);
    return f;
  };
  for (let y of c.questions.keys()) {
    let f = [...g(y)], v = /* @__PURE__ */ new Set;
    while (f.length) {
      let h = f.pop();
      if (h === y) {
        n.push({ onde: `questão ${c.questions.get(y).numero}`, problema: "dependência circular" });
        break;
      }
      if (v.has(h))
        continue;
      v.add(h), f.push(...g(h));
    }
  }
  return (o.config.aprovacao?.etapas ?? []).forEach((y, f) => {
    if (!y.aprovadores.length)
      n.push({ onde: `aprovação, etapa ${f + 1}`, problema: "etapa sem aprovador" });
  }), n;
  function b(y, f) {
    if (!y)
      return;
    let v = c.questions.get(y.questao)?.q;
    if (!v)
      return n.push({ onde: f, problema: "depende de uma questão que não existe" });
    if (v.tipo !== "escolha_simples" && v.tipo !== "escolha_multipla")
      return n.push({ onde: f, problema: "só pode depender de questão de escolha" });
    if (!(v.opcoes ?? []).some((h) => h.key === y.opcao))
      n.push({ onde: f, problema: "depende de uma opção que não existe" });
  }
}
// app/src/data/acesso.ts
var ta = { id: "", nome: "Sem função", acoes: [] };
function we(o, n) {
  if (o === "todos" || n === "todos")
    return "todos";
  return [.../* @__PURE__ */ new Set([...o, ...n])];
}
function wo(o, n, c) {
  let l = (_) => c.filter((m) => _.includes(m.id)).flatMap((m) => m.membros);
  return o.map((_) => {
    let m = n.find((v) => v.id === _.funcao_id) ?? ta, p = c.filter((v) => v.membros.includes(_.id)), g = [_.acesso, ...p.map((v) => v.acesso)], b = g.reduce((v, h) => we(v, h.formularios), []), y = g.reduce((v, h) => we(v, h.avaliados), []), f = /* @__PURE__ */ new Set;
    for (let v of g) {
      for (let h of v.ver_membros)
        f.add(h);
      for (let h of l(v.ver_equipes))
        f.add(h);
    }
    return f.delete(_.id), {
      id: _.id,
      org_id: _.org_id,
      nome: _.nome,
      email: _.email,
      funcao_id: m.id,
      funcao: m.nome,
      acoes: _.is_master ? [.../* @__PURE__ */ new Set([...m.acoes])] : [...m.acoes],
      is_master: _.is_master,
      ativo: _.ativo,
      equipes: p.map((v) => v.id),
      formularios_permitidos: b,
      avaliados_permitidos: y,
      ve_inspecoes_de: [...f]
    };
  });
}
var be = { formularios: [], avaliados: "todos", ver_membros: [], ver_equipes: [] }, ye = { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] };

// app/src/data/agenda.ts
var na = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
var Go = (o) => Date.parse(o + "T00:00:00Z"), ia = (o) => new Date(o).toISOString().slice(0, 10), _o = (o, n) => ia(Go(o) + n * 86400000), Yo = (o) => new Date(Go(o)).getUTCDay(), ra = (o, n) => new Date(Date.UTC(o, n + 1, 0)).getUTCDate();
function sa(o, n) {
  switch (o.recorrencia) {
    case "nenhuma":
      return n === o.data_inicio;
    case "diaria":
      return !0;
    case "semanal":
      return ((o.dias_semana?.length) ? o.dias_semana : [Yo(o.data_inicio)]).includes(Yo(n));
    case "mensal": {
      let c = Number(o.data_inicio.slice(8, 10)), l = new Date(Go(n));
      return l.getUTCDate() === Math.min(c, ra(l.getUTCFullYear(), l.getUTCMonth()));
    }
  }
}
function ca(o, n, c) {
  let l = o.termino === "data" && o.termino_data && o.termino_data < c ? o.termino_data : c, _ = [], m = 0;
  for (let p = o.data_inicio;p <= l; p = _o(p, 1)) {
    if (!sa(o, p))
      continue;
    if (m++, o.termino === "quantidade" && o.termino_qtd && m > o.termino_qtd)
      break;
    if (p >= n)
      _.push(p);
    if (o.recorrencia === "nenhuma")
      break;
  }
  return _;
}
function xe(o, n) {
  let c = new Intl.DateTimeFormat("en-US", {
    timeZone: o,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(n)), l = (_) => Number(c.find((m) => m.type === _).value);
  return (Date.UTC(l("year"), l("month") - 1, l("day"), l("hour"), l("minute"), l("second")) - n) / 60000;
}
function Ae(o, n, c) {
  let [l, _, m] = o.split("-").map(Number), [p, g] = n.split(":").map(Number), b = Date.UTC(l, _ - 1, m, p, g), y = b - xe(c, b) * 60000;
  return y = b - xe(c, y) * 60000, new Date(y).toISOString();
}
function da(o, n) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: n }).format(new Date(o));
}
function ke(o, n, c) {
  let l = o.dia_inteiro ? ["08:00"] : [...new Set(o.horarios)].sort();
  return ca(o, n, c).flatMap((_) => l.map((m) => Ae(_, m, o.fuso_horario)));
}
function jo(o, n) {
  if (n.dia_inteiro)
    return Ae(_o(da(o, n.fuso_horario), 1), "00:00", n.fuso_horario);
  return new Date(Date.parse(o) + 7200000).toISOString();
}
function Wo(o, n, c = Date.now()) {
  if (o.status !== "pendente")
    return o.status;
  return c > Date.parse(jo(o.previsto_em, n)) ? "atrasada" : "pendente";
}
function De(o) {
  let n = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.data_inicio))
    n.push("Informe a data de início.");
  if (!o.dia_inteiro && !o.horarios.length)
    n.push("Informe pelo menos um horário ou marque o dia inteiro.");
  if (o.horarios.some((c) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(c)))
    n.push("Há um horário inválido.");
  if (o.recorrencia === "semanal" && !o.dias_semana?.length)
    n.push("Escolha pelo menos um dia da semana.");
  if (o.termino === "data" && (!o.termino_data || o.termino_data < o.data_inicio))
    n.push("A data de término precisa ser depois do início.");
  if (o.termino === "quantidade" && !(o.termino_qtd && o.termino_qtd > 0 && o.termino_qtd <= 999))
    n.push("Informe quantas vezes (de 1 a 999).");
  return n;
}
var Ho = (o) => o.split("-").reverse().join("/");
function Se(o) {
  return o.length <= 1 ? o.join("") : `${o.slice(0, -1).join(", ")} e ${o[o.length - 1]}`;
}
function Xo(o) {
  let n = o.dia_inteiro ? ", o dia inteiro" : ` às ${Se([...new Set(o.horarios)].sort())}`, c;
  switch (o.recorrencia) {
    case "nenhuma":
      return `Uma vez, em ${Ho(o.data_inicio)}${o.dia_inteiro ? n : "," + n}`;
    case "diaria":
      c = "Todo dia";
      break;
    case "semanal": {
      let _ = [...o.dias_semana?.length ? o.dias_semana : [Yo(o.data_inicio)]].sort();
      if (c = _.length === 7 ? "Todo dia" : `${_.every((m) => m === 0 || m === 6) ? "Todo" : "Toda"} ${Se(_.map((m) => na[m]))}`, _.length === 5 && !_.includes(0) && !_.includes(6))
        c = "De segunda a sexta";
      break;
    }
    case "mensal":
      c = `Todo mês no dia ${Number(o.data_inicio.slice(8, 10))}`;
      break;
  }
  let l = o.termino === "data" && o.termino_data ? ` até ${Ho(o.termino_data)}` : o.termino === "quantidade" && o.termino_qtd ? `, ${o.termino_qtd} ${o.termino_qtd === 1 ? "vez" : "vezes"}` : "";
  return `${c}${n}, a partir de ${Ho(o.data_inicio)}${l}`;
}

// app/src/data/camposAvaliado.ts
function qe(o, n) {
  return !o.depende_de || (n[o.depende_de.campo_id] ?? "") === o.depende_de.valor;
}
function oe(o, n = {}) {
  let c = [...o].sort((m, p) => m.ordem - p.ordem), l = {};
  for (let m of c) {
    let p = (n[m.id] ?? "").trim();
    if (p && m.tipo === "lista")
      p = (m.opcoes ?? []).find((g) => g.localeCompare(p, "pt-BR", { sensitivity: "base" }) === 0) ?? p;
    if (p)
      l[m.id] = p;
  }
  let _ = [];
  for (let m = !0;m; ) {
    m = !1;
    for (let p of c)
      if (l[p.id] !== void 0 && !qe(p, l))
        delete l[p.id], m = !0;
  }
  for (let m of c) {
    if (!qe(m, l))
      continue;
    let p = l[m.id];
    if (!p) {
      if (m.obrigatorio)
        _.push(`${m.nome} é obrigatório`);
      continue;
    }
    if (m.tipo === "lista" && !(m.opcoes ?? []).includes(p))
      _.push(`${m.nome}: "${p}" não está entre as opções (${(m.opcoes ?? []).join(", ")})`);
    if (m.tipo === "numero" && !Number.isFinite(Number(p.replace(/\./g, "").replace(",", "."))))
      _.push(`${m.nome}: "${p}" não é um número`);
    if (m.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(p)) {
      let g = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(p);
      if (g)
        l[m.id] = `${g[3]}-${g[2]}-${g[1]}`;
      else
        _.push(`${m.nome}: use a data como dd/mm/aaaa`);
    }
  }
  return { valores: l, erros: _ };
}
function Ee(o) {
  let n = [], c = /* @__PURE__ */ new Set;
  for (let l of o) {
    let _ = l.nome.trim().toLowerCase();
    if (!_)
      n.push("Há um campo sem nome.");
    else if (c.has(_))
      n.push(`Já existe um campo chamado "${l.nome}".`);
    if (c.add(_), ["nome", "código", "codigo", "cnpj", "e-mail", "email", "telefone", "endereço", "endereco"].includes(_))
      n.push(`"${l.nome}" já é um campo padrão do cadastro.`);
    if (l.tipo === "lista" && (l.opcoes ?? []).filter((m) => m.trim()).length < 2)
      n.push(`${l.nome}: a lista precisa de pelo menos 2 opções.`);
    if (l.depende_de) {
      let m = o.find((b) => b.id === l.depende_de.campo_id);
      if (!m || m.tipo !== "lista")
        n.push(`${l.nome}: só pode depender de um campo do tipo lista.`);
      else if (!(m.opcoes ?? []).includes(l.depende_de.valor))
        n.push(`${l.nome}: "${l.depende_de.valor}" não é opção de ${m.nome}.`);
      let p = /* @__PURE__ */ new Set([l.id]), g = m;
      while (g?.depende_de) {
        if (p.has(g.id)) {
          n.push(`${l.nome}: dependência circular.`);
          break;
        }
        if (p.add(g.id), g = o.find((b) => b.id === g.depende_de.campo_id), g && p.has(g.id)) {
          n.push(`${l.nome}: dependência circular.`);
          break;
        }
      }
    }
  }
  return [...new Set(n)];
}

// app/src/data/seed.ts
var mo = { id: "org-1", nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco" }, la = [
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
], Ao = [
  { id: "fn-admin", nome: "Administrador", acoes: la, sistema: !0 },
  { id: "fn-qualidade", nome: "Analista de qualidade", acoes: ["gerenciar_formularios", "aplicar", "editar_inspecao", "ver_todas_inspecoes", "gerenciar_avaliados", "gerenciar_planos", "aprovar", "ver_painel"] },
  { id: "fn-supervisor", nome: "Supervisor de lojas", acoes: ["aplicar", "ver_painel", "aprovar"] },
  { id: "fn-aplicador", nome: "Aplicador", acoes: ["aplicar"] }
], ua = { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] };
var No = [
  { id: "m-rogerio", org_id: mo.id, nome: "Rogério Marinho", email: "rogerio@exemplo.com", funcao_id: "fn-admin", is_master: !0, ativo: !0, acesso: ua, created_at: "2026-09-01T12:00:00.000Z" },
  {
    id: "m-ana",
    org_id: mo.id,
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
    org_id: mo.id,
    nome: "Carlos Eduardo Lima",
    email: "carlos@exemplo.com",
    funcao_id: "fn-supervisor",
    is_master: !1,
    ativo: !0,
    acesso: { formularios: ["f-flv"], avaliados: ["a-bosque", "a-centro"], ver_membros: [], ver_equipes: ["eq-lojas"] },
    created_at: "2026-09-01T12:00:00.000Z"
  }
], Lo = [
  { id: "eq-lojas", org_id: mo.id, nome: "Equipe de lojas", membros: ["m-ana"], acesso: { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] } }
];
var ee = (o, n, c, l, _) => ({
  id: o,
  org_id: mo.id,
  nome: n,
  codigo_externo: c,
  endereco: l,
  email: _,
  ativo: !0,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z"
}), Eo = [
  ee("a-bosque", "Loja 01 — Bosque", "LJ01", "Av. Ceará, 1500 — Bosque", "gerencia.lj01@exemplo.com"),
  ee("a-centro", "Loja 02 — Centro", "LJ02", "Rua Marechal Deodoro, 210 — Centro", "gerencia.lj02@exemplo.com"),
  ee("a-doca3", "CD — Doca 3", "CD03", "Estrada do Aeroporto, km 3")
];
Eo[0].campos = { "cp-regional": "Capital", "cp-formato": "Supermercado", "cp-gerente": "Júlia Andrade" };
Eo[1].campos = { "cp-regional": "Capital", "cp-formato": "Express", "cp-gerente": "Paulo Neri" };
Eo[2].campos = { "cp-regional": "Capital", "cp-formato": "Centro de distribuição" };
var te = [
  { id: "cp-regional", nome: "Regional", tipo: "lista", opcoes: ["Capital", "Interior"], obrigatorio: !1, na_lista: !0, ordem: 1 },
  { id: "cp-cidade", nome: "Cidade", tipo: "texto", obrigatorio: !0, na_lista: !1, depende_de: { campo_id: "cp-regional", valor: "Interior" }, ordem: 2 },
  { id: "cp-formato", nome: "Formato", tipo: "lista", opcoes: ["Supermercado", "Express", "Atacarejo", "Centro de distribuição"], obrigatorio: !1, na_lista: !0, ordem: 3 },
  { id: "cp-gerente", nome: "Gerente", tipo: "texto", obrigatorio: !1, na_lista: !1, ordem: 4 }
], Pe = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
  { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
  { nome: "Bom", cor: "rank-good", min: 85, max: 100 }
], ae = (o, n, c = {}) => ({
  key: o,
  titulo: n,
  tipo: "escolha_simples",
  obrigatoria: !0,
  opcoes: [
    { key: `${o}-sim`, texto: "Sim", pontos: 10, conforme: !0 },
    { key: `${o}-nao`, texto: "Não", pontos: 0, conforme: !1 },
    { key: `${o}-na`, texto: "Não se aplica", na: !0 }
  ],
  ...c
}), Ie = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: Pe, geo: "off", reincidencia_meses: 3, relatorio: { emails: { avaliado: !0, extras: ["qualidade@exemplo.com"] } } },
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
        ae("q-preco", "Todos os itens da bancada têm preço visível?", { nc_exige: { observacao: !0 } }),
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
        ae("q-porta", "A porta da câmara veda sem frestas?", { plano_acao_modelo_id: "pm-manutencao" }),
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
}, Me = {
  config: { calcular_nota: !0, casas_decimais: 1, classificacoes: Pe },
  topicos: [
    {
      key: "r-doc",
      titulo: "Documentação",
      questoes: [
        { key: "r-nf", titulo: "Número da nota fiscal", tipo: "texto", obrigatoria: !0, texto: { leitura_codigo: !0 } },
        ae("r-lacre", "O lacre do baú chegou intacto?", { nc_exige: { foto: !0 } })
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
}, Oe = [
  { id: "f-flv", org_id: mo.id, nome: "Checklist FLV e perecíveis", rascunho: Ie, versao_publicada_id: "fv-flv-1", avaliados_vinculados: ["a-bosque", "a-centro"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" },
  { id: "f-receb", org_id: mo.id, nome: "Recebimento de refrigerados", rascunho: Me, versao_publicada_id: "fv-receb-1", avaliados_vinculados: ["a-doca3"], arquivado: !1, created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" }
], $e = [
  { id: "fv-flv-1", formulario_id: "f-flv", numero: 1, definicao: Ie, publicado_em: "2026-10-01T12:00:00.000Z", publicado_por: "m-rogerio" },
  { id: "fv-receb-1", formulario_id: "f-receb", numero: 1, definicao: Me, publicado_em: "2026-10-01T12:00:00.000Z", publicado_por: "m-rogerio" }
], Ce = [
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
], ne = [
  {
    id: "pm-retirada",
    org_id: mo.id,
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
    org_id: mo.id,
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
function ie(o) {
  let n = { org_id: mo.id, fuso_horario: mo.fuso_horario, ativo: !0, materializado_ate: null, criado_por: "m-rogerio", created_at: "2026-10-01T12:00:00.000Z", updated_at: "2026-10-01T12:00:00.000Z" };
  return [
    {
      ...n,
      id: "ag-flv-centro",
      formulario_id: "f-flv",
      avaliado_id: "a-centro",
      responsaveis: ["m-ana"],
      data_inicio: o,
      horarios: [],
      dia_inteiro: !0,
      recorrencia: "diaria",
      termino: "nunca"
    },
    {
      ...n,
      id: "ag-receb-doca",
      formulario_id: "f-receb",
      avaliado_id: "a-doca3",
      responsaveis: ["m-rogerio"],
      data_inicio: o,
      horarios: ["07:30"],
      dia_inteiro: !1,
      recorrencia: "semanal",
      dias_semana: [1, 3, 5],
      termino: "nunca"
    }
  ];
}
function ma(o) {
  return () => {
    o = o + 1831565813 | 0;
    let n = Math.imul(o ^ o >>> 15, 1 | o);
    return n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n, ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
function Re(o) {
  let n = ma(20261014), c = [], l = Date.parse(o + "T12:00:00Z") - 7257600000, _ = 0;
  for (let m = 0;m < 12; m++) {
    let p = m / 11;
    for (let [g, b, y] of [["a-bosque", 0.15 + 0.35 * p, [1, 4]], ["a-centro", 0.45 - 0.35 * p, [2, 5]], ["a-doca3", 0.25, [1, 3]]])
      for (let f of y) {
        let v = l + (m * 7 + f) * 86400000 + Math.floor(n() * 6) * 3600000;
        if (v >= Date.parse(o + "T00:00:00Z"))
          continue;
        let h = (Q) => n() < Q, I = `demo-${String(++_).padStart(3, "0")}`;
        if (g === "a-doca3") {
          let Q = Math.round((3 + n() * (h(b) ? 7 : 3.5)) * 10) / 10, to = !h(b / 2);
          c.push({
            client_uuid: I,
            formulario_id: "f-receb",
            formulario_versao_id: "fv-receb-1",
            avaliado_id: g,
            responsavel_id: "m-rogerio",
            iniciada_em: new Date(v).toISOString(),
            finalizada_em: new Date(v + 900000).toISOString(),
            respostas: {
              "r-nf": { texto: String(1e5 + Math.floor(n() * 899999)) },
              "r-lacre": to ? { opcoes: ["r-lacre-sim"] } : { opcoes: ["r-lacre-nao"], fotos: 1 },
              "r-bruto": { numero: 12 + Math.round(n() * 30) / 10 },
              "r-tara": { numero: 0.6 },
              "r-temp": Q > 7 ? { numero: Q, observacao: "Acima do limite na chegada." } : { numero: Q }
            }
          });
          continue;
        }
        let M = Math.round((1 + n() * (h(b) ? 7 : 3)) * 10) / 10, P = h(b), V = h(b * 0.8), eo = h(b * 0.6), co = h(b * 0.7);
        c.push({
          client_uuid: I,
          formulario_id: "f-flv",
          formulario_versao_id: "fv-flv-1",
          avaliado_id: g,
          responsavel_id: h(0.5) ? "m-ana" : "m-carlos",
          iniciada_em: new Date(v).toISOString(),
          finalizada_em: new Date(v + 1500000).toISOString(),
          respostas: {
            "q-vencidos": P ? { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Lote vencido na bancada." } : { opcoes: ["q-vencidos-sim"] },
            "q-preco": V ? { opcoes: ["q-preco-nao"], observacao: "Itens sem etiqueta." } : { opcoes: ["q-preco-sim"] },
            "q-gondola": { opcoes: co ? ["q-gondola-limpa", "q-gondola-avaria"] : ["q-gondola-limpa", "q-gondola-abastecida"] },
            "q-temp": M > 4 ? { numero: M, fotos: 1, observacao: "Fora da faixa." } : { numero: M, fotos: 1 },
            "q-porta": eo ? { opcoes: ["q-porta-nao"] } : { opcoes: ["q-porta-sim"] },
            ...eo ? { "q-porta-motivo": { texto: "Borracha ressecada." } } : {},
            "q-ass": { assinatura: "demo" }
          }
        });
      }
  }
  return c.sort((m, p) => m.finalizada_em.localeCompare(p.finalizada_em));
}

// app/src/data/nucleo.ts
function io(o, n) {
  return o.is_master || o.acoes.includes(n);
}
function Po(o, n) {
  return io(o, "ver_todas_inspecoes") || n.responsavel_id === o.id || o.ve_inspecoes_de.includes(n.responsavel_id);
}
function Fe(o) {
  return {
    v: 1,
    formularios: structuredClone(Oe),
    versoes: structuredClone($e),
    avaliados: structuredClone(Eo),
    inspecoes: [],
    eventos: [],
    eventoSeq: 0,
    planosModelo: structuredClone(ne),
    planos: [],
    emails: [],
    membros: structuredClone(No),
    funcoes: structuredClone(Ao),
    equipes: structuredClone(Lo),
    agendamentos: ie(new Intl.DateTimeFormat("en-CA", { timeZone: o.fuso_horario }).format(/* @__PURE__ */ new Date)),
    ocorrencias: [],
    aprovacoes: [],
    camposAvaliado: structuredClone(te)
  };
}
function Io(o) {
  let n = o.org, c = "srv:state", l = "inspeta:sessao", _ = "inspeta:membros", m = () => crypto.randomUUID(), p = () => (/* @__PURE__ */ new Date()).toISOString(), g = (t) => structuredClone(t);
  async function b() {
    let t = await o.carregar();
    if (t) {
      if (t.planosModelo ??= g(ne), t.planos ??= [], t.emails ??= [], t.membros ??= g(No), t.funcoes ??= g(Ao), t.equipes ??= g(Lo), t.agendamentos ??= ie(H()), t.ocorrencias ??= [], t.aprovacoes ??= [], t.camposAvaliado ??= g(te), o.local.get("inspeta:membros") === null)
        f(t);
      return t;
    }
    let e = o.estadoInicial();
    if (e.inspecoes.length === 0 && e.formularios.some((a) => a.id === "f-flv"))
      for (let a of Ce) {
        let i = M(e, a.responsavel_id);
        to(e, i, { ...a, status: "completa", anexos: [], device_id: "seed" }, a.finalizada_em);
      }
    return await o.gravar(e), e;
  }
  async function y(t, e) {
    if (await o.gravar(t), e === "membros")
      f(t), o.aviso("sessao");
    o.aviso(e);
  }
  function f(t) {
    o.local.set("inspeta:membros", JSON.stringify(wo(t.membros, t.funcoes, t.equipes)));
  }
  let v = null, h = [];
  function I() {
    let t = o.local.get("inspeta:membros") ?? "seed";
    if (t !== v)
      h = t === "seed" ? wo(No, Ao, Lo) : JSON.parse(t), v = t;
    return h;
  }
  function M(t, e) {
    let a = wo(t.membros, t.funcoes, t.equipes).find((i) => i.id === e);
    if (!a || !a.ativo)
      throw Error("Sessão inválida");
    return a;
  }
  function P(t, e) {
    return o.exclusivo(async () => {
      let a = await b(), i = e(a);
      return await y(a, t), i;
    });
  }
  function V(t, e, a, i, s = {}, r = p()) {
    t.eventos.push({ id: ++t.eventoSeq, inspecao_id: e, membro_id: a, acao: i, dados: s, em: r });
  }
  function eo(t, e, a, i) {
    let r = t.formularios.find((D) => D.id === e)?.rascunho.config.reincidencia_meses ?? 3, u = Date.now() - r * 31 * 86400000, d = t.inspecoes.filter((D) => D.formulario_id === e && D.avaliado_id === a && D.status !== "rascunho" && D.client_uuid !== i && D.finalizada_em && Date.parse(D.finalizada_em) >= u).sort((D, x) => (x.finalizada_em ?? "").localeCompare(D.finalizada_em ?? ""))[0];
    if (!d)
      return {};
    let w = {};
    for (let [D, x] of Object.entries(d.resultado.questoes))
      w[D] = { conforme: x.conforme, resposta: d.respostas[D] };
    return w;
  }
  function co(t) {
    return t.topicos.flatMap((e) => e.questoes).filter((e) => e.preenchimento_automatico || e.preenchimento_unico);
  }
  function Q(t, e, a, i, s) {
    let r = co(e);
    if (!r.length)
      return {};
    let u = {}, d = t.inspecoes.filter((w) => w.formulario_id === a && w.avaliado_id === i && w.status !== "rascunho" && w.client_uuid !== s).sort((w, D) => (D.finalizada_em ?? "").localeCompare(w.finalizada_em ?? ""));
    for (let w of r) {
      let D = d.find((x) => {
        let A = x.respostas[w.key];
        return A && (A.opcoes?.length || A.numero != null || A.texto || A.data || A.na);
      })?.respostas[w.key];
      if (D)
        u[w.key] = { opcoes: D.opcoes, numero: D.numero, texto: D.texto, data: D.data, na: D.na };
    }
    return u;
  }
  function to(t, e, a, i = p()) {
    let s = t.versoes.find((z) => z.id === a.formulario_versao_id && z.formulario_id === a.formulario_id);
    if (!s)
      return { client_uuid: a.client_uuid, ok: !1, erro: "invalido", mensagem: "Versão do formulário não encontrada." };
    if (!io(e, "aplicar") || !po(e, a.formulario_id) || !K(e, a.avaliado_id))
      return { client_uuid: a.client_uuid, ok: !1, erro: "sem_permissao", mensagem: "Você não tem permissão para este formulário." };
    let r = t.inspecoes.find((z) => z.client_uuid === a.client_uuid);
    if (r) {
      if (r.responsavel_id !== e.id)
        return { client_uuid: a.client_uuid, ok: !1, erro: "conflito", mensagem: "Inspeção pertence a outra pessoa." };
      if (r.status !== "rascunho")
        return { client_uuid: a.client_uuid, ok: !0, id: r.id, nota_pct: r.nota_pct, classificacao: r.classificacao };
    }
    let u = Q(t, s.definicao, a.formulario_id, a.avaliado_id, a.client_uuid);
    for (let z of co(s.definicao))
      if (z.preenchimento_unico && u[z.key])
        a = { ...a, respostas: { ...a.respostas, [z.key]: { ...a.respostas[z.key], ...u[z.key] } } };
    let d = eo(t, a.formulario_id, a.avaliado_id, a.client_uuid), w = zo(s.definicao, a.respostas, d);
    if (a.status === "completa" && w.pendentes.length)
      return { client_uuid: a.client_uuid, ok: !1, erro: "invalido", mensagem: `${w.pendentes.length} questão(ões) com pendência.` };
    let D = {
      nao_conformidades: w.nao_conformidades,
      questoes: Object.fromEntries(Object.values(w.questoes).filter((z) => z.visivel).map((z) => [z.key, {
        conforme: z.conforme,
        pontos: z.pontos,
        pontos_max: z.pontos_max,
        reincidente: z.reincidente,
        valor_calculado: z.valor_calculado
      }])),
      topicos: Object.fromEntries(Object.values(w.topicos).map((z) => [z.key, { pct: z.pct, desconto_pct: z.desconto_pct }]))
    }, x = {
      org_id: n.id,
      client_uuid: a.client_uuid,
      formulario_id: a.formulario_id,
      formulario_versao_id: a.formulario_versao_id,
      avaliado_id: a.avaliado_id,
      responsavel_id: e.id,
      status: a.status,
      iniciada_em: a.iniciada_em,
      finalizada_em: a.finalizada_em,
      geo_inicio: a.geo_inicio ?? null,
      geo_fim: a.geo_fim ?? null,
      respostas: a.respostas,
      anexos: a.anexos,
      nota_pct: w.nota_pct,
      pontos: w.pontos,
      pontos_max: w.pontos_max,
      classificacao: w.classificacao?.nome ?? null,
      classificacao_cor: w.classificacao?.cor ?? null,
      qtd_nao_conformidades: w.nao_conformidades.length,
      resultado: D,
      device_id: a.device_id,
      sincronizada_em: i,
      ocorrencia_id: a.status === "completa" ? R(t, e, a, r?.id) : null
    }, A = s.definicao.config.aprovacao?.etapas ?? [], T = a.status === "completa" && A.length ? "em_aprovacao" : a.status;
    Object.assign(x, { status: T, aprovacao_etapa: T === "em_aprovacao" ? 1 : null });
    let C;
    if (r)
      Object.assign(r, x, { updated_at: i }), C = r.id;
    else
      C = m(), t.inspecoes.push({ id: C, ...x, created_at: i, updated_at: i }), V(t, C, e.id, "criada", { device_id: a.device_id }, a.iniciada_em);
    V(t, C, e.id, "sincronizada", { device_id: a.device_id }, i);
    let oo = x.ocorrencia_id ? t.ocorrencias.find((z) => z.id === x.ocorrencia_id) : void 0;
    if (oo)
      oo.inspecao_id = C;
    if (a.status === "completa")
      V(t, C, e.id, "finalizada", { nota_pct: w.nota_pct, ncs: w.nao_conformidades.length }, a.finalizada_em ?? i);
    if (T === "em_aprovacao")
      V(t, C, null, "enviada_aprovacao", { etapa: 1, de: A.length }, i), B(t, C);
    return { client_uuid: a.client_uuid, ok: !0, id: C, nota_pct: w.nota_pct, classificacao: w.classificacao?.nome ?? null };
  }
  function po(t, e) {
    return io(t, "gerenciar_formularios") || t.formularios_permitidos === "todos" || t.formularios_permitidos.includes(e);
  }
  function K(t, e) {
    return t.avaliados_permitidos === "todos" || t.avaliados_permitidos.includes(e);
  }
  function j(t, e) {
    let a = I().find((i) => i.id === t.id) ?? t;
    if (!a.ativo || !io(a, e))
      throw Error("Você não tem permissão para isso.");
  }
  function X() {
    o.exigirRede();
  }
  let lo = {
    async entrar(t, e) {
      await o.atraso();
      let a = await b(), i = wo(a.membros, a.funcoes, a.equipes).find((s) => s.email.toLowerCase() === t.trim().toLowerCase());
      if (!i || e.length < 4)
        throw Error("E-mail ou senha incorretos.");
      if (!i.ativo)
        throw Error("Este acesso foi desativado. Fale com o administrador da conta.");
      return o.local.set("inspeta:sessao", i.id), o.aviso("sessao"), i;
    },
    sessao() {
      let t = o.local.get("inspeta:sessao"), e = t ? I().find((a) => a.id === t) : void 0;
      return e && e.ativo ? e : null;
    },
    sair() {
      o.local.del("inspeta:sessao"), o.aviso("sessao");
    },
    org() {
      return n;
    },
    async recuperarSenha(t) {
      await o.atraso();
    },
    async definirSenha(t) {
      throw Error("Na demonstração qualquer senha com 4+ caracteres funciona.");
    },
    capturarRetornoAuth() {
      return null;
    },
    membros() {
      return I();
    },
    async listarFormularios() {
      await o.atraso();
      let t = await b();
      return t.formularios.filter((e) => !e.arquivado).map((e) => {
        let a = t.versoes.find((i) => i.id === e.versao_publicada_id) ?? null;
        return {
          ...e,
          versao_numero: a?.numero ?? null,
          tem_alteracoes: !a || JSON.stringify(a.definicao) !== JSON.stringify(e.rascunho),
          qtd_questoes: e.rascunho.topicos.reduce((i, s) => i + s.questoes.length, 0),
          qtd_inspecoes: t.inspecoes.filter((i) => i.formulario_id === e.id && i.status !== "rascunho").length
        };
      }).sort((e, a) => a.updated_at.localeCompare(e.updated_at));
    },
    async obterFormulario(t) {
      let e = (await b()).formularios.find((a) => a.id === t);
      if (!e)
        throw Error("Formulário não encontrado.");
      return g(e);
    },
    async criarFormulario(t, e) {
      if (await o.atraso(), !t.trim())
        throw Error("Dê um nome ao formulário.");
      let a = e ? g(e) : {
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
      return P("formularios", (i) => {
        let s = { id: m(), org_id: n.id, nome: t.trim(), rascunho: a, versao_publicada_id: null, avaliados_vinculados: [], arquivado: !1, created_at: p(), updated_at: p() };
        return i.formularios.push(s), g(s);
      });
    },
    salvarRascunho(t, e, a) {
      return P("formularios", (i) => {
        let s = i.formularios.find((r) => r.id === t);
        if (!s)
          throw Error("Formulário não encontrado.");
        if (a && s.updated_at !== a)
          throw Error("Este formulário foi alterado em outra aba. Recarregue para não perder mudanças.");
        if (e.nome !== void 0)
          s.nome = e.nome;
        if (e.rascunho)
          s.rascunho = e.rascunho;
        if (e.avaliados_vinculados)
          s.avaliados_vinculados = e.avaliados_vinculados;
        return s.updated_at = p(), g(s);
      });
    },
    async publicar(t, e) {
      return await o.atraso(), P("formularios", (a) => {
        let i = a.formularios.find((d) => d.id === t);
        if (!i)
          throw Error("Formulário não encontrado.");
        let s = Ko(i.rascunho);
        if (s.length)
          return { ok: !1, problemas: s };
        let r = Math.max(0, ...a.versoes.filter((d) => d.formulario_id === t).map((d) => d.numero)) + 1, u = { id: m(), formulario_id: t, numero: r, definicao: g(i.rascunho), publicado_em: p(), publicado_por: e };
        return a.versoes.push(u), i.versao_publicada_id = u.id, i.updated_at = p(), { ok: !0, versao: g(u) };
      });
    },
    async obterVersao(t) {
      let e = (await b()).versoes.find((a) => a.id === t);
      if (!e)
        throw Error("Versão não encontrada.");
      return g(e);
    },
    async listarAvaliados() {
      return await o.atraso(), g((await b()).avaliados).sort((t, e) => t.nome.localeCompare(e.nome, "pt-BR"));
    },
    criarAvaliado(t) {
      return lo.salvarAvaliado(null, t);
    },
    salvarAvaliado(t, e) {
      if (e.nome !== void 0 && !e.nome.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (t === null && !e.nome?.trim())
        return Promise.reject(Error("O nome do avaliado é obrigatório."));
      if (e.email && !/^\S+@\S+\.\S+$/.test(e.email))
        return Promise.reject(Error("E-mail inválido."));
      return P("avaliados", (a) => {
        let i = t ? a.avaliados.find((u) => u.id === t) : void 0;
        if (t && !i)
          throw Error("Avaliado não encontrado.");
        if (e.codigo_externo && a.avaliados.some((u) => u.codigo_externo === e.codigo_externo && u.id !== t))
          throw Error(`Já existe um avaliado com o código ${e.codigo_externo}.`);
        let s = oe(a.camposAvaliado, e.campos ?? i?.campos ?? {});
        if (s.erros.length)
          throw Error(s.erros.join(". ") + ".");
        if (i)
          return Object.assign(i, g(e), { nome: (e.nome ?? i.nome).trim(), campos: s.valores, updated_at: p() }), g(i);
        let r = { ...g(e), id: m(), org_id: n.id, nome: e.nome.trim(), campos: s.valores, ativo: !0, created_at: p(), updated_at: p() };
        return a.avaliados.push(r), g(r);
      });
    },
    async listarCamposAvaliado() {
      return g((await b()).camposAvaliado).sort((t, e) => t.ordem - e.ordem);
    },
    salvarCamposAvaliado(t, e) {
      j(t, "gerenciar_avaliados");
      let a = Ee(e);
      if (a.length)
        return Promise.reject(Error(a.join(" ")));
      return P("avaliados", (i) => {
        let s = new Set(e.map((r) => r.id));
        i.camposAvaliado = e.map((r, u) => ({
          ...g(r),
          nome: r.nome.trim(),
          ordem: u + 1,
          opcoes: r.tipo === "lista" ? (r.opcoes ?? []).map((d) => d.trim()).filter(Boolean) : void 0
        }));
        for (let r of i.avaliados)
          if (r.campos) {
            for (let u of Object.keys(r.campos))
              if (!s.has(u))
                delete r.campos[u];
          }
        return g(i.camposAvaliado);
      });
    },
    async listarInspecoes(t, e = {}) {
      await o.atraso();
      let a = await b(), i = (e.busca ?? "").trim().toLowerCase(), s = new Map(a.avaliados.map((d) => [d.id, d.nome])), r = new Map(a.formularios.map((d) => [d.id, d.nome])), u = new Map(I().map((d) => [d.id, d.nome]));
      return g(a.inspecoes.filter((d) => {
        if (!Po(t, d) && !N(a, t, d))
          return !1;
        if (e.status && d.status !== e.status)
          return !1;
        let w = (d.finalizada_em ?? d.iniciada_em).slice(0, 10);
        if (e.de && w < e.de)
          return !1;
        if (e.ate && w > e.ate)
          return !1;
        if (i) {
          if (![s.get(d.avaliado_id), r.get(d.formulario_id), u.get(d.responsavel_id), d.id.slice(0, 8)].join(" ").toLowerCase().includes(i))
            return !1;
        }
        return !0;
      }).sort((d, w) => (w.finalizada_em ?? w.iniciada_em).localeCompare(d.finalizada_em ?? d.iniciada_em)));
    },
    async obterInspecao(t, e) {
      let a = await b(), i = a.inspecoes.find((s) => s.id === e);
      if (!i || !Po(t, i) && !N(a, t, i))
        throw Error("Inspeção não encontrada.");
      return g(i);
    },
    async eventos(t) {
      return g((await b()).eventos.filter((e) => e.inspecao_id === t));
    },
    async anexo(t) {
      return o.anexo(t);
    },
    async salvarLogo(t) {
      if (!/^data:image\/(png|jpeg);base64,/.test(t))
        throw Error("Use uma imagem PNG ou JPG.");
      if (t.length > 409600)
        throw Error("Logo acima de 300 KB mesmo depois de reduzido.");
      let e = "logo-" + m();
      return await o.guardarAnexo(e, t), e;
    },
    async layoutRelatorio(t) {
      let e = await b(), a = e.formularios.find((r) => r.id === t), s = e.versoes.find((r) => r.id === a?.versao_publicada_id)?.definicao.config.relatorio?.layout ?? {};
      return { layout: s, logo: s.logo_id ? await o.anexo(s.logo_id) ?? null : null };
    },
    registrarRelatorio(t, e) {
      return P("inspecoes", (a) => V(a, t, e, "relatorio_enviado", { formato: "pdf" }));
    },
    async pacote(t) {
      X(), await o.atraso(), await L();
      let e = await b(), a = M(e, t), i = e.formularios.filter((x) => !x.arquivado && x.versao_publicada_id && po(a, x.id)).map((x) => ({
        formulario_id: x.id,
        nome: x.nome,
        versao: g(e.versoes.find((A) => A.id === x.versao_publicada_id)),
        avaliados: x.avaliados_vinculados.length ? x.avaliados_vinculados : "todos"
      })), s = {};
      for (let x of i)
        for (let A of e.avaliados) {
          let T = eo(e, x.formulario_id, A.id);
          if (Object.keys(T).length)
            s[`${x.formulario_id}|${A.id}`] = T;
        }
      let r = g(e.avaliados.filter((x) => x.ativo && K(a, x.id))), u = H(), d = new Date(Date.parse(_o(u, -7) + "T00:00:00Z")).toISOString(), w = e.ocorrencias.filter((x) => x.status === "pendente" && x.previsto_em >= d).flatMap((x) => {
        let A = e.agendamentos.find((T) => T.id === x.agendamento_id);
        if (!A || !A.responsaveis.includes(a.id) || !i.some((T) => T.formulario_id === A.formulario_id) || !r.some((T) => T.id === A.avaliado_id))
          return [];
        return [{ id: x.id, formulario_id: A.formulario_id, avaliado_id: A.avaliado_id, previsto_em: x.previsto_em, dia_inteiro: A.dia_inteiro, limite: jo(x.previsto_em, A), descricao: Xo(A) }];
      }).sort((x, A) => x.previsto_em.localeCompare(A.previsto_em)), D = {};
      for (let x of i)
        for (let A of r) {
          let T = Q(e, x.versao.definicao, x.formulario_id, A.id);
          if (Object.keys(T).length)
            D[`${x.formulario_id}|${A.id}`] = T;
        }
      return { cursor: p(), membro: a, org: n, formularios: i, avaliados: r, anteriores: s, ultimas: D, agenda: w };
    },
    async enviarAnexo(t, e, a) {
      if (X(), M(await b(), t), await o.atraso(), a.length > 21548236.8)
        throw Error("Arquivo acima de 15 MB.");
      await o.guardarAnexo(e, a);
    },
    async enviarInspecoes(t, e) {
      X();
      let a = M(await b(), t);
      if (await o.atraso(), e.length > 20)
        throw Error("Lote acima de 20 inspeções.");
      let i = await o.anexosPresentes(e.flatMap((r) => r.anexos.map((u) => u.client_uuid))), s = await P("inspecoes", (r) => e.map((u) => {
        if (u.anexos.find((w) => !i.has(w.client_uuid)))
          return { client_uuid: u.client_uuid, ok: !1, erro: "anexo_faltando", mensagem: "Foto ainda não enviada." };
        return to(r, a, u);
      }));
      for (let r of s) {
        let u = e.find((d) => d.client_uuid === r.client_uuid);
        if (r.ok && u?.status === "completa")
          await G(r.id);
      }
      return s;
    },
    async listarPlanosModelo() {
      return await o.atraso(), g((await b()).planosModelo).sort((t, e) => t.nome.localeCompare(e.nome, "pt-BR"));
    },
    async obterPlanoModelo(t) {
      let e = (await b()).planosModelo.find((a) => a.id === t);
      if (!e)
        throw Error("Modelo de plano não encontrado.");
      return g(e);
    },
    criarPlanoModelo(t) {
      if (!t.trim())
        return Promise.reject(Error("Dê um nome ao modelo."));
      return P("planos", (e) => {
        if (e.planosModelo.some((i) => i.nome.toLowerCase() === t.trim().toLowerCase()))
          throw Error("Já existe um modelo com esse nome.");
        let a = {
          id: m(),
          org_id: n.id,
          nome: t.trim(),
          agrupamento: "por_inspecao",
          prazo_dias: 3,
          destinatario: "avaliado",
          definicao: { config: { calcular_nota: !1 }, topicos: [{ key: m(), titulo: "Correção", questoes: [
            { key: m(), titulo: "O que foi feito para corrigir?", tipo: "texto", obrigatoria: !0 }
          ] }] },
          created_at: p(),
          updated_at: p()
        };
        return e.planosModelo.push(a), g(a);
      });
    },
    salvarPlanoModelo(t) {
      return P("planos", (e) => {
        let a = e.planosModelo.findIndex((i) => i.id === t.id);
        if (a < 0)
          throw Error("Modelo de plano não encontrado.");
        if (!t.nome.trim())
          throw Error("Dê um nome ao modelo.");
        if (t.destinatario === "fixo" && !/^\S+@\S+\.\S+$/.test(t.email_fixo ?? ""))
          throw Error("Informe um e-mail válido para o destinatário fixo.");
        return e.planosModelo[a] = { ...g(t), updated_at: p() }, g(e.planosModelo[a]);
      });
    },
    async listarPlanos(t, e = {}) {
      await o.atraso();
      let a = await b(), i = H(), s = (e.busca ?? "").trim().toLowerCase();
      return a.planos.filter((r) => {
        if (io(t, "gerenciar_planos"))
          return !0;
        let u = a.inspecoes.find((d) => d.id === r.inspecao_id);
        return !!u && Po(t, u);
      }).map((r) => ({
        ...g(r),
        situacao: ro(r, i),
        avaliado: a.avaliados.find((u) => u.id === r.avaliado_id)?.nome ?? "Avaliado removido",
        formulario: a.formularios.find((u) => u.id === r.formulario_id)?.nome ?? "Formulário removido"
      })).filter((r) => (!e.situacao || r.situacao === e.situacao) && (!s || [r.avaliado, r.modelo_snapshot.nome, r.responsavel_email, r.formulario].join(" ").toLowerCase().includes(s))).sort((r, u) => u.created_at.localeCompare(r.created_at) || r.modelo_snapshot.nome.localeCompare(u.modelo_snapshot.nome, "pt-BR"));
    },
    async planosDaInspecao(t) {
      let e = await b(), a = H();
      return e.planos.filter((i) => i.inspecao_id === t).map((i) => ({ ...g(i), situacao: ro(i, a) }));
    },
    async novoLinkPlano(t, e, a) {
      if (!io(e, "gerenciar_planos"))
        throw Error("Sem permissão.");
      await o.atraso();
      let i = xo(), s = await ho(i), r = uo(i);
      return await P("planos", (u) => {
        let d = u.planos.find((w) => w.id === t);
        if (!d)
          throw Error("Plano não encontrado.");
        if (d.token_hash = s, a) {
          if (!/^\S+@\S+\.\S+$/.test(a))
            throw Error("E-mail inválido.");
          d.responsavel_email = a, d.ultimo_email_em = p(), vo(u, Do(u, d, r, s));
        }
        d.updated_at = p();
      }), { link: r };
    },
    async planoPorToken(t) {
      await o.atraso();
      let e = await ho(t), a = await b(), i = a.planos.find((w) => w.token_hash === e);
      if (!i)
        throw Error("Este link não vale mais. Ele pode ter sido substituído por um mais novo; confira o último e-mail recebido.");
      let s = a.inspecoes.find((w) => w.id === i.inspecao_id), u = a.versoes.find((w) => w.id === s.formulario_versao_id).definicao.topicos.flatMap((w) => w.questoes), d = i.questao_keys.map((w) => {
        let D = u.findIndex((A) => A.key === w), x = D >= 0 ? u[D] : null;
        return { key: w, numero: D + 1, titulo: x?.titulo ?? "Questão", resposta: s.respostas[w], questao: x, reincidente: !!s.resultado.questoes[w]?.reincidente };
      });
      return {
        plano: { ...g(i), situacao: ro(i, H()) },
        org: n,
        avaliado: a.avaliados.find((w) => w.id === i.avaliado_id)?.nome ?? "",
        formulario: a.formularios.find((w) => w.id === i.formulario_id)?.nome ?? "",
        inspecao: { finalizada_em: s.finalizada_em, nota_pct: s.nota_pct, classificacao: s.classificacao, responsavel: a.membros.find((w) => w.id === s.responsavel_id)?.nome ?? "" },
        ncs: d
      };
    },
    async responderPlano(t, e) {
      await o.atraso();
      let a = await ho(t);
      for (let i of e.fotos)
        await o.guardarAnexo(i.client_uuid, i.dataUrl);
      await P("planos", (i) => {
        let s = i.planos.find((r) => r.token_hash === a);
        if (!s)
          throw Error("Este link não vale mais.");
        if (s.status === "finalizado")
          throw Error("Este plano já foi respondido.");
        if (s.status === "em_aprovacao")
          throw Error("A resposta já foi enviada e está em análise.");
        if (!e.nome.trim())
          throw Error("Informe seu nome.");
        for (let r of s.questao_keys) {
          let u = { ...e.respostas[r] ?? {} };
          for (let w of e.fotos.filter((D) => D.nc_key === r)) {
            let D = u[w.questao_key] ??= {};
            D.fotos = (D.fotos ?? 0) + 1;
          }
          if (zo(s.modelo_snapshot.definicao, u).pendentes.length)
            throw Error("Ainda há perguntas obrigatórias sem resposta.");
          s.respostas[r] = u;
        }
        if (s.anexos = e.fotos.map((r) => ({ client_uuid: r.client_uuid, questao_key: r.questao_key, nc_key: r.nc_key, tipo: "foto", mime: "image/jpeg", bytes: r.bytes })), s.respondido_por = e.nome.trim(), s.respondido_em = p(), s.modelo_snapshot.exige_aprovacao)
          s.status = "em_aprovacao";
        else
          s.status = "finalizado", s.finalizado_em = p();
        s.updated_at = p();
      });
    },
    async decidirPlano(t, e, a, i = "") {
      if (j(t, "gerenciar_planos"), a === "reprovada" && i.trim().length < 3)
        throw Error("Diga o que falta na correção.");
      await o.atraso();
      let s = xo(), r = await ho(s);
      return P("planos", (u) => {
        let d = u.planos.find((w) => w.id === e);
        if (!d)
          throw Error("Plano não encontrado.");
        if (d.status !== "em_aprovacao")
          throw Error("Este plano não está esperando aprovação.");
        if (a === "aprovada")
          d.status = "finalizado", d.finalizado_em = p(), d.aprovado_por = t.id;
        else {
          (d.reprovacoes ??= []).push({ em: p(), por: t.id, comentario: i.trim(), respondido_por: d.respondido_por, respostas: g(d.respostas) });
          let w = u.planosModelo.find((D) => D.id === d.modelo_id)?.prazo_dias ?? 3;
          if (Object.assign(d, { status: "aberto", respostas: {}, anexos: [], respondido_por: void 0, respondido_em: null, prazo: Y(H(), w), token_hash: r }), d.responsavel_email) {
            d.ultimo_email_em = p();
            let D = u.avaliados.find((x) => x.id === d.avaliado_id)?.nome ?? "";
            vo(u, {
              idem_key: `plano-devolvido:${d.id}:${r.slice(0, 16)}`,
              para: d.responsavel_email,
              assunto: `Correção devolvida: ${d.modelo_snapshot.nome} — ${D}`,
              texto: `A correção enviada não foi aceita: "${i.trim()}". Responda de novo até ${d.prazo.split("-").reverse().join("/")}.`,
              link: uo(s)
            });
          }
        }
        return d.updated_at = p(), d.status;
      });
    },
    async caixaDeSaida() {
      return await o.atraso(), g((await b()).emails).sort((t, e) => e.criado_em.localeCompare(t.criado_em));
    },
    async importarAvaliados(t, e = {}) {
      await o.atraso();
      let a = (i) => {
        let s = { novos: 0, atualizados: 0, erros: [] }, r = /* @__PURE__ */ new Map;
        return t.forEach((u, d) => {
          let w = d + 2, D = (u.nome ?? "").trim(), x = (u.codigo_externo ?? "").trim() || void 0;
          if (!D) {
            s.erros.push({ linha: w, motivo: "sem nome" });
            return;
          }
          if (u.email && !/^\S+@\S+\.\S+$/.test(u.email.trim())) {
            s.erros.push({ linha: w, motivo: `e-mail inválido: ${u.email}` });
            return;
          }
          if (x) {
            if (r.has(x)) {
              s.erros.push({ linha: w, motivo: `código ${x} repetido (já está na linha ${r.get(x)})` });
              return;
            }
            r.set(x, w);
          }
          let A = x ? i.avaliados.find((oo) => oo.codigo_externo === x) : i.avaliados.find((oo) => !oo.codigo_externo && oo.nome.toLowerCase() === D.toLowerCase()), T = oe(i.camposAvaliado, { ...A?.campos ?? {}, ...u.campos ?? {} });
          if (T.erros.length) {
            s.erros.push({ linha: w, motivo: T.erros.join("; ") });
            return;
          }
          let C = {
            campos: T.valores,
            nome: D,
            codigo_externo: x,
            documento: u.documento?.trim() || void 0,
            email: u.email?.trim() || void 0,
            telefone: u.telefone?.trim() || void 0,
            endereco: u.endereco?.trim() || void 0
          };
          if (A) {
            for (let [oo, z] of Object.entries(C))
              if (z !== void 0)
                A[oo] = z;
            A.updated_at = p(), s.atualizados++;
          } else
            i.avaliados.push({ ...C, id: m(), org_id: n.id, ativo: !0, created_at: p(), updated_at: p() }), s.novos++;
        }), s;
      };
      if (e.simular)
        return a(g(await b()));
      return P("avaliados", a);
    },
    async aprovacoesPendentes(t) {
      await o.atraso();
      let e = await b();
      return e.inspecoes.filter((a) => a.status === "em_aprovacao" && U(e, a).includes(t.id) && a.responsavel_id !== t.id).map((a) => ({
        ...g(a),
        etapas: E(e, a).length,
        avaliado: e.avaliados.find((i) => i.id === a.avaliado_id)?.nome ?? "",
        formulario: e.formularios.find((i) => i.id === a.formulario_id)?.nome ?? "",
        responsavel: e.membros.find((i) => i.id === a.responsavel_id)?.nome ?? ""
      })).sort((a, i) => (a.finalizada_em ?? "").localeCompare(i.finalizada_em ?? ""));
    },
    async decisoesDe(t) {
      await o.atraso();
      let e = await b();
      return e.aprovacoes.filter((a) => a.aprovador_id === t.id).map((a) => {
        let i = e.inspecoes.find((s) => s.id === a.inspecao_id);
        return { ...g(a), status: i?.status ?? "completa", avaliado: e.avaliados.find((s) => s.id === i?.avaliado_id)?.nome ?? "", formulario: e.formularios.find((s) => s.id === i?.formulario_id)?.nome ?? "", nota_pct: i?.nota_pct ?? null };
      }).sort((a, i) => i.em.localeCompare(a.em));
    },
    async aprovacaoDaInspecao(t) {
      let e = await b(), a = e.inspecoes.find((s) => s.id === t);
      if (!a)
        throw Error("Inspeção não encontrada.");
      let i = (s) => e.membros.find((r) => r.id === s)?.nome ?? "—";
      return E(e, a).map((s, r) => ({
        etapa: r + 1,
        aprovadores: s.aprovadores.map((u) => ({ id: u, nome: i(u) })),
        decisao: e.aprovacoes.filter((u) => u.inspecao_id === t && u.etapa === r + 1).map((u) => ({ ...g(u), aprovador: i(u.aprovador_id) }))[0] ?? null,
        atual: a.status === "em_aprovacao" && a.aprovacao_etapa === r + 1
      }));
    },
    decidir(t, e, a, i = "") {
      return j(t, "aprovar"), P("inspecoes", (s) => {
        let r = s.inspecoes.find((w) => w.id === e);
        if (!r)
          throw Error("Inspeção não encontrada.");
        if (r.status !== "em_aprovacao")
          throw Error("Esta inspeção não está esperando aprovação.");
        if (r.responsavel_id === t.id)
          throw Error("Quem aplicou não aprova a própria inspeção.");
        if (!U(s, r).includes(t.id))
          throw Error("Esta etapa não é sua.");
        if (a === "reprovada" && i.trim().length < 3)
          throw Error("Diga o motivo da reprovação.");
        let u = r.aprovacao_etapa ?? 1;
        if (s.aprovacoes.some((w) => w.inspecao_id === r.id && w.etapa === u))
          throw Error("Esta etapa já foi decidida.");
        s.aprovacoes.push({ id: m(), org_id: n.id, inspecao_id: r.id, etapa: u, aprovador_id: t.id, decisao: a, comentario: i.trim() || void 0, em: p() });
        let d = E(s, r).length;
        if (a === "reprovada")
          r.status = "reprovada", r.aprovacao_etapa = null;
        else if (u >= d)
          r.status = "aprovada", r.aprovacao_etapa = null;
        else
          r.aprovacao_etapa = u + 1, B(s, r.id);
        return r.updated_at = p(), V(s, r.id, t.id, a, { etapa: u, de: d, comentario: i.trim() || void 0 }), r.status;
      });
    },
    gerarDadosDemo(t) {
      if (!t.is_master)
        return Promise.reject(Error("Só o dono da conta pode gerar dados de exemplo."));
      return P("inspecoes", (e) => {
        let a = 0;
        for (let i of Re(H())) {
          if (e.inspecoes.some((r) => r.client_uuid === i.client_uuid))
            continue;
          if (to(e, M(e, i.responsavel_id), { ...i, respostas: i.respostas, status: "completa", anexos: [], device_id: "demo" }, i.finalizada_em).ok)
            a++;
        }
        return a;
      });
    },
    async painel(t, e) {
      if (!io(t, "ver_painel"))
        throw Error("Você não tem acesso ao painel.");
      await o.atraso();
      let a = await b(), i = (S) => k(S), s = (Date.parse(e.ate) - Date.parse(e.de)) / 86400000 + 1, r = _o(e.de, -s), u = _o(e.de, -1), d = Object.entries(e.campos ?? {}).filter(([, S]) => S), w = (S) => !d.length || d.every(([F, Z]) => a.avaliados.find((W) => W.id === S)?.campos?.[F] === Z), D = a.inspecoes.filter((S) => S.status !== "rascunho" && S.finalizada_em && Po(t, S) && (!e.formulario_id || S.formulario_id === e.formulario_id) && w(S.avaliado_id)), x = (S, F) => D.filter((Z) => {
        let W = i(Z.finalizada_em);
        return W >= S && W <= F;
      }), A = x(e.de, e.ate), T = x(r, u), C = (S) => {
        let F = S.map((Z) => Z.nota_pct).filter((Z) => Z !== null);
        return F.length ? F.reduce((Z, W) => Z + W, 0) / F.length : null;
      }, oo = (S) => S.length ? S.reduce((F, Z) => F + Z.qtd_nao_conformidades, 0) / S.length : null, z = Date.now(), qo = a.ocorrencias.flatMap((S) => {
        let F = a.agendamentos.find((W) => W.id === S.agendamento_id);
        if (!F || !q(t, F) || e.formulario_id && F.formulario_id !== e.formulario_id)
          return [];
        let Z = i(S.previsto_em);
        return Z >= e.de && Z <= e.ate ? [Wo(S, F, z)] : [];
      }), bo = qo.filter((S) => S === "completa").length, yo = qo.filter((S) => S === "atrasada").length, re = (S) => _o(S, -(((/* @__PURE__ */ new Date(S + "T12:00:00Z")).getUTCDay() + 6) % 7)), se = [];
      for (let S = re(e.de);S <= e.ate; S = _o(S, 7)) {
        let F = A.filter((Z) => re(i(Z.finalizada_em)) === S);
        se.push({ semana: S, nota: C(F), qtd: F.length });
      }
      let Ve = [...new Set(A.map((S) => S.avaliado_id))].map((S) => {
        let F = A.filter((Z) => Z.avaliado_id === S);
        return { id: S, nome: a.avaliados.find((Z) => Z.id === S)?.nome ?? "Avaliado removido", nota: C(F), qtd: F.length, ncs: F.reduce((Z, W) => Z + W.qtd_nao_conformidades, 0) };
      }).sort((S, F) => (S.nota ?? 101) - (F.nota ?? 101) || S.nome.localeCompare(F.nome, "pt-BR")), ce = /* @__PURE__ */ new Map, Vo = /* @__PURE__ */ new Map;
      for (let S of A) {
        let F = a.versoes.find((W) => W.id === S.formulario_versao_id), Z = a.formularios.find((W) => W.id === S.formulario_id)?.nome ?? "";
        for (let W of F?.definicao.topicos.flatMap((Ro) => Ro.questoes) ?? [])
          ce.set(S.formulario_id + "|" + W.key, W.titulo);
        for (let [W, Ro] of Object.entries(S.resultado.questoes)) {
          if (Ro.conforme === null)
            continue;
          let Qo = Vo.get(S.formulario_id + "|" + W) ?? { n: 0, aplicaveis: 0, formulario: Z };
          if (Qo.aplicaveis++, Ro.conforme === !1)
            Qo.n++;
          Vo.set(S.formulario_id + "|" + W, Qo);
        }
      }
      let Qe = [...Vo.entries()].filter(([, S]) => S.n > 0).map(([S, F]) => ({ chave: S, titulo: ce.get(S) ?? "Questão", formulario: F.formulario, n: F.n, pct: F.n / F.aplicaveis * 100 })).sort((S, F) => F.n - S.n || F.pct - S.pct).slice(0, 8);
      return {
        periodo: { de: e.de, ate: e.ate, anterior: { de: r, ate: u } },
        kpis: {
          inspecoes: { atual: A.length, anterior: T.length },
          nota: { atual: C(A), anterior: C(T) },
          ncs_por_inspecao: { atual: oo(A), anterior: oo(T) },
          agenda: { cumpridas: bo, atrasadas: yo, pct: bo + yo ? bo / (bo + yo) * 100 : null },
          planos_em_atraso: a.planos.filter((S) => ro(S, H()) === "em_atraso" && (!e.formulario_id || S.formulario_id === e.formulario_id) && D.some((F) => F.id === S.inspecao_id)).length
        },
        semanas: se,
        porAvaliado: Ve,
        topNcs: Qe,
        formularios: a.formularios.filter((S) => !S.arquivado).map((S) => ({ id: S.id, nome: S.nome })),
        camposFiltro: a.camposAvaliado.filter((S) => S.tipo === "lista").map((S) => ({ id: S.id, nome: S.nome, opcoes: S.opcoes ?? [] }))
      };
    },
    async rodarAgenda() {
      return L();
    },
    async listarOcorrencias(t, e = {}) {
      await L(), await o.atraso();
      let a = await b(), i = Date.now(), s = (e.busca ?? "").trim().toLowerCase(), r = new Map(a.membros.map((u) => [u.id, u.nome]));
      return a.ocorrencias.flatMap((u) => {
        let d = a.agendamentos.find((A) => A.id === u.agendamento_id);
        if (!d || !q(t, d))
          return [];
        let w = k(u.previsto_em, d.fuso_horario);
        if (e.de && w < e.de)
          return [];
        if (e.ate && w > e.ate)
          return [];
        let D = Wo(u, d, i);
        if (e.situacao && D !== e.situacao)
          return [];
        let x = {
          ...g(u),
          situacao: D,
          agendamento: g(d),
          descricao: Xo(d),
          formulario: a.formularios.find((A) => A.id === d.formulario_id)?.nome ?? "Formulário removido",
          avaliado: a.avaliados.find((A) => A.id === d.avaliado_id)?.nome ?? "Avaliado removido",
          responsaveis: d.responsaveis.map((A) => r.get(A) ?? "—")
        };
        if (s && ![x.formulario, x.avaliado, ...x.responsaveis].join(" ").toLowerCase().includes(s))
          return [];
        return [x];
      }).sort((u, d) => u.previsto_em.localeCompare(d.previsto_em) || u.avaliado.localeCompare(d.avaliado, "pt-BR"));
    },
    async obterAgendamento(t) {
      let e = (await b()).agendamentos.find((a) => a.id === t);
      if (!e)
        throw Error("Agendamento não encontrado.");
      return g(e);
    },
    async salvarAgendamento(t, e) {
      return j(t, "gerenciar_agendamentos"), await o.atraso(), await P("agenda", (i) => {
        let s = {
          data_inicio: e.data_inicio,
          horarios: e.dia_inteiro ? [] : [...new Set(e.horarios)].sort(),
          dia_inteiro: e.dia_inteiro,
          fuso_horario: n.fuso_horario,
          recorrencia: e.recorrencia,
          dias_semana: e.recorrencia === "semanal" ? [...new Set(e.dias_semana ?? [])].sort() : void 0,
          termino: e.recorrencia === "nenhuma" ? "nunca" : e.termino,
          termino_data: e.termino === "data" ? e.termino_data : void 0,
          termino_qtd: e.termino === "quantidade" ? e.termino_qtd : void 0
        }, r = De(s), u = i.formularios.find((x) => x.id === e.formulario_id && !x.arquivado);
        if (!u)
          r.push("Escolha um formulário.");
        else if (!u.versao_publicada_id)
          r.push("Este formulário ainda não foi publicado.");
        if (!i.avaliados.some((x) => x.id === e.avaliado_id))
          r.push("Escolha o avaliado.");
        else if (u && u.avaliados_vinculados.length && !u.avaliados_vinculados.includes(e.avaliado_id))
          r.push("Este formulário não vale para o avaliado escolhido.");
        if (!e.responsaveis.length)
          r.push("Escolha quem vai aplicar.");
        let d = wo(i.membros, i.funcoes, i.equipes);
        for (let x of e.responsaveis) {
          let A = d.find((T) => T.id === x);
          if (!A || !A.ativo)
            r.push("Uma das pessoas escolhidas não está mais ativa.");
          else if (!io(A, "aplicar") || !po(A, e.formulario_id) || !K(A, e.avaliado_id))
            r.push(`${A.nome} não tem acesso a este formulário ou avaliado. Libere em Permissões.`);
        }
        if (r.length)
          throw Error(r.join(" "));
        let w;
        if (e.id) {
          let x = i.agendamentos.find((T) => T.id === e.id);
          if (!x)
            throw Error("Agendamento não encontrado.");
          let A = p();
          if (i.ocorrencias = i.ocorrencias.filter((T) => !(T.agendamento_id === x.id && T.status === "pendente" && T.previsto_em > A)), Object.assign(x, s, { formulario_id: e.formulario_id, avaliado_id: e.avaliado_id, responsaveis: [...e.responsaveis], ativo: !0, updated_at: A }), delete x.dias_semana, s.dias_semana)
            x.dias_semana = s.dias_semana;
          w = x;
        } else
          w = {
            ...s,
            id: m(),
            org_id: n.id,
            formulario_id: e.formulario_id,
            avaliado_id: e.avaliado_id,
            responsaveis: [...e.responsaveis],
            ativo: !0,
            materializado_ate: null,
            criado_por: t.id,
            created_at: p(),
            updated_at: p()
          }, i.agendamentos.push(w);
        let D = O(i, w);
        return { agendamento: g(w), geradas: D };
      });
    },
    inativarOcorrencia(t, e, a, i) {
      return P("agenda", (s) => {
        let r = s.ocorrencias.find((w) => w.id === e);
        if (!r)
          throw Error("Ocorrência não encontrada.");
        let u = s.agendamentos.find((w) => w.id === r.agendamento_id);
        if (!io(t, "gerenciar_agendamentos") && !u.responsaveis.includes(t.id))
          throw Error("Você não tem permissão para isso.");
        if (i.trim().length < 3)
          throw Error("Escreva o motivo.");
        if (r.status !== "pendente")
          throw Error("Só dá para inativar o que ainda está pendente.");
        let d = a === "esta" ? [r] : s.ocorrencias.filter((w) => w.agendamento_id === u.id && w.status === "pendente" && w.previsto_em >= r.previsto_em);
        for (let w of d)
          Object.assign(w, { status: "inativa", justificativa: i.trim(), inativada_por: t.id, updated_at: p() });
        if (a === "seguintes")
          u.ativo = !1, u.updated_at = p();
        return d.length;
      });
    },
    async listarPessoas() {
      return await o.atraso(), g((await b()).membros).sort((t, e) => Number(e.ativo) - Number(t.ativo) || t.nome.localeCompare(e.nome, "pt-BR"));
    },
    convidarPessoa(t, e) {
      j(t, "gerenciar_permissoes");
      let a = e.nome.trim(), i = e.email.trim().toLowerCase();
      if (!a)
        return Promise.reject(Error("Informe o nome."));
      if (!/^\S+@\S+\.\S+$/.test(i))
        return Promise.reject(Error("Informe um e-mail válido."));
      return P("membros", (s) => {
        if (s.membros.some((u) => u.email.toLowerCase() === i))
          throw Error("Já existe uma pessoa com esse e-mail.");
        if (!s.funcoes.some((u) => u.id === e.funcao_id))
          throw Error("Escolha uma função.");
        let r = { id: m(), org_id: n.id, nome: a, email: i, funcao_id: e.funcao_id, is_master: !1, ativo: !0, acesso: g(be), created_at: p() };
        return s.membros.push(r), vo(s, {
          idem_key: `convite:${r.id}`,
          para: i,
          assunto: `Você foi convidado para ${n.nome} no Inspeta`,
          texto: `${t.nome} liberou seu acesso como ${s.funcoes.find((u) => u.id === r.funcao_id)?.nome}. Entre com este e-mail e crie sua senha no primeiro acesso.`,
          link: `${o.urlApp()}#/entrar`
        }), g(r);
      });
    },
    salvarPessoa(t, e, a) {
      return j(t, "gerenciar_permissoes"), P("membros", (i) => {
        let s = i.membros.find((r) => r.id === e);
        if (!s)
          throw Error("Pessoa não encontrada.");
        if (s.is_master && (a.funcao_id !== void 0 && a.funcao_id !== s.funcao_id || a.ativo === !1))
          throw Error("O dono da conta é sempre Administrador e não pode ser desativado.");
        if (a.ativo === !1 && e === t.id)
          throw Error("Você não pode desativar o seu próprio acesso.");
        if (a.funcao_id && !i.funcoes.some((r) => r.id === a.funcao_id))
          throw Error("Função não encontrada.");
        if (a.nome !== void 0 && !a.nome.trim())
          throw Error("Informe o nome.");
        if (a.acesso)
          a = { ...a, acesso: fo(i, a.acesso, e) };
        return Object.assign(s, g(a)), g(s);
      });
    },
    async listarFuncoes() {
      await o.atraso();
      let t = await b();
      return t.funcoes.map((e) => ({ ...g(e), qtd_pessoas: t.membros.filter((a) => a.ativo && a.funcao_id === e.id).length }));
    },
    criarFuncao(t, e, a) {
      return j(t, "gerenciar_permissoes"), P("membros", (i) => {
        let s = e.trim();
        if (!s)
          throw Error("Dê um nome à função.");
        if (i.funcoes.some((d) => d.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        let r = i.funcoes.find((d) => d.id === a), u = { id: m(), nome: s, acoes: r ? [...r.acoes] : ["aplicar"] };
        return i.funcoes.push(u), g(u);
      });
    },
    salvarFuncao(t, e) {
      return j(t, "gerenciar_permissoes"), P("membros", (a) => {
        let i = a.funcoes.find((r) => r.id === e.id);
        if (!i)
          throw Error("Função não encontrada.");
        if (i.sistema)
          throw Error("A função Administrador tem todas as ações e não pode ser alterada.");
        let s = e.nome.trim();
        if (!s)
          throw Error("Dê um nome à função.");
        if (a.funcoes.some((r) => r.id !== e.id && r.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma função com esse nome.");
        return i.nome = s, i.acoes = [...new Set(e.acoes)], g(i);
      });
    },
    excluirFuncao(t, e) {
      return j(t, "gerenciar_permissoes"), P("membros", (a) => {
        let i = a.funcoes.find((r) => r.id === e);
        if (!i)
          return;
        if (i.sistema)
          throw Error("A função Administrador não pode ser excluída.");
        let s = a.membros.filter((r) => r.funcao_id === e).length;
        if (s)
          throw Error(`Há ${s} ${s === 1 ? "pessoa" : "pessoas"} com esta função. Troque a função delas antes de excluir.`);
        a.funcoes = a.funcoes.filter((r) => r.id !== e);
      });
    },
    async listarEquipes() {
      return await o.atraso(), g((await b()).equipes).sort((t, e) => t.nome.localeCompare(e.nome, "pt-BR"));
    },
    criarEquipe(t, e) {
      return j(t, "gerenciar_permissoes"), P("membros", (a) => {
        let i = e.trim();
        if (!i)
          throw Error("Dê um nome à equipe.");
        if (a.equipes.some((r) => r.nome.toLowerCase() === i.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        let s = { id: m(), org_id: n.id, nome: i, membros: [], acesso: g(ye) };
        return a.equipes.push(s), g(s);
      });
    },
    salvarEquipe(t, e) {
      return j(t, "gerenciar_permissoes"), P("membros", (a) => {
        let i = a.equipes.find((r) => r.id === e.id);
        if (!i)
          throw Error("Equipe não encontrada.");
        let s = e.nome.trim();
        if (!s)
          throw Error("Dê um nome à equipe.");
        if (a.equipes.some((r) => r.id !== e.id && r.nome.toLowerCase() === s.toLowerCase()))
          throw Error("Já existe uma equipe com esse nome.");
        return i.nome = s, i.membros = [...new Set(e.membros)].filter((r) => a.membros.some((u) => u.id === r)), i.acesso = fo(a, e.acesso), g(i);
      });
    },
    excluirEquipe(t, e) {
      return j(t, "gerenciar_permissoes"), P("membros", (a) => {
        a.equipes = a.equipes.filter((i) => i.id !== e);
        for (let i of [...a.membros.map((s) => s.acesso), ...a.equipes.map((s) => s.acesso)])
          i.ver_equipes = i.ver_equipes.filter((s) => s !== e);
      });
    },
    async _podeVer(t, e, a) {
      let i = await b(), s = (d) => !!d && (Po(t, d) || N(i, t, d));
      if (e === "inspecao")
        return s(i.inspecoes.find((d) => d.id === a));
      if (a.startsWith("logo-"))
        return !0;
      let r = i.inspecoes.find((d) => d.anexos.some((w) => w.client_uuid === a));
      if (r)
        return s(r);
      let u = i.planos.find((d) => d.anexos.some((w) => w.client_uuid === a));
      if (u)
        return io(t, "gerenciar_planos") || s(i.inspecoes.find((d) => d.id === u.inspecao_id));
      return !1;
    },
    async _membroPorEmail(t) {
      let e = await b();
      return wo(e.membros, e.funcoes, e.equipes).find((a) => a.email.toLowerCase() === t.toLowerCase()) ?? null;
    },
    async _membrosResolvidos() {
      let t = await b();
      return wo(t.membros, t.funcoes, t.equipes);
    },
    async _reset() {
      await o.local.limpar(), o.aviso("reset");
    }
  };
  function fo(t, e, a) {
    let i = new Set(t.formularios.map((d) => d.id)), s = new Set(t.avaliados.map((d) => d.id)), r = new Set(t.membros.map((d) => d.id)), u = new Set(t.equipes.map((d) => d.id));
    return {
      formularios: e.formularios === "todos" ? "todos" : [...new Set(e.formularios)].filter((d) => i.has(d)),
      avaliados: e.avaliados === "todos" ? "todos" : [...new Set(e.avaliados)].filter((d) => s.has(d)),
      ver_membros: [...new Set(e.ver_membros)].filter((d) => r.has(d) && d !== a),
      ver_equipes: [...new Set(e.ver_equipes)].filter((d) => u.has(d))
    };
  }
  function q(t, e) {
    return io(t, "gerenciar_agendamentos") || io(t, "ver_todas_inspecoes") || e.responsaveis.some((a) => a === t.id || t.ve_inspecoes_de.includes(a));
  }
  function k(t, e = n.fuso_horario) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: e }).format(new Date(t));
  }
  function O(t, e, a = Date.now()) {
    if (!e.ativo)
      return 0;
    let i = k(new Date(a).toISOString(), e.fuso_horario), s = _o(i, 14), r = 0;
    for (let u of ke(e, i, s)) {
      if (Date.parse(jo(u, e)) <= a)
        continue;
      if (t.ocorrencias.some((d) => d.agendamento_id === e.id && d.previsto_em === u))
        continue;
      t.ocorrencias.push({ id: m(), org_id: n.id, agendamento_id: e.id, previsto_em: u, status: "pendente", created_at: p(), updated_at: p() }), r++;
    }
    return e.materializado_ate = s, r;
  }
  function L() {
    return o.exclusivo(async () => {
      let t = await b(), e = H(), a = t.agendamentos.filter((s) => s.ativo && s.materializado_ate !== _o(e, 14)), i = 0;
      for (let s of a)
        i += O(t, s);
      if (a.length)
        await y(t, i ? "agenda" : "agenda-silencioso");
      return i;
    });
  }
  function R(t, e, a, i) {
    if (!a.ocorrencia_id)
      return null;
    let s = t.ocorrencias.find((u) => u.id === a.ocorrencia_id), r = s && t.agendamentos.find((u) => u.id === s.agendamento_id);
    if (!s || !r || !r.responsaveis.includes(e.id) || r.formulario_id !== a.formulario_id || r.avaliado_id !== a.avaliado_id)
      return null;
    if (s.status === "completa" && s.inspecao_id && s.inspecao_id === i)
      return s.id;
    if (s.status !== "pendente")
      return null;
    return s.status = "completa", s.updated_at = p(), s.id;
  }
  function E(t, e) {
    return t.versoes.find((a) => a.id === e.formulario_versao_id)?.definicao.config.aprovacao?.etapas ?? [];
  }
  function U(t, e) {
    return e.status === "em_aprovacao" ? E(t, e)[(e.aprovacao_etapa ?? 1) - 1]?.aprovadores ?? [] : [];
  }
  function N(t, e, a) {
    return io(e, "aprovar") && E(t, a).some((i) => i.aprovadores.includes(e.id));
  }
  function B(t, e) {
    let a = t.inspecoes.find((r) => r.id === e), i = t.avaliados.find((r) => r.id === a.avaliado_id)?.nome ?? "", s = t.formularios.find((r) => r.id === a.formulario_id)?.nome ?? "";
    for (let r of U(t, a)) {
      let u = t.membros.find((d) => d.id === r);
      if (!u?.ativo || r === a.responsavel_id)
        continue;
      vo(t, {
        idem_key: `aprovacao:${a.id}:${a.aprovacao_etapa}:${r}`,
        para: u.email,
        assunto: `Aprovação pendente: ${s} — ${i}`,
        texto: `A inspeção em ${i} (nota ${a.nota_pct === null ? "—" : String(a.nota_pct).replace(".", ",") + "%"}) espera a sua decisão na etapa ${a.aprovacao_etapa} de ${E(t, a).length}.`,
        link: `${o.urlApp()}#/web/inspecoes/${a.id}`
      });
    }
  }
  function H() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: n.fuso_horario }).format(/* @__PURE__ */ new Date);
  }
  function Y(t, e) {
    let a = /* @__PURE__ */ new Date(t + "T12:00:00Z");
    return a.setUTCDate(a.getUTCDate() + e), a.toISOString().slice(0, 10);
  }
  function ro(t, e) {
    return t.status === "aberto" && t.prazo < e ? "em_atraso" : t.status;
  }
  function xo() {
    let t = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(t, (e) => e.toString(16).padStart(2, "0")).join("");
  }
  async function ho(t) {
    let e = await crypto.subtle.digest("SHA-256", (/* @__PURE__ */ new TextEncoder()).encode(t));
    return Array.from(new Uint8Array(e), (a) => a.toString(16).padStart(2, "0")).join("");
  }
  function uo(t) {
    return `${o.urlApp()}#/p/${t}`;
  }
  function vo(t, e) {
    if (t.emails.some((a) => a.idem_key === e.idem_key))
      return !1;
    return t.emails.push({ ...e, id: m(), criado_em: p(), status: e.para ? o.enviaEmails ? "pendente" : "enviado" : "sem_destinatario" }), !0;
  }
  function Do(t, e, a, i) {
    let s = t.avaliados.find((u) => u.id === e.avaliado_id)?.nome ?? "", r = e.prazo.split("-").reverse().join("/");
    return {
      idem_key: `plano:${e.id}:${i.slice(0, 16)}`,
      para: e.responsavel_email ?? "",
      assunto: `Plano de ação: ${e.modelo_snapshot.nome} — ${s}`,
      texto: `A inspeção em ${s} encontrou ${e.questao_keys.length} ${e.questao_keys.length === 1 ? "não conformidade" : "não conformidades"} que precisam de correção até ${r}.
Abra o link para registrar o que foi feito. Não precisa de senha.`,
      link: a
    };
  }
  async function G(t) {
    let e = await b(), a = e.inspecoes.find((d) => d.id === t);
    if (!a || a.status === "rascunho")
      return;
    let i = e.versoes.find((d) => d.id === a.formulario_versao_id), s = new Map(i.definicao.topicos.flatMap((d) => d.questoes).map((d) => [d.key, d])), r = [];
    for (let d of a.resultado.nao_conformidades) {
      let w = s.get(d)?.plano_acao_modelo_id, D = w ? e.planosModelo.find((A) => A.id === w) : void 0;
      if (!D)
        continue;
      let x = D.agrupamento === "por_inspecao" ? r.find((A) => A.modelo.id === D.id) : void 0;
      if (x)
        x.keys.push(d);
      else
        r.push({ modelo: D, keys: [d] });
    }
    let u = await Promise.all(r.map(async () => {
      let d = xo();
      return { t: d, h: await ho(d) };
    }));
    await P("planos", (d) => {
      let w = d.avaliados.find((C) => C.id === a.avaliado_id);
      r.forEach((C, oo) => {
        let z = [...C.keys].sort().join(",");
        if (d.planos.some((yo) => yo.inspecao_id === a.id && yo.modelo_id === C.modelo.id && [...yo.questao_keys].sort().join(",") === z))
          return;
        let qo = C.modelo.destinatario === "fixo" ? C.modelo.email_fixo ?? null : w?.email ?? null, bo = {
          id: m(),
          org_id: n.id,
          modelo_id: C.modelo.id,
          modelo_snapshot: { nome: C.modelo.nome, definicao: g(C.modelo.definicao), exige_aprovacao: !!C.modelo.exige_aprovacao },
          inspecao_id: a.id,
          avaliado_id: a.avaliado_id,
          formulario_id: a.formulario_id,
          questao_keys: C.keys,
          responsavel_email: qo,
          token_hash: u[oo].h,
          prazo: Y(H(), C.modelo.prazo_dias),
          status: "aberto",
          respostas: {},
          anexos: [],
          finalizado_em: null,
          ultimo_email_em: qo ? p() : null,
          created_at: p(),
          updated_at: p()
        };
        d.planos.push(bo), vo(d, Do(d, bo, uo(u[oo].t), u[oo].h));
      });
      let D = i.definicao.config.relatorio?.emails, x = /* @__PURE__ */ new Set;
      if (D?.avaliado && w?.email)
        x.add(w.email);
      for (let C of D?.extras ?? [])
        if (C.trim())
          x.add(C.trim());
      let A = d.formularios.find((C) => C.id === a.formulario_id)?.nome ?? "", T = [];
      for (let C of x)
        if (vo(d, {
          idem_key: `relatorio:${a.id}:${C}`,
          para: C,
          assunto: `Relatório: ${A} — ${w?.nome ?? ""} — ${a.nota_pct === null ? "sem nota" : String(a.nota_pct).replace(".", ",") + "%"}`,
          texto: `Segue o relatório da inspeção finalizada em ${new Date(a.finalizada_em ?? a.iniciada_em).toLocaleString("pt-BR", { timeZone: n.fuso_horario })}. ${a.qtd_nao_conformidades} não conformidade(s).`,
          anexo: { tipo: "relatorio_pdf", inspecao_id: a.id }
        }))
          T.push(C);
      if (T.length)
        V(d, a.id, null, "relatorio_enviado", { para: T });
    });
  }
  return lo;
}

// backend/repo.ts
async function Te(o, n) {
  await o`select set_config('inspeta.org_id', ${n}, true)`, await o`set local role inspeta_api`;
}
function Uo(o, n, c) {
  return o.begin(async (l) => (await Te(l, n), c(l)));
}
var pa = [
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
function Bo() {
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
function Mo(o) {
  return {
    async get(n, c) {
      return (await Uo(o, n, async (_) => _`select data_url from anexos where org_id = ${n} and id = ${c}`))[0]?.data_url;
    },
    async set(n, c, l) {
      let _ = Math.round((l.length - l.indexOf(",") - 1) * 3 / 4);
      await Uo(o, n, async (m) => m`insert into anexos (org_id, id, data_url, bytes) values (${n}, ${c}, ${l}, ${_})
        on conflict (org_id, id) do nothing`);
    },
    async presentes(n, c) {
      if (!c.length)
        return /* @__PURE__ */ new Set;
      let l = await Uo(o, n, async (_) => _`select id from anexos where org_id = ${n} and id = any(string_to_array(${c.join(",")}, ','))`);
      return new Set(l.map((_) => _.id));
    }
  };
}
function Oo(o, n, c) {
  let l = null, _ = /* @__PURE__ */ new Map, m = 0, p = (y) => l ? y(l) : Uo(o, n.id, y), g = /* @__PURE__ */ new Map, b = /* @__PURE__ */ new Set;
  return {
    org: n,
    avisos: b,
    enviaEmails: c.enviaEmails,
    async carregar() {
      let [y, f] = await p(async (I) => [
        await I`select colecao, id, dados from registros where org_id = ${n.id} order by seq`,
        await I`select contadores from orgs where id = ${n.id}`
      ]), v = Bo();
      _ = /* @__PURE__ */ new Map;
      for (let I of y) {
        let M = typeof I.dados === "string" ? JSON.parse(I.dados) : I.dados;
        v[I.colecao].push(M), _.set(`${I.colecao}:${I.id}`, JSON.stringify(M));
      }
      let h = f[0]?.contadores;
      return v.eventoSeq = m = Number((typeof h === "string" ? JSON.parse(h) : h)?.eventoSeq ?? 0), v;
    },
    async gravar(y) {
      await p(async (f) => {
        let v = /* @__PURE__ */ new Set;
        for (let h of pa)
          for (let I of y[h]) {
            let M = `${h}:${I.id}`;
            v.add(M);
            let P = JSON.stringify(I);
            if (_.get(M) === P)
              continue;
            await f`insert into registros (org_id, colecao, id, dados) values (${n.id}, ${h}, ${String(I.id)}, ${P}::text::jsonb)
            on conflict (org_id, colecao, id) do update set dados = excluded.dados, atualizado = now()`, _.set(M, P);
          }
        for (let h of [..._.keys()]) {
          if (v.has(h))
            continue;
          let I = h.indexOf(":");
          await f`delete from registros where org_id = ${n.id} and colecao = ${h.slice(0, I)} and id = ${h.slice(I + 1)}`, _.delete(h);
        }
        if (y.eventoSeq !== m)
          await f`update orgs set contadores = jsonb_set(contadores, '{eventoSeq}', ${String(y.eventoSeq)}::text::jsonb) where id = ${n.id}`, m = y.eventoSeq;
      });
    },
    async exclusivo(y) {
      if (l)
        return y();
      return o.begin(async (f) => {
        await Te(f, n.id), await f`select pg_advisory_xact_lock(hashtext(${n.id}))`, l = f;
        try {
          return await y();
        } finally {
          l = null;
        }
      });
    },
    estadoInicial: Bo,
    anexo: (y) => c.anexos.get(n.id, y),
    guardarAnexo: (y, f) => c.anexos.set(n.id, y, f),
    anexosPresentes: (y) => c.anexos.presentes(n.id, y),
    urlApp: () => c.urlApp,
    atraso: async () => {
      return;
    },
    aviso: (y) => {
      b.add(y);
    },
    exigirRede: () => {
      return;
    },
    local: { get: (y) => g.get(y) ?? null, set: (y, f) => {
      g.set(y, f);
    }, del: (y) => {
      g.delete(y);
    }, limpar: async () => {
      g.clear();
    } }
  };
}

// backend/provisionar.ts
async function ze(o, n, c = "") {
  let [l] = await o`insert into orgs (nome, fuso_horario) values (${n.nome}, ${n.fuso_horario ?? "America/Sao_Paulo"}) returning id`, _ = { id: l.id, nome: n.nome, fuso_horario: n.fuso_horario ?? "America/Sao_Paulo" }, m = Oo(o, _, { urlApp: c, anexos: Mo(o) });
  return m.carregar = async () => {
    return;
  }, m.estadoInicial = () => {
    if (n.demo) {
      let g = Fe(_), b = g.membros.find((y) => y.is_master);
      return b.nome = n.dono.nome, b.email = n.dono.email.toLowerCase(), g;
    }
    let p = Bo();
    return p.funcoes = structuredClone(Ao), p.membros = [{
      id: crypto.randomUUID(),
      org_id: _.id,
      nome: n.dono.nome,
      email: n.dono.email.toLowerCase(),
      funcao_id: "fn-admin",
      is_master: !0,
      ativo: !0,
      acesso: { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] },
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }], p;
  }, await Io(m).listarFuncoes(), _;
}

// backend/jobs.ts
function je(o, n) {
  return async (c) => {
    let l = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${o}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: n,
        to: [c.para],
        subject: c.assunto,
        text: c.texto,
        html: c.html,
        attachments: c.anexos?.map((m) => ({ filename: m.nome, content: m.base64 }))
      })
    });
    if (l.ok)
      return { ok: !0 };
    return { ok: !1, erro: (await l.json().catch(() => ({}))).message ?? `HTTP ${l.status}` };
  };
}
var $o = (o) => o.replace(/[&<>"]/g, (n) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[n]);
function fa(o, n) {
  let c = $o(o.texto).replace(/\n/g, "<br>"), l = o.link ? `<p style="margin:24px 0"><a href="${$o(o.link)}" style="background:#27466f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Abrir</a></p><p style="color:#535a50;font-size:12px">Se o botão não abrir, copie este endereço: ${$o(o.link)}</p>` : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#161a14">
<p style="color:#535a50;font-size:12px;text-transform:uppercase;letter-spacing:.06em">${$o(n.nome)}</p>
<h1 style="font-size:18px">${$o(o.assunto)}</h1><p style="line-height:1.5">${c}</p>${l}
<p style="color:#535a50;font-size:12px;margin-top:32px">Enviado pelo Inspeta. Você recebeu porque seu e-mail está cadastrado nesta conta.</p></div>`;
}
var ga = (o) => {
  let n = "";
  for (let c = 0;c < o.length; c += 32768)
    n += String.fromCharCode(...o.subarray(c, c + 32768));
  return btoa(n);
};
async function Ne(o, n) {
  let c = await o`
    select distinct o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
    where r.colecao = 'emails' and r.dados->>'status' = 'pendente'`, l = 0;
  for (let _ of c) {
    let m = Mo(o), p = Oo(o, _, { urlApp: n.urlApp ?? "", anexos: m });
    await p.exclusivo(async () => {
      let g = await p.carregar();
      for (let b of g.emails.filter((y) => y.status === "pendente").slice(0, n.limite ?? 50)) {
        let y = { para: b.para, assunto: b.assunto, texto: b.texto + (b.link ? `

${b.link}` : ""), html: fa(b, _) };
        if (b.anexo?.tipo === "relatorio_pdf") {
          let v = g.inspecoes.find((I) => I.id === b.anexo.inspecao_id), h = v && g.versoes.find((I) => I.id === v.formulario_versao_id);
          if (v && h) {
            let I = {};
            for (let Q of v.anexos) {
              let to = await m.get(_.id, Q.client_uuid);
              if (to)
                I[Q.client_uuid] = to;
            }
            let M = g.formularios.find((Q) => Q.id === v.formulario_id), V = g.versoes.find((Q) => Q.id === M?.versao_publicada_id)?.definicao.config.relatorio?.layout ?? h.definicao.config.relatorio?.layout ?? {}, eo = V.logo_id ? await m.get(_.id, V.logo_id) ?? null : null, co = await pe({
              org: _,
              inspecao: v,
              definicao: { ...h.definicao, config: { ...h.definicao.config, relatorio: { ...h.definicao.config.relatorio, layout: V } } },
              formulario: M?.nome ?? "",
              versao: h.numero,
              avaliado: g.avaliados.find((Q) => Q.id === v.avaliado_id),
              responsavel: { id: v.responsavel_id, nome: g.membros.find((Q) => Q.id === v.responsavel_id)?.nome ?? "" },
              anexos: I,
              notaAnterior: null,
              logo: eo
            });
            y.anexos = [{ nome: `relatorio-${v.id.slice(0, 8)}.pdf`, base64: ga(co) }];
          }
        }
        let f = await n.enviar(y);
        if (b.status = f.ok ? "enviado" : "erro", b.enviado_em = f.ok ? (/* @__PURE__ */ new Date()).toISOString() : null, !f.ok)
          b.erro = f.erro;
        if (f.ok && b.link?.includes("#/p/"))
          b.link = void 0;
        l += f.ok ? 1 : 0;
      }
      await p.gravar(g);
    });
  }
  return l;
}
async function Le(o) {
  let n = await o`select id, nome, fuso_horario from orgs`, c = 0;
  for (let l of n)
    c += await Io(Oo(o, l, { urlApp: "", anexos: Mo(o) })).rodarAgenda();
  return c;
}
async function Ue(o, n, c) {
  let l = (n.dono_email ?? "").trim().toLowerCase();
  if (!n.nome?.trim() || !n.dono_nome?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l))
    return { status: 400, corpo: { erro: "Informe nome, dono_nome e dono_email válidos." } };
  if ((await o`select 1 from registros where colecao = 'membros' and lower(dados->>'email') = ${l} limit 1`).length)
    return { status: 409, corpo: { erro: "Esse e-mail já pertence a uma organização." } };
  let m = await ze(o, { nome: n.nome.trim(), fuso_horario: n.fuso_horario || "America/Sao_Paulo", dono: { nome: n.dono_nome.trim(), email: l }, demo: !!n.demo }, c.urlApp), p = await (c.fetch ?? fetch)(`${c.authUrl}/invite${c.urlApp ? `?redirect_to=${encodeURIComponent(c.urlApp)}` : ""}`, {
    method: "POST",
    headers: { apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: l, data: {} })
  });
  return { status: 200, corpo: { org: m.id, convite: p.ok ? "enviado" : `falhou (${p.status}) — o dono pode usar "Esqueci minha senha" na tela de entrar` } };
}
async function Be(o) {
  await o`delete from interno.limites where criado < now() - interval '1 day'`, await o`delete from interno.tentativas_senha where coalesce(bloqueado_ate, primeira_falha) < now() - interval '1 day'`;
}

// backend/funcao-jobs.ts
var ko = (o) => Deno.env.get(o) ?? "", Co = _a(ko("SUPABASE_DB_URL"), { prepare: !1, max: 2, idle_timeout: 20 }), va = de(Co, 1e4);
Deno.serve(async (o) => {
  let n = await va();
  if (!le(o.headers.get("x-cron-secret") ?? "", n.cron_secret))
    return new Response("proibido", { status: 403 });
  let c = o.method === "POST" ? await o.json().catch(() => ({})) : {};
  if (c?.acao === "provisionar") {
    let p = await Ue(Co, c, { authUrl: `${ko("SUPABASE_URL")}/auth/v1`, serviceKey: ko("SUPABASE_SERVICE_ROLE_KEY"), urlApp: n.app_url });
    return Response.json(p.corpo, { status: p.status });
  }
  let l = ko("RESEND_API_KEY") ? await Ne(Co, { enviar: je(ko("RESEND_API_KEY"), ko("EMAIL_REMETENTE") || "Inspeta <onboarding@resend.dev>"), urlApp: n.app_url }) : 0, _ = (/* @__PURE__ */ new Date()).getUTCMinutes() % 15 === 0, m = _ ? await Le(Co) : 0;
  if (_)
    await Be(Co);
  return Response.json({ emails: l, agenda: m });
});
