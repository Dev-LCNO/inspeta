// S12 — Detalhe da inspeção
import { useEffect, useState } from "react";
import { pode } from "../data/server";
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { baixar, gerarRelatorioPdf, respostaTexto } from "../pdf";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, Dialog, ErrorState, TextField, PageHeader, ScoreHero, SkeletonBlock, StatusBadge, useToast } from "../ui/primitives";
import { Link } from "../ui/router";
import { SituacaoBadge } from "./Planos";

export function InspecaoDetalhe({ me, id }: { me: Membro; id: string }) {
  const toast = useToast();
  const [gerando, setGerando] = useState(false);
  const d = useData(async () => {
    const i = await server.obterInspecao(me, id);
    const [v, avs, fs, ev, todas, planos, aprovacao] = await Promise.all([
      server.obterVersao(i.formulario_versao_id), server.listarAvaliados(), server.listarFormularios(),
      server.eventos(i.id), server.listarInspecoes(me, {}), server.planosDaInspecao(i.id), server.aprovacaoDaInspecao(i.id),
    ]);
    const anterior = todas
      .filter((x) => x.formulario_id === i.formulario_id && x.avaliado_id === i.avaliado_id && x.id !== i.id && x.status !== "rascunho"
        && (x.finalizada_em ?? "") < (i.finalizada_em ?? "9"))
      .sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""))[0];
    return {
      i, v, avaliado: avs.find((a) => a.id === i.avaliado_id)!, formulario: fs.find((f) => f.id === i.formulario_id)?.nome ?? "Formulário removido",
      responsavel: server.membros().find((m) => m.id === i.responsavel_id)!, eventos: ev, anterior: anterior?.nota_pct ?? null, planos, aprovacao,
    };
  }, [id], ["inspecoes", "planos"]);

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
  const { i, v, avaliado, formulario, responsavel, eventos, anterior, planos, aprovacao } = d.data;
  const def = v.definicao;
  const classe = def.config.classificacoes?.find((c) => c.nome === i.classificacao) ?? null;

  async function pdf() {
    setGerando(true);
    try {
      const { layout, logo } = await server.layoutRelatorio(i.formulario_id);
      const comLayout = { ...def, config: { ...def.config, relatorio: { ...def.config.relatorio, layout } } };
      const bytes = await gerarRelatorioPdf({ org: server.org(), inspecao: i, definicao: comLayout, formulario, versao: v.numero, avaliado, responsavel, anexos: fotos, notaAnterior: anterior, logo });
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
              {def.config.geo && def.config.geo !== "off" ? <>
                {def.config.geo !== "fim" ? <><dt>Local no início</dt><dd><Local g={i.geo_inicio} /></dd></> : null}
                {def.config.geo !== "inicio" ? <><dt>Local no fim</dt><dd><Local g={i.geo_fim} /></dd></> : null}
              </> : null}
            </dl>
          </section>
          {aprovacao.length ? <CartaoAprovacao me={me} inspecaoId={i.id} responsavelId={i.responsavel_id} etapas={aprovacao} /> : null}
          {i.resultado.nao_conformidades.length ? (
            <section className="card stack-sm" aria-label="Planos de ação">
              <h2 style={{ fontSize: "var(--text-base)" }}>Planos de ação</h2>
              {planos.length ? planos.map((p) => (
                <Link key={p.id} to={"/web/planos?plano=" + p.id} className="list-card" >
                  <div className="row-between"><b>{p.modelo_snapshot.nome}</b><SituacaoBadge s={p.situacao} /></div>
                  <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{p.questao_keys.length} não conf. · prazo {p.prazo.split("-").reverse().join("/")} · {p.responsavel_email ?? "sem e-mail"}</span>
                </Link>
              )) : <p className="muted" style={{ margin: 0 }}>Nenhuma destas não conformidades está ligada a um modelo de plano.</p>}
            </section>
          ) : null}
          <section className="card stack-sm" aria-label="Histórico">
            <h2 style={{ fontSize: "var(--text-base)" }}>Histórico</h2>
            <ol className="timeline">
              {eventos.map((e) => (
                <li key={e.id}><span className="pt" aria-hidden="true" /><div>
                  <div style={{ fontWeight: 600 }}>{e.acao === "relatorio_enviado" && Array.isArray(e.dados.para)
                    ? `Relatório enviado por e-mail (${(e.dados.para as string[]).length})`
                    : e.acao === "aprovada" || e.acao === "reprovada" || e.acao === "enviada_aprovacao"
                    ? `${{ aprovada: "Aprovada", reprovada: "Reprovada", enviada_aprovacao: "Enviada para aprovação" }[e.acao]} · etapa ${String(e.dados.etapa)} de ${String(e.dados.de)}`
                    : { criada: "Iniciada", sincronizada: "Sincronizada", finalizada: "Finalizada", editada: "Editada", reaberta: "Reaberta", relatorio_enviado: "Relatório gerado (PDF)", excluida: "Excluída" }[e.acao]}</div>
                  {typeof e.dados.comentario === "string" ? <div className="muted" style={{ fontSize: "var(--text-xs)" }}>“{e.dados.comentario}”</div> : null}
                  {e.acao === "relatorio_enviado" && Array.isArray(e.dados.para) ? <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{(e.dados.para as string[]).join(", ")}</div> : null}
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

// ---------------------------------------------------------------------------
// S32 dentro do S12: etapas de aprovação e a decisão de quem é da etapa atual
// ---------------------------------------------------------------------------

type Etapa = Awaited<ReturnType<typeof server.aprovacaoDaInspecao>>[number];

function CartaoAprovacao({ me, inspecaoId, responsavelId, etapas }: { me: Membro; inspecaoId: string; responsavelId: string; etapas: Etapa[] }) {
  const toast = useToast();
  const [decisao, setDecisao] = useState<"aprovada" | "reprovada" | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const atual = etapas.find((e) => e.atual);
  const minha = !!atual && pode(me, "aprovar") && atual.aprovadores.some((a) => a.id === me.id) && responsavelId !== me.id;

  async function confirmar() {
    if (!decisao) return;
    setOcupado(true); setErro(null);
    try {
      const st = await server.decidir(me, inspecaoId, decisao, comentario);
      setDecisao(null); setComentario("");
      toast({ tone: "info", text: st === "aprovada" ? "Inspeção aprovada." : st === "reprovada" ? "Inspeção reprovada." : "Etapa aprovada. Seguiu para a próxima." });
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  return (
    <section className="card stack-sm" aria-label="Aprovação">
      <h2 style={{ fontSize: "var(--text-base)" }}>Aprovação</h2>
      <ol className="etapas">
        {etapas.map((e) => (
          <li key={e.etapa} className={e.decisao ? e.decisao.decisao : e.atual ? "atual" : ""}>
            <span className="n" aria-hidden="true">{e.decisao ? <Icon n={e.decisao.decisao === "aprovada" ? "check" : "x"} size="sm" /> : e.etapa}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Etapa {e.etapa}{e.decisao ? ` · ${e.decisao.decisao === "aprovada" ? "aprovada" : "reprovada"} por ${e.decisao.aprovador}` : e.atual ? " · aguardando" : ""}</div>
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{e.decisao ? fmt.dataHoraCompleta(e.decisao.em) : e.aprovadores.map((a) => a.nome).join(" ou ")}</div>
              {e.decisao?.comentario ? <div style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>“{e.decisao.comentario}”</div> : null}
            </div>
          </li>
        ))}
      </ol>
      {minha ? (
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <Button icon="check" onClick={() => { setErro(null); setDecisao("aprovada"); }}>Aprovar</Button>
          <Button variant="secondary" icon="x" onClick={() => { setErro(null); setDecisao("reprovada"); }}>Reprovar</Button>
        </div>
      ) : atual && atual.aprovadores.some((a) => a.id === me.id) && responsavelId === me.id
        ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Você aplicou esta inspeção; outra pessoa da etapa precisa decidir.</p> : null}
      <Dialog open={!!decisao} onClose={() => setDecisao(null)} title={decisao === "aprovada" ? "Aprovar inspeção" : "Reprovar inspeção"}
        footer={<><Button variant="secondary" onClick={() => setDecisao(null)}>Cancelar</Button>
          <Button variant={decisao === "reprovada" ? "danger" : "primary"} loading={ocupado} onClick={() => void confirmar()}>{decisao === "aprovada" ? "Aprovar" : "Reprovar"}</Button></>}>
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void confirmar(); }}>
          <p style={{ margin: 0 }}>Etapa {atual?.etapa} de {etapas.length}. {decisao === "aprovada" && atual && atual.etapa < etapas.length ? "Depois desta, segue para a próxima etapa." : decisao === "aprovada" ? "É a última etapa: a inspeção fica aprovada." : "A inspeção fica reprovada e o processo termina."}</p>
          <TextField label={decisao === "reprovada" ? "Motivo" : "Comentário (opcional)"} multiline required={decisao === "reprovada"} value={comentario} onChange={setComentario} error={erro} autoFocus />
          <button type="submit" hidden />
        </form>
      </Dialog>
    </section>
  );
}

function Local({ g }: { g?: { lat: number; lng: number; precisao_m?: number } | null }) {
  if (!g) return <span className="muted">não registrado</span>;
  const txt = `${g.lat.toFixed(5).replace(".", ",")}; ${g.lng.toFixed(5).replace(".", ",")}`;
  return (
    <a href={`https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=18/${g.lat}/${g.lng}`} target="_blank" rel="noreferrer" className="num">
      {txt}{g.precisao_m ? ` (±${g.precisao_m} m)` : ""}
    </a>
  );
}
