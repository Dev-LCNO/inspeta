// S12 — Detalhe da inspeção
import { useEffect, useState } from "react";
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { baixar, gerarRelatorioPdf, respostaTexto } from "../pdf";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, ErrorState, PageHeader, ScoreHero, SkeletonBlock, StatusBadge, useToast } from "../ui/primitives";

export function InspecaoDetalhe({ me, id }: { me: Membro; id: string }) {
  const toast = useToast();
  const [gerando, setGerando] = useState(false);
  const d = useData(async () => {
    const i = await server.obterInspecao(me, id);
    const [v, avs, fs, ev, todas] = await Promise.all([
      server.obterVersao(i.formulario_versao_id), server.listarAvaliados(), server.listarFormularios(),
      server.eventos(i.id), server.listarInspecoes(me, {}),
    ]);
    const anterior = todas
      .filter((x) => x.formulario_id === i.formulario_id && x.avaliado_id === i.avaliado_id && x.id !== i.id && x.status !== "rascunho"
        && (x.finalizada_em ?? "") < (i.finalizada_em ?? "9"))
      .sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""))[0];
    return {
      i, v, avaliado: avs.find((a) => a.id === i.avaliado_id)!, formulario: fs.find((f) => f.id === i.formulario_id)?.nome ?? "Formulário removido",
      responsavel: server.membros().find((m) => m.id === i.responsavel_id)!, eventos: ev, anterior: anterior?.nota_pct ?? null,
    };
  }, [id], ["inspecoes"]);

  const [fotos, setFotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!d.data) return;
    let vivo = true;
    Promise.all(d.data.i.anexos.map(async (a) => [a.client_uuid, await server.anexo(a.client_uuid)] as const)).then((xs) => {
      if (vivo) setFotos(Object.fromEntries(xs.filter((x): x is readonly [string, string] => !!x[1])));
    });
    return () => { vivo = false; };
  }, [d.data?.i.id]);

  if (d.status === "error") return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <div className="stack"><SkeletonBlock h={60} /><SkeletonBlock h={140} /><SkeletonBlock h={400} /></div>;
  const { i, v, avaliado, formulario, responsavel, eventos, anterior } = d.data;
  const def = v.definicao;
  const classe = def.config.classificacoes?.find((c) => c.nome === i.classificacao) ?? null;

  async function pdf() {
    setGerando(true);
    try {
      const bytes = await gerarRelatorioPdf({ org: server.org(), inspecao: i, definicao: def, formulario, versao: v.numero, avaliado, responsavel, anexos: fotos, notaAnterior: anterior });
      baixar(bytes, `inspecao-${avaliado.nome.replace(/[^\w]+/g, "-").toLowerCase()}-${(i.finalizada_em ?? i.iniciada_em).slice(0, 10)}.pdf`);
      await server.registrarRelatorio(i.id, me.id);
      toast({ tone: "info", text: "Relatório baixado." });
    } catch (e) {
      toast({ tone: "error", text: "Não foi possível gerar o PDF: " + (e as Error).message });
    } finally {
      setGerando(false);
    }
  }
  function log() {
    const linhas = [["quando", "ação", "pessoa", "detalhes"], ...eventos.map((e) => [
      fmt.dataHoraCompleta(e.em), e.acao, server.membros().find((m) => m.id === e.membro_id)?.nome ?? "", JSON.stringify(e.dados),
    ])];
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    baixar(new TextEncoder().encode(csv), `log-inspecao-${i.id.slice(0, 8)}.csv`, "text/csv;charset=utf-8");
  }

  let n = 0;
  return (
    <>
      <PageHeader
        crumbs={[{ to: "/web/inspecoes", label: "Inspeções" }]}
        title={avaliado.nome}
        desc={<>{formulario} · versão {v.numero} · <span className="mono">#{i.id.slice(0, 8).toUpperCase()}</span></>}
        actions={<>
          <Button variant="secondary" icon="download" onClick={log}>Baixar log</Button>
          <Button icon="file" loading={gerando} onClick={pdf} disabled={i.status === "rascunho"}>Baixar PDF</Button>
        </>}
      />
      {i.status === "rascunho" ? <Callout tone="warn">Esta inspeção ainda não foi finalizada no aparelho. A nota pode mudar.</Callout> : null}

      <div className="detail-grid" style={{ marginTop: "var(--space-4)" }}>
        <div className="stack">
          <section className="card" aria-label="Nota">
            <ScoreHero pct={i.nota_pct} classificacao={classe} faixas={def.config.classificacoes ?? []} anterior={anterior} />
            <div className="row" style={{ marginTop: "var(--space-4)" }}>
              <span className="muted num">{fmt.num(i.pontos)} de {fmt.num(i.pontos_max)} pontos</span>
              {i.qtd_nao_conformidades
                ? <Badge tone="nc" icon="alert">{i.qtd_nao_conformidades} não {i.qtd_nao_conformidades === 1 ? "conformidade" : "conformidades"}</Badge>
                : <Badge tone="ok" icon="check">Sem não conformidades</Badge>}
            </div>
          </section>

          {def.topicos.map((t) => {
            const visiveis = t.questoes.filter((q) => i.resultado.questoes[q.key]);
            const tr = i.resultado.topicos[t.key];
            const inicio = n;
            n += t.questoes.length;
            if (!visiveis.length) return null;
            return (
              <section key={t.key} className="card" aria-labelledby={"t-" + t.key}>
                <div className="row-between" style={{ marginBottom: "var(--space-2)" }}>
                  <h2 id={"t-" + t.key} style={{ fontSize: "var(--text-lg)" }}>{t.titulo}</h2>
                  <div className="row">
                    {tr?.desconto_pct ? <Badge tone="warn" icon="alert">Desconto de {fmt.num(tr.desconto_pct)}%</Badge> : null}
                    {tr?.pct !== null && tr?.pct !== undefined ? <span className="num" style={{ fontWeight: 700 }}>{fmt.pct(tr.pct)}</span> : null}
                  </div>
                </div>
                {t.questoes.map((q, k) => {
                  const r = i.resultado.questoes[q.key];
                  if (!r) return null;
                  const a = i.respostas[q.key];
                  const anexos = i.anexos.filter((x) => x.questao_key === q.key);
                  return (
                    <div className="ans" key={q.key}>
                      <span className="qnum">{inicio + k + 1}</span>
                      <div>
                        <div>{q.titulo}</div>
                        <div className="v">{respostaTexto(q, a, r.valor_calculado)}</div>
                        {a?.observacao ? <div className="muted" style={{ marginTop: 4 }}><Icon n="msg" size="sm" /> {a.observacao}</div> : null}
                        {anexos.length ? (
                          <div className="thumbs">
                            {anexos.map((x) => fotos[x.client_uuid]
                              ? <a key={x.client_uuid} href={fotos[x.client_uuid]} target="_blank" rel="noreferrer"><img src={fotos[x.client_uuid]} alt={x.tipo === "assinatura" ? "Assinatura" : `Foto da questão ${inicio + k + 1}`} style={x.tipo === "assinatura" ? { width: 160, objectFit: "contain", background: "var(--c-bg)" } : undefined} /></a>
                              : <span key={x.client_uuid} className="sk" style={{ width: 72, height: 72 }} />)}
                          </div>
                        ) : null}
                      </div>
                      <div className="stack-sm" style={{ alignItems: "flex-end" }}>
                        {r.conforme === false ? <Badge tone="nc" icon="x">Não conforme</Badge> : r.conforme === true ? <Badge tone="ok" icon="check">Conforme</Badge> : a?.na ? <Badge tone="na" icon="minus">N/A</Badge> : null}
                        {r.reincidente ? <Badge tone="nc" icon="repeat">Reincidente</Badge> : null}
                        {r.pontos_max !== null ? <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>{fmt.num(r.pontos)}/{fmt.num(r.pontos_max)} pts</span> : null}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <aside className="stack">
          <section className="card stack-sm" aria-label="Dados da inspeção">
            <div className="row-between"><h2 style={{ fontSize: "var(--text-base)" }}>Dados</h2><StatusBadge status={i.status} /></div>
            <dl className="meta-list">
              <dt>Responsável</dt><dd>{responsavel.nome}</dd>
              <dt>Início</dt><dd className="num">{fmt.dataHoraCompleta(i.iniciada_em)}</dd>
              <dt>Fim</dt><dd className="num">{fmt.dataHoraCompleta(i.finalizada_em)}</dd>
              <dt>Duração</dt><dd className="num">{i.finalizada_em ? `${Math.max(1, Math.round((Date.parse(i.finalizada_em) - Date.parse(i.iniciada_em)) / 60000))} min` : "—"}</dd>
              <dt>Aparelho</dt><dd className="mono">{i.device_id ?? "—"}</dd>
              <dt>Sincronizada</dt><dd className="num">{fmt.dataHoraCompleta(i.sincronizada_em)}</dd>
              {avaliado.endereco ? <><dt>Endereço</dt><dd>{avaliado.endereco}</dd></> : null}
            </dl>
          </section>
          {i.resultado.nao_conformidades.length ? (
            <section className="card stack-sm" aria-label="Planos de ação">
              <h2 style={{ fontSize: "var(--text-base)" }}>Planos de ação</h2>
              <p className="muted" style={{ margin: 0 }}>O disparo automático de planos para as não conformidades chega no marco 2.</p>
            </section>
          ) : null}
          <section className="card stack-sm" aria-label="Histórico">
            <h2 style={{ fontSize: "var(--text-base)" }}>Histórico</h2>
            <ol className="timeline">
              {eventos.map((e) => (
                <li key={e.id}><span className="pt" aria-hidden="true" /><div>
                  <div style={{ fontWeight: 600 }}>{{ criada: "Iniciada", sincronizada: "Sincronizada", finalizada: "Finalizada", editada: "Editada", reaberta: "Reaberta", relatorio_enviado: "Relatório gerado", excluida: "Excluída" }[e.acao]}</div>
                  <div className="muted num" style={{ fontSize: "var(--text-xs)" }}>{fmt.dataHoraCompleta(e.em)} · {server.membros().find((m) => m.id === e.membro_id)?.nome ?? "sistema"}</div>
                </div></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
