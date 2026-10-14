// Relatório da inspeção em PDF (pdf-lib). Na arquitetura final isto roda no job
// "inspecao-finalizada" no servidor; a função é a mesma, só muda onde executa.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FormDefinition, Question } from "@app/form-engine";
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
}

export async function gerarRelatorioPdf(d: DadosRelatorio): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(`${d.formulario} — ${d.avaliado.nome}`));
  pdf.setAuthor(safe(d.org.nome));
  pdf.setCreator("Inspeta");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 44;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

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
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: C.accent });
  text(d.org.nome.toUpperCase(), M, 9, bold, C.muted); y -= 22;
  for (const l of wrap(d.formulario, 18, bold, W - 2 * M)) { text(l, M, 18, bold); y -= 22; }
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
  if (d.inspecao.nota_pct !== null) {
    text("NOTA FINAL", M, 8, bold, C.muted); y -= 30;
    text(fmt.pct(d.inspecao.nota_pct), M, 28, bold, corRank(d.inspecao.classificacao_cor));
    const xx = M + bold.widthOfTextAtSize(safe(fmt.pct(d.inspecao.nota_pct)), 28) + 14;
    page.drawText(safe(d.inspecao.classificacao ?? ""), { x: xx, y: y + 8, size: 12, font: bold, color: corRank(d.inspecao.classificacao_cor) });
    const extra = [`${fmt.num(d.inspecao.pontos)} de ${fmt.num(d.inspecao.pontos_max)} pontos`, `${d.inspecao.qtd_nao_conformidades} não conformidade(s)`];
    if (d.notaAnterior !== null) extra.push(`anterior: ${fmt.pct(d.notaAnterior)}`);
    page.drawText(safe(extra.join(" · ")), { x: xx, y: y - 6, size: 9, font: reg, color: C.muted });
    y -= 34;
  }

  // respostas por tópico
  let n = 0;
  for (const t of d.definicao.topicos) {
    const visiveis = t.questoes.filter((q) => d.inspecao.resultado.questoes[q.key]);
    n += t.questoes.length - visiveis.length;
    if (!visiveis.length) continue;
    ensure(48);
    y -= 8;
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.6, color: C.border });
    text(t.titulo, M, 12, bold);
    const tp = d.inspecao.resultado.topicos[t.key]?.pct;
    if (tp !== null && tp !== undefined) page.drawText(safe(fmt.pct(tp)), { x: W - M - bold.widthOfTextAtSize(safe(fmt.pct(tp)), 11), y, size: 11, font: bold, color: C.text });
    y -= 20;

    for (const q of t.questoes) {
      n++;
      const r = d.inspecao.resultado.questoes[q.key];
      if (!r) continue;
      const a = d.inspecao.respostas[q.key];
      const resp = respostaTexto(q, a, r.valor_calculado);
      const status = r.conforme === false ? "NÃO CONFORME" : r.conforme === true ? "CONFORME" : "";
      const tLines = wrap(`${n}. ${q.titulo}`, 9.5, bold, W - 2 * M - 110);
      const rLines = wrap(resp, 9.5, reg, W - 2 * M - 20);
      const obs = a?.observacao ? wrap("Obs.: " + a.observacao, 9, reg, W - 2 * M - 20) : [];
      ensure(14 * (tLines.length + rLines.length + obs.length) + 14);
      for (const l of tLines) { text(l, M, 9.5, bold); y -= 13; }
      if (status) page.drawText(status + (r.reincidente ? " · REINCIDENTE" : ""), {
        x: W - M - bold.widthOfTextAtSize(status + (r.reincidente ? " · REINCIDENTE" : ""), 8), y: y + 13 * tLines.length, size: 8, font: bold,
        color: r.conforme === false ? C.bad : C.ok,
      });
      for (const l of rLines) { text(l, M + 12, 9.5, reg, C.text); y -= 13; }
      for (const l of obs) { text(l, M + 12, 9, reg, C.muted); y -= 12; }

      // fotos / assinatura da questão
      const fotos = d.inspecao.anexos.filter((x) => x.questao_key === q.key);
      if (fotos.length) {
        let x = M + 12;
        const sz = q.tipo === "assinatura" ? 60 : 90;
        ensure(sz + 10);
        for (const f of fotos) {
          const data = d.anexos[f.client_uuid];
          if (!data) continue;
          try {
            const bytes = Uint8Array.from(atob(data.split(",")[1]!), (c) => c.charCodeAt(0));
            const img = f.mime === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
            const s = Math.min(sz / img.height, (q.tipo === "assinatura" ? 200 : sz) / img.width);
            const w = img.width * s, h = img.height * s;
            if (x + w > W - M) { x = M + 12; y -= sz + 6; ensure(sz + 10); }
            page.drawImage(img, { x, y: y - h, width: w, height: h });
            x += w + 6;
          } catch { /* anexo corrompido: segue sem ele */ }
        }
        y -= sz + 8;
      }
      y -= 6;
    }
  }

  // resumo de não conformidades
  if (d.inspecao.resultado.nao_conformidades.length) {
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

  // rodapé com paginação
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const t = safe(`Gerado em ${fmt.dataHoraCompleta(new Date().toISOString())} · página ${i + 1} de ${pages.length}`);
    p.drawText(t, { x: M, y: 24, size: 8, font: reg, color: C.muted });
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
