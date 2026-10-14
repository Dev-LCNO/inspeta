// Relatório da inspeção em PDF (pdf-lib). Na arquitetura final isto roda no job
// "inspecao-finalizada" no servidor; a função é a mesma, só muda onde executa.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { FormDefinition, LayoutRelatorio, Question } from "@app/form-engine";
import type { Avaliado, Inspecao, Membro, Organizacao } from "./data/types";
import { fmt } from "./ui/format";

// Fontes padrão do PDF usam WinAnsi: troca o que não existe nela.
const safe = (s: string) =>
  s.replace(/[−–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/✓/g, "OK").replace(/✕/g, "X")
    .replace(/[^\x20-\x7E -ÿ—•°]/g, "");

// cores do relatório: derivadas dos tokens (impressão sempre no tema claro)
const C = {
  text: rgb(0.086, 0.102, 0.078), muted: rgb(0.325, 0.353, 0.314), border: rgb(0.84, 0.85, 0.815),
  accent: rgb(0.153, 0.275, 0.435), ok: rgb(0.078, 0.412, 0.231), bad: rgb(0.694, 0.145, 0.102),
  mid: rgb(0.541, 0.353, 0), surface: rgb(0.957, 0.961, 0.949),
};
const corRank = (c: string | null) => (c === "rank-good" ? C.ok : c === "rank-bad" ? C.bad : c === "rank-mid" ? C.mid : C.accent);

export interface DadosRelatorio {
  org: Organizacao; inspecao: Inspecao; definicao: FormDefinition; formulario: string; versao: number;
  avaliado: Avaliado; responsavel: Membro; anexos: Record<string, string>; notaAnterior: number | null;
  /** logo do cabeçalho (data URL PNG/JPG), quando o layout tiver um */
  logo?: string | null;
}

const hexRgb = (h: string | undefined) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h ?? "");
  if (!m) return C.accent;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const bytesDe = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(",")[1]!), (c) => c.charCodeAt(0));

export async function gerarRelatorioPdf(d: DadosRelatorio): Promise<Uint8Array> {
  const L: LayoutRelatorio = d.definicao.config.relatorio?.layout ?? {};
  const cor = hexRgb(L.cor);
  const colunas = L.colunas === 2 ? 2 : 1;
  const modoFotos = L.fotos ?? "questao";
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(`${d.formulario} — ${d.avaliado.nome}`));
  pdf.setAuthor(safe(d.org.nome));
  pdf.setCreator("Inspeta");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 44;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  // imagens embutidas uma vez só (o 2-colunas mede antes de desenhar)
  const imgs = new Map<string, PDFImage>();
  for (const a of d.inspecao.anexos) {
    const data = d.anexos[a.client_uuid];
    if (!data || (modoFotos === "nenhuma" && a.tipo === "foto")) continue;
    try { imgs.set(a.client_uuid, a.mime === "image/png" || data.startsWith("data:image/png") ? await pdf.embedPng(bytesDe(data)) : await pdf.embedJpg(bytesDe(data))); }
    catch { /* anexo corrompido: segue sem ele */ }
  }

  const ensure = (h: number) => { if (y - h < M + 24) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (s: string, x: number, size: number, font: PDFFont = reg, color = C.text) => page.drawText(safe(s), { x, y, size, font, color });
  const wrap = (s: string, size: number, font: PDFFont, maxW: number): string[] => {
    const words = safe(s).split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };

  // cabeçalho
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: cor });
  let logoW = 0;
  if (d.logo) {
    try {
      const img = d.logo.startsWith("data:image/png") ? await pdf.embedPng(bytesDe(d.logo)) : await pdf.embedJpg(bytesDe(d.logo));
      const s = Math.min(40 / img.height, 120 / img.width);
      logoW = img.width * s;
      page.drawImage(img, { x: W - M - logoW, y: H - M - img.height * s + 6, width: logoW, height: img.height * s });
    } catch { /* logo inválido: segue sem */ }
  }
  const largTitulo = W - 2 * M - (logoW ? logoW + 16 : 0);
  text(d.org.nome.toUpperCase(), M, 9, bold, C.muted); y -= 22;
  for (const l of wrap(d.formulario, 18, bold, largTitulo)) { text(l, M, 18, bold, cor); y -= 22; }
  text(`Versão ${d.versao} · Inspeção ${d.inspecao.id.slice(0, 8).toUpperCase()}`, M, 9, reg, C.muted); y -= 24;

  // quadro de identificação
  const meta: [string, string][] = [
    ["Avaliado", d.avaliado.nome], ["Responsável", d.responsavel.nome],
    ["Início", fmt.dataHoraCompleta(d.inspecao.iniciada_em)], ["Fim", fmt.dataHoraCompleta(d.inspecao.finalizada_em)],
  ];
  page.drawRectangle({ x: M, y: y - 44, width: W - 2 * M, height: 52, color: C.surface });
  meta.forEach(([k, v], i) => {
    const x = M + 12 + (i % 2) * ((W - 2 * M) / 2);
    const yy = y - 8 - Math.floor(i / 2) * 22;
    page.drawText(safe(k), { x, y: yy, size: 8, font: reg, color: C.muted });
    page.drawText(safe(v), { x: x + 64, y: yy, size: 9.5, font: bold, color: C.text });
  });
  y -= 70;

  // nota
  if (d.inspecao.nota_pct !== null && L.mostrar_nota !== false) {
    text("NOTA FINAL", M, 8, bold, C.muted); y -= 30;
    text(fmt.pct(d.inspecao.nota_pct), M, 28, bold, corRank(d.inspecao.classificacao_cor));
    const xx = M + bold.widthOfTextAtSize(safe(fmt.pct(d.inspecao.nota_pct)), 28) + 14;
    page.drawText(safe(d.inspecao.classificacao ?? ""), { x: xx, y: y + 8, size: 12, font: bold, color: corRank(d.inspecao.classificacao_cor) });
    const extra = [`${fmt.num(d.inspecao.pontos)} de ${fmt.num(d.inspecao.pontos_max)} pontos`, `${d.inspecao.qtd_nao_conformidades} não conformidade(s)`];
    if (d.notaAnterior !== null && L.mostrar_anterior !== false) extra.push(`anterior: ${fmt.pct(d.notaAnterior)}`);
    page.drawText(safe(extra.join(" · ")), { x: xx, y: y - 6, size: 9, font: reg, color: C.muted });
    y -= 34;
  }

  /** Mede (desenhar=false) ou desenha um bloco de questão em (x, topo) com largura w. Devolve a altura. */
  const galeria: { n: number; titulo: string; ids: string[] }[] = [];
  function bloco(q: Question, n: number, x: number, topo: number, w: number, desenhar: boolean): number {
    const r = d.inspecao.resultado.questoes[q.key]!;
    const a = d.inspecao.respostas[q.key];
    const status = r.conforme === false ? "NÃO CONFORME" + (r.reincidente ? " · REINC." : "") : r.conforme === true ? "CONFORME" : "";
    const stW = status ? bold.widthOfTextAtSize(status, 7.5) + 8 : 0;
    const tLines = wrap(`${n}. ${q.titulo}`, 9.5, bold, w - stW);
    const rLines = wrap(respostaTexto(q, a, r.valor_calculado), 9.5, reg, w - 12);
    const obs = a?.observacao ? wrap("Obs.: " + a.observacao, 9, reg, w - 12) : [];
    let h = 13 * (tLines.length + rLines.length) + 12 * obs.length;
    let yy = topo;
    if (desenhar) {
      for (const l of tLines) { page.drawText(l, { x, y: yy, size: 9.5, font: bold, color: C.text }); yy -= 13; }
      if (status) page.drawText(status, { x: x + w - stW + 8, y: topo, size: 7.5, font: bold, color: r.conforme === false ? C.bad : C.ok });
      for (const l of rLines) { page.drawText(l, { x: x + 12, y: yy, size: 9.5, font: reg, color: C.text }); yy -= 13; }
      for (const l of obs) { page.drawText(l, { x: x + 12, y: yy, size: 9, font: reg, color: C.muted }); yy -= 12; }
    }
    const anexos = d.inspecao.anexos.filter((f) => f.questao_key === q.key && imgs.has(f.client_uuid));
    const naQuestao = anexos.filter((f) => f.tipo === "assinatura" || modoFotos === "questao");
    if (modoFotos === "final" && desenhar) { const ids = anexos.filter((f) => f.tipo === "foto").map((f) => f.client_uuid); if (ids.length) galeria.push({ n, titulo: q.titulo, ids }); }
    if (naQuestao.length) {
      const sz = q.tipo === "assinatura" ? 56 : colunas === 2 ? 64 : 90;
      let fx = x + 12, linhas = 1;
      for (const f of naQuestao) {
        const img = imgs.get(f.client_uuid)!;
        const s = Math.min(sz / img.height, (q.tipo === "assinatura" ? 180 : sz) / img.width);
        const iw = img.width * s, ih = img.height * s;
        if (fx + iw > x + w) { fx = x + 12; linhas++; }
        if (desenhar) page.drawImage(img, { x: fx, y: yy - (linhas - 1) * (sz + 6) - ih - 2, width: iw, height: ih });
        fx += iw + 6;
      }
      h += linhas * (sz + 6) + 4;
    }
    return h + 8;
  }

  // respostas por tópico
  let n = 0;
  const gap = 16, colW = colunas === 2 ? (W - 2 * M - gap) / 2 : W - 2 * M;
  for (const t of d.definicao.topicos) {
    const itens: { q: Question; n: number }[] = [];
    let conformesOcultas = 0;
    for (const q of t.questoes) {
      n++;
      const r = d.inspecao.resultado.questoes[q.key];
      if (!r) continue;
      const temAssinatura = d.inspecao.anexos.some((f) => f.questao_key === q.key && f.tipo === "assinatura");
      if (L.so_excecoes && r.conforme !== false && d.inspecao.respostas[q.key] && !temAssinatura) { conformesOcultas++; continue; }
      itens.push({ q, n });
    }
    if (!itens.length && !conformesOcultas) continue;
    ensure(48);
    y -= 8;
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.6, color: C.border });
    text(t.titulo, M, 12, bold, cor);
    const tp = d.inspecao.resultado.topicos[t.key]?.pct;
    if (tp !== null && tp !== undefined && L.mostrar_nota !== false) page.drawText(safe(fmt.pct(tp)), { x: W - M - bold.widthOfTextAtSize(safe(fmt.pct(tp)), 11), y, size: 11, font: bold, color: C.text });
    y -= 20;
    for (let k = 0; k < itens.length; k += colunas) {
      const linha = itens.slice(k, k + colunas);
      const h = Math.max(...linha.map((it) => bloco(it.q, it.n, M, y, colW, false)));
      ensure(h);
      linha.forEach((it, c) => bloco(it.q, it.n, M + c * (colW + gap), y, colW, true));
      y -= h;
    }
    if (conformesOcultas) { ensure(14); text(`${conformesOcultas} ${conformesOcultas === 1 ? "questão conforme" : "questões conformes"} neste tópico`, M + 12, 9, reg, C.muted); y -= 16; }
  }

  // fotos no fim, numeradas pela questão
  if (galeria.length) {
    ensure(40); y -= 10;
    text("Fotos", M, 12, bold, cor); y -= 18;
    const sz = 150;
    for (const g of galeria) {
      ensure(sz + 30);
      text(`${g.n}. ${g.titulo}`.slice(0, 110), M, 9, bold); y -= 6;
      let x = M;
      for (const id of g.ids) {
        const img = imgs.get(id)!;
        const s = Math.min(sz / img.height, 200 / img.width);
        if (x + img.width * s > W - M) { x = M; y -= sz + 8; ensure(sz + 10); }
        page.drawImage(img, { x, y: y - img.height * s, width: img.width * s, height: img.height * s });
        x += img.width * s + 8;
      }
      y -= sz + 14;
    }
  }

  // resumo de não conformidades
  if (d.inspecao.resultado.nao_conformidades.length && L.resumo_nc !== false) {
    ensure(60);
    y -= 10;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.988, 0.922, 0.914) });
    text(`Não conformidades (${d.inspecao.resultado.nao_conformidades.length})`, M + 8, 11, bold, C.bad);
    y -= 24;
    const idx = new Map<string, { q: Question; n: number }>();
    let k = 0;
    for (const t of d.definicao.topicos) for (const q of t.questoes) idx.set(q.key, { q, n: ++k });
    for (const key of d.inspecao.resultado.nao_conformidades) {
      const e = idx.get(key);
      if (!e) continue;
      const lines = wrap(`• ${e.n}. ${e.q.titulo}${d.inspecao.resultado.questoes[key]?.reincidente ? " (reincidente)" : ""}`, 9.5, reg, W - 2 * M - 16);
      ensure(13 * lines.length + 4);
      for (const l of lines) { text(l, M + 8, 9.5); y -= 13; }
    }
  }

  // rodapé com texto livre e paginação
  const pages = pdf.getPages();
  const livre = L.rodape?.trim() ? safe(L.rodape.trim()).slice(0, 120) : "";
  pages.forEach((p, i) => {
    const t = safe(`Gerado em ${fmt.dataHoraCompleta(new Date().toISOString())} · página ${i + 1} de ${pages.length}`);
    p.drawText(t, { x: W - M - reg.widthOfTextAtSize(t, 8), y: 24, size: 8, font: reg, color: C.muted });
    if (livre) p.drawText(livre, { x: M, y: 24, size: 8, font: reg, color: C.muted });
  });
  return pdf.save();
}

export function respostaTexto(q: Question, a: Inspecao["respostas"][string], calc?: number | null): string {
  if (q.tipo === "calculo") return calc === null || calc === undefined ? "—" : `${fmt.num(calc)}${q.numerica?.unidade ? " " + q.numerica.unidade : ""}`;
  if (!a) return "Sem resposta";
  if (a.na) return "Não se aplica";
  switch (q.tipo) {
    case "escolha_simples":
    case "escolha_multipla":
      return (q.opcoes ?? []).filter((o) => a.opcoes?.includes(o.key)).map((o) => o.texto).join(", ") || "Sem resposta";
    case "numerica":
      return a.numero === null || a.numero === undefined ? "Sem resposta" : `${fmt.num(a.numero)}${q.numerica?.unidade ? " " + q.numerica.unidade : ""}`;
    case "texto":
      return a.texto?.trim() || "Sem resposta";
    case "data_hora":
      return a.data ? fmt.dataHoraCompleta(a.data) : "Sem resposta";
    case "assinatura":
      return a.assinatura ? "Assinado" : "Sem assinatura";
  }
}

export function baixar(bytes: Uint8Array, nome: string, tipo = "application/pdf"): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
