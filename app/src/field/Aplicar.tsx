// M06 Aplicação · M07 Assinatura · M10 Leitor de código · M11 Pós-finalização
import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateForm, insideLimit, type Answer, type Answers, type Evaluation, type Question } from "@app/form-engine";
import { device, type FotoLocal, type InspecaoLocal } from "../data/device";
import { net } from "../data/net";
import type { Membro } from "../data/types";
import { corClassificacao, fmt, parseNumero } from "../ui/format";
import { useTick } from "../ui/hooks";
import { Icon, type IconName } from "../ui/icons";
import { Badge, Button, Callout, Dialog, EmptyState, SkeletonBlock, useToast } from "../ui/primitives";
import { Link, navigate, useRoute, withQuery } from "../ui/router";
import { SyncPill } from "./FieldApp";

export function Aplicar({ me, clientUuid }: { me: Membro; clientUuid: string }) {
  const r = useRoute();
  const toast = useToast();
  const [insp, setInsp] = useState<InspecaoLocal | null | undefined>(undefined);
  const [anteriores, setAnteriores] = useState<Record<string, { conforme: boolean | null } | undefined>>({});
  const [nomeAv, setNomeAv] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [topicosAbertos, setTopicosAbertos] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizada, setFinalizada] = useState(false);
  useTick(["net"]);

  async function recarregar() {
    const s = await device.estado(me.id);
    const i = s.inspecoes.find((x) => x.client_uuid === clientUuid) ?? null;
    setInsp(i);
    if (i) {
      setAnteriores(s.pacote?.anteriores[`${i.formulario_id}|${i.avaliado_id}`] ?? {});
      setNomeAv(s.pacote?.avaliados.find((a) => a.id === i.avaliado_id)?.nome ?? "Avaliado");
      if (i.estado !== "rascunho") setFinalizada(true);
    }
  }
  useEffect(() => { void recarregar(); }, [clientUuid]);

  const ev: Evaluation | null = useMemo(() => (insp ? evaluateForm(insp.definicao, insp.respostas, anteriores) : null), [insp, anteriores]);

  if (insp === undefined) return <main className="f-body"><SkeletonBlock h={300} /></main>;
  if (insp === null) return (
    <main className="f-body"><EmptyState icon="alert" title="Inspeção não encontrada neste aparelho" text="Ela pode ter sido enviada e removida após 7 dias."
      action={<Link to="/campo" className="btn primary lg">Voltar ao início</Link>} /></main>
  );
  const ins = insp;
  const def = ins.definicao;
  const topicosVis = def.topicos.filter((t) => ev!.topicos[t.key]?.visivel);
  const tIdx = Math.min(Math.max(0, Number(r.query.get("t") ?? 0) || 0), Math.max(0, topicosVis.length - 1));
  const revisar = r.query.get("revisar") === "1";
  const topico = topicosVis[tIdx];
  const irPara = (t: number, rev = false) => navigate(withQuery("/campo/aplicar/" + clientUuid, { t: String(t), revisar: rev ? "1" : undefined }), { replace: true });

  // resposta: atualiza a tela na hora e grava no aparelho em seguida
  function responder(key: string, patch: Partial<Answer> | null) {
    if (ins.estado !== "rascunho") return;
    const respostas: Answers = { ...ins.respostas };
    if (patch === null) delete respostas[key];
    else respostas[key] = { ...respostas[key], ...patch };
    setInsp({ ...ins, respostas });
    void device.responder(me.id, clientUuid, key, patch).catch((e: Error) => toast({ tone: "error", text: e.message }));
  }

  async function finalizar() {
    setFinalizando(true);
    try {
      const res = await device.finalizar(me.id, clientUuid);
      if (!res.ok) {
        setMostrarErros(true);
        toast({ tone: "error", text: `${res.pendentes.length === 1 ? "Falta 1 questão" : `Faltam ${res.pendentes.length} questões`} para finalizar.` });
        return;
      }
      setFinalizada(true);
      await recarregar();
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setFinalizando(false);
    }
  }

  if (finalizada) return <Concluida me={me} insp={ins} ev={ev!} nomeAv={nomeAv} recarregar={recarregar} />;

  const respondidasT = (k: string) => {
    const t = def.topicos.find((x) => x.key === k)!;
    const vis = t.questoes.filter((q) => ev!.questoes[q.key]?.visivel && q.tipo !== "calculo");
    return { feitas: vis.filter((q) => ev!.questoes[q.key]!.respondida).length, total: vis.length, pend: vis.some((q) => ev!.questoes[q.key]!.pendencias.length) };
  };
  const pct = ev!.visiveis ? Math.round((ev!.respondidas / ev!.visiveis) * 100) : 0;

  return (
    <>
      <header className="f-top" style={{ flexDirection: "column", alignItems: "stretch", gap: 4, paddingBottom: 0 }}>
        <div className="row" style={{ flexWrap: "nowrap", gap: "var(--space-2)" }}>
          <Button variant="ghost" icon="left" label="Sair e salvar rascunho" onClick={() => navigate("/campo")} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="sub truncate">{nomeAv} · {ins.nome_formulario}</div>
            <h1 className="truncate">{revisar ? "Revisar e finalizar" : topico?.titulo}</h1>
          </div>
          <SyncPill me={me} compact />
        </div>
        <div className="progress" role="progressbar" aria-label="Questões respondidas" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ margin: "6px calc(-1 * var(--space-4)) 0" }}><i style={{ width: pct + "%" }} /></div>
      </header>

      <main className="f-body with-bar">
        {!net.online ? <Callout tone="info" icon="cloudOff">Sem internet. Pode seguir normalmente: tudo fica salvo no aparelho.</Callout> : null}
        {revisar ? (
          <Revisao ev={ev!} insp={ins} topicosVis={topicosVis} irPara={irPara} />
        ) : topico ? (
          topico.questoes.map((q) => {
            const res = ev!.questoes[q.key]!;
            if (!res.visivel) return null;
            return (
              <QuestionCard key={q.key} q={q} numero={res.numero} answer={ins.respostas[q.key]} res={res}
                anterior={anteriores[q.key]} preenchida={ins.preenchidas?.[q.key]} mostrarErros={mostrarErros} fotos={ins.fotos.filter((f) => f.questao_key === q.key)}
                onAnswer={(p) => responder(q.key, p)}
                onFoto={async (files, tipo) => {
                  try {
                    for (const f of files) await device.adicionarFoto(me.id, clientUuid, q.key, f, tipo);
                    await recarregar();
                  } catch (e) { toast({ tone: "error", text: "Não deu para salvar a imagem: " + (e as Error).message }); }
                }}
                onRemoverFoto={async (id) => { await device.removerFoto(me.id, clientUuid, id); await recarregar(); }} />
            );
          })
        ) : <EmptyState title="Formulário sem tópicos visíveis" />}
      </main>

      <nav className="bottom" aria-label="Navegação entre tópicos">
        <Button variant="secondary" size="lg" icon="left" label="Tópico anterior" disabled={!revisar && tIdx === 0}
          onClick={() => (revisar ? irPara(topicosVis.length - 1) : irPara(tIdx - 1))} />
        <button type="button" className="mid" onClick={() => setTopicosAbertos(true)} aria-haspopup="dialog">
          <b>{revisar ? "Revisão" : `Tópico ${tIdx + 1} de ${topicosVis.length}`}</b>{ev!.respondidas} de {ev!.visiveis} respondidas
        </button>
        {revisar
          ? <Button size="lg" variant="success" icon="check" loading={finalizando} onClick={finalizar}>Finalizar</Button>
          : tIdx < topicosVis.length - 1
            ? <Button size="lg" iconRight="right" onClick={() => { if (topico && respondidasT(topico.key).pend) setMostrarErros(true); irPara(tIdx + 1); }}>Próximo</Button>
            : <Button size="lg" iconRight="right" onClick={() => { setMostrarErros(true); irPara(tIdx, true); }}>Revisar</Button>}
      </nav>

      <Dialog open={topicosAbertos} onClose={() => setTopicosAbertos(false)} title="Tópicos">
        <div className="topic-list">
          {topicosVis.map((t, k) => {
            const c = respondidasT(t.key);
            const ok = c.feitas === c.total && !c.pend;
            return (
              <button key={t.key} type="button" aria-current={!revisar && k === tIdx ? "step" : undefined} onClick={() => { setTopicosAbertos(false); irPara(k); }}>
                <span style={{ color: ok ? "var(--c-success)" : c.pend && mostrarErros ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                  <Icon n={ok ? "check" : c.pend && mostrarErros ? "alert" : "circleDot"} />
                </span>
                <span className="grow">{t.titulo}</span>
                <span className="muted num">{c.feitas}/{c.total}</span>
              </button>
            );
          })}
          <button type="button" aria-current={revisar ? "step" : undefined} onClick={() => { setTopicosAbertos(false); setMostrarErros(true); irPara(tIdx, true); }}>
            <span style={{ color: "var(--c-accent)" }}><Icon n="checkSquare" /></span><span className="grow">Revisar e finalizar</span>
          </button>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
function Revisao({ ev, insp, topicosVis, irPara }: { ev: Evaluation; insp: InspecaoLocal; topicosVis: InspecaoLocal["definicao"]["topicos"]; irPara: (t: number) => void }) {
  const cfg = insp.definicao.config;
  const pend = ev.pendentes;
  const tituloDe = (key: string) => {
    for (const [k, t] of topicosVis.entries()) { const q = t.questoes.find((x) => x.key === key); if (q) return { q, t: k }; }
    return null;
  };
  const motivo = (p: { tipo: string }) => ({ obrigatoria: "sem resposta", foto: "falta foto", observacao: "falta observação", documento: "falta documento" }[p.tipo] ?? p.tipo);
  return (
    <div className="stack">
      {pend.length ? (
        <section className="card stack-sm" aria-labelledby="h-pend">
          <h2 id="h-pend" style={{ fontSize: "var(--text-base)", color: "var(--c-danger)" }} className="row"><Icon n="alert" />{pend.length === 1 ? "Falta 1 questão" : `Faltam ${pend.length} questões`} para finalizar</h2>
          {pend.map((k) => {
            const x = tituloDe(k)!;
            const res = ev.questoes[k]!;
            return (
              <button key={k} type="button" className="tile" style={{ minHeight: 56 }} onClick={() => irPara(x.t)}>
                <span className="grow"><span className="t">{res.numero}. {x.q.titulo}</span><br /><span className="d" style={{ color: "var(--c-danger)" }}>{res.pendencias.map(motivo).join(" · ")}</span></span>
                <Icon n="right" />
              </button>
            );
          })}
        </section>
      ) : <Callout tone="ok">Tudo respondido. Confira o resumo e finalize.</Callout>}

      <section className="card stack-sm" aria-label="Resumo">
        {cfg.calcular_nota !== false && !cfg.ocultar_nota ? (
          <div className="row-between">
            <span className="muted">Nota prévia</span>
            <span className="score-inline" style={{ fontSize: "var(--text-lg)" }}>
              <span className="dot" style={{ background: corClassificacao(ev.classificacao?.cor) }} />{fmt.pct(ev.nota_pct)}{ev.classificacao ? ` · ${ev.classificacao.nome}` : ""}
            </span>
          </div>
        ) : cfg.calcular_nota !== false ? <span className="muted">A nota aparece depois de finalizar.</span> : null}
        <div className="row-between"><span className="muted">Respondidas</span><b className="num">{ev.respondidas} de {ev.visiveis}</b></div>
        <div className="row-between"><span className="muted">Não conformidades</span>
          {ev.nao_conformidades.length ? <Badge tone="nc" icon="alert">{ev.nao_conformidades.length}</Badge> : <Badge tone="ok" icon="check">Nenhuma</Badge>}</div>
        {ev.nao_conformidades.some((k) => ev.questoes[k]?.reincidente) ? <Callout tone="danger" icon="repeat">{ev.nao_conformidades.filter((k) => ev.questoes[k]?.reincidente).length} não conformidade(s) se repetiram da última inspeção.</Callout> : null}
        <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Depois de finalizar, só o gestor consegue editar pelo painel web.</p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
function QuestionCard({ q, numero, answer, res, anterior, preenchida, mostrarErros, fotos, onAnswer, onFoto, onRemoverFoto }: {
  q: Question; numero: number; answer: Answer | undefined; res: Evaluation["questoes"][string];
  anterior?: { conforme: boolean | null }; preenchida?: "auto" | "unico"; mostrarErros: boolean; fotos: FotoLocal[];
  onAnswer: (p: Partial<Answer> | null) => void;
  onFoto: (files: Blob[], tipo: "foto" | "assinatura") => Promise<void>;
  onRemoverFoto: (id: string) => Promise<void>;
}) {
  const [obsAberta, setObsAberta] = useState(!!answer?.observacao);
  const [ajuda, setAjuda] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nc = res.conforme === false;
  const pend = res.pendencias;
  const precisaObs = pend.some((p) => p.tipo === "observacao");
  const precisaFoto = pend.some((p) => p.tipo === "foto");
  useEffect(() => { if (precisaObs && nc) setObsAberta(true); }, [precisaObs, nc]);
  const destacarPend = mostrarErros && pend.length > 0;
  const fotosQ = fotos.filter((f) => f.tipo === "foto");
  const assinatura = fotos.find((f) => f.tipo === "assinatura");
  const legendId = "ql-" + q.key;

  return (
    <fieldset className={"q" + (nc ? " nc" : destacarPend ? " pend" : "")} aria-describedby={pend.length ? legendId + "-p" : undefined} disabled={preenchida === "unico"}>
      <legend id={legendId} className="qt"><span className="qn">{numero}</span><span>{q.titulo}{q.obrigatoria ? <span className="req" aria-hidden="true"> *</span> : null}{q.obrigatoria ? <span className="sr-only"> (obrigatória)</span> : null}</span></legend>
      {preenchida ? <div className="prefill" data-testid={"prefill-" + q.key}><Icon n={preenchida === "unico" ? "key" : "history"} size="sm" />
        {preenchida === "unico" ? "Respondida uma vez para este avaliado. Não muda." : "Veio da última inspeção deste avaliado. Confira e mude se for preciso."}</div> : null}
      <Reincidencia anterior={anterior} res={res} q={q} />

      {q.tipo === "escolha_simples" || q.tipo === "escolha_multipla" ? <Opcoes q={q} answer={answer} onAnswer={onAnswer} legendId={legendId} /> : null}
      {q.tipo === "numerica" ? <Numerica q={q} answer={answer} onAnswer={onAnswer} legendId={legendId} /> : null}
      {q.tipo === "texto" ? (
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "stretch" }}>
          <textarea className="textarea grow" style={{ minHeight: 56 }} aria-labelledby={legendId} value={answer?.texto ?? ""} placeholder="Digite a resposta"
            onChange={(e: { target: { value: string } }) => onAnswer(e.target.value ? { texto: e.target.value } : null)} />
          {q.texto?.leitura_codigo ? <Button variant="secondary" size="xl" icon="scan" label="Ler código com a câmera" onClick={() => setLendo(true)} /> : null}
        </div>
      ) : null}
      {q.tipo === "data_hora" ? (
        <input className="input f-input" aria-labelledby={legendId} type={q.data_hora?.campos === "data" ? "date" : "datetime-local"} value={answer?.data ?? ""}
          onChange={(e: { target: { value: string } }) => onAnswer(e.target.value ? { data: e.target.value } : null)} />
      ) : null}
      {q.tipo === "calculo" ? (
        <div className="calc"><span className="muted">Resultado</span><span className="v" aria-live="polite">{res.valor_calculado === null || res.valor_calculado === undefined ? "—" : fmt.num(res.valor_calculado)}{q.numerica?.unidade ? " " + q.numerica.unidade : ""}</span></div>
      ) : null}
      {q.tipo === "assinatura" ? (
        assinatura ? (
          <div className="stack-sm"><AssinaturaPreview foto={assinatura} />
            <div className="row"><Button variant="secondary" icon="refresh" onClick={async () => { await onRemoverFoto(assinatura.client_uuid); setAssinando(true); }}>Refazer assinatura</Button></div></div>
        ) : <Button variant="secondary" size="xl" block icon="pen" onClick={() => setAssinando(true)}>Coletar assinatura</Button>
      ) : null}

      {ajuda && q.ajuda?.texto ? <div className="help-box"><b>Como responder:</b> {q.ajuda.texto}</div> : null}

      {obsAberta ? (
        <div className="field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor={"obs-" + q.key}>Observação{precisaObs ? <span className="req"> (obrigatória)</span> : ""}</label>
          <textarea id={"obs-" + q.key} className="textarea" value={answer?.observacao ?? ""} placeholder="O que você viu?"
            onChange={(e: { target: { value: string } }) => onAnswer({ observacao: e.target.value })} />
        </div>
      ) : null}

      {fotosQ.length ? (
        <div className="photos">{fotosQ.map((f) => <Miniatura key={f.client_uuid} foto={f} onRemover={() => onRemoverFoto(f.client_uuid)} />)}
          <button type="button" className="ph add" aria-label="Adicionar outra foto" onClick={() => fileRef.current?.click()}><Icon n="plus" /></button>
        </div>
      ) : null}

      {nc || (destacarPend && pend.length) ? (
        <div className="ncp" id={legendId + "-p"} aria-live="polite">
          <strong><Icon n="alert" size="sm" />{nc ? (pend.length ? "Não conforme · falta para seguir" : "Não conforme") : "Falta para seguir"}</strong>
          <ul>
            {(q.nc_exige?.observacao || q.numerica?.limite?.obs_obrigatoria || precisaObs) && (nc || precisaObs)
              ? <li className={"need" + (precisaObs ? "" : " done")}><Icon n={precisaObs ? "msg" : "check"} size="sm" />Observação</li> : null}
            {(q.nc_exige?.foto && nc) || q.foto_obrigatoria || precisaFoto
              ? <li className={"need" + (precisaFoto ? "" : " done")}><Icon n={precisaFoto ? "camera" : "check"} size="sm" />Foto</li> : null}
            {pend.some((p) => p.tipo === "obrigatoria") ? <li className="need"><Icon n="edit" size="sm" />Resposta</li> : null}
          </ul>
          {nc && q.plano_acao_modelo_id ? <div className="plano">Vai gerar um plano de ação para o responsável corrigir.</div> : null}
        </div>
      ) : null}

      {q.tipo !== "calculo" && q.tipo !== "assinatura" ? (
        <div className="actions">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={async (e: { target: HTMLInputElement }) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) await onFoto(fs, "foto"); }} />
          <Acao icon="camera" label="Foto" count={fotosQ.length} need={precisaFoto} onClick={() => fileRef.current?.click()} />
          <Acao icon="msg" label="Comentar" pressed={obsAberta} need={precisaObs} onClick={() => setObsAberta(!obsAberta)} />
          {q.ajuda?.texto ? <Acao icon="help" label="Ajuda" pressed={ajuda} onClick={() => setAjuda(!ajuda)} /> : null}
          {answer && !q.preenchimento_unico ? <Acao icon="x" label="Limpar" onClick={() => onAnswer({ opcoes: undefined, numero: undefined, texto: undefined, data: undefined, na: undefined })} /> : null}
        </div>
      ) : null}

      {assinando ? <AssinaturaDialog onClose={() => setAssinando(false)} onSalvar={async (b) => { await onFoto([b], "assinatura"); setAssinando(false); }} /> : null}
      {lendo ? <LeitorCodigo onClose={() => setLendo(false)} onLido={(v) => { onAnswer({ texto: v }); setLendo(false); }} /> : null}
    </fieldset>
  );
}

function Acao({ icon, label, count, pressed, need, onClick }: { icon: IconName; label: string; count?: number; pressed?: boolean; need?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={"act" + (need ? " need-it" : "")} aria-pressed={pressed === undefined ? undefined : pressed} onClick={onClick}>
      <Icon n={icon} />{label}{count ? <span className="cnt" aria-label={`${count} fotos`}>{count}</span> : null}
    </button>
  );
}

function Reincidencia({ anterior, res, q }: { anterior?: { conforme: boolean | null }; res: Evaluation["questoes"][string]; q: Question }) {
  if (q.tipo !== "escolha_simples" && q.tipo !== "escolha_multipla" && q.tipo !== "numerica") return null;
  if (!anterior || anterior.conforme === null) return null;
  if (res.reincidente) return <div className="meta"><Badge tone="nc" icon="repeat">Repetiu a não conformidade da última inspeção</Badge></div>;
  return <div className="meta">{anterior.conforme ? <Badge tone="ok" icon="check">Última: conforme</Badge> : <Badge tone="nc" icon="alert">Última: não conforme</Badge>}</div>;
}

function Opcoes({ q, answer, onAnswer, legendId }: { q: Question; answer?: Answer; onAnswer: (p: Partial<Answer> | null) => void; legendId: string }) {
  const multi = q.tipo === "escolha_multipla";
  const marcadas = new Set(answer?.opcoes ?? []);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-labelledby={legendId}>
      {(q.opcoes ?? []).map((o) => {
        const on = marcadas.has(o.key);
        const cls = o.na ? "na" : o.conforme === true ? "ok" : o.conforme === false ? "bad" : "neutral";
        return (
          <button key={o.key} type="button" role={multi ? "checkbox" : "radio"} aria-checked={on} className={"opt " + cls + (multi ? " multi" : "")}
            onClick={() => {
              if (multi) {
                const n = new Set(marcadas);
                if (on) n.delete(o.key); else n.add(o.key);
                onAnswer({ opcoes: n.size ? [...n] : undefined, na: undefined });
              } else onAnswer({ opcoes: [o.key], na: undefined });
            }}>
            <span className="r" aria-hidden="true">{on ? <Icon n={o.na ? "minus" : o.conforme === false ? "x" : "check"} /> : null}</span>
            <span>{o.texto}</span>
            {on && o.conforme === false ? <span className="tag" style={{ color: "var(--c-danger)" }}>Não conforme</span> : null}
            {on && o.conforme === true ? <span className="tag" style={{ color: "var(--c-success)" }}>Conforme</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function Numerica({ q, answer, onAnswer, legendId }: { q: Question; answer?: Answer; onAnswer: (p: Partial<Answer> | null) => void; legendId: string }) {
  const [txt, setTxt] = useState(answer?.numero == null ? "" : String(answer.numero).replace(".", ","));
  const v = parseNumero(txt);
  const lim = q.numerica?.limite;
  const dentro = v === null ? null : insideLimit(q, v);
  const faixa = lim && (lim.min != null || lim.max != null)
    ? lim.min != null && lim.max != null ? `entre ${fmt.num(lim.min)} e ${fmt.num(lim.max)}` : lim.min != null ? `a partir de ${fmt.num(lim.min)}` : `até ${fmt.num(lim.max)}`
    : null;
  const un = q.numerica?.unidade ?? "";
  const inc = q.numerica?.incremento ?? null;
  const casas = inc ? Math.min(4, (String(inc).split(".")[1] ?? "").length) : 0;
  function passo(d: number) {
    const n = Math.round(((v ?? 0) + d * inc!) * 10 ** casas) / 10 ** casas;
    setTxt(String(n).replace(".", ","));
    onAnswer({ numero: q.numerica?.formato === "inteiro" ? Math.round(n) : n });
  }
  return (
    <>
      <div className="numrow">
        {inc ? <Button variant="secondary" size="xl" icon="minus" label={`Diminuir ${fmt.num(inc)}`} onClick={() => passo(-1)} /> : null}
        <input className={"numin" + (dentro === true ? " in" : dentro === false ? " out" : "")} inputMode={q.numerica?.formato === "inteiro" ? "numeric" : "decimal"}
          aria-labelledby={legendId} aria-describedby={legendId + "-lim"} value={txt} placeholder="0"
          onChange={(e: { target: { value: string } }) => {
            const t = e.target.value.replace(/[^\d,.\-]/g, "");
            setTxt(t);
            const n = parseNumero(t);
            onAnswer(n === null ? { numero: undefined } : { numero: q.numerica?.formato === "inteiro" ? Math.round(n) : n });
          }} />
        {un ? <span className="unit">{un}</span> : null}
        {inc ? <Button variant="secondary" size="xl" icon="plus" label={`Aumentar ${fmt.num(inc)}`} onClick={() => passo(1)} /> : null}
      </div>
      <div id={legendId + "-lim"} aria-live="polite" className={"lim " + (dentro === true ? "in" : dentro === false ? "out" : "neutral")}>
        {dentro === true ? <><Icon n="check" size="sm" />Dentro do limite ({faixa} {un})</>
          : dentro === false ? <><Icon n="alert" size="sm" />Fora do limite ({faixa} {un}). Registre e explique.</>
          : faixa ? <>Aceito: {faixa} {un}</> : null}
      </div>
    </>
  );
}

function useFotoUrl(id: string) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => { let ok = true; void device.foto(id).then((u) => { if (ok) setUrl(u); }); return () => { ok = false; }; }, [id]);
  return url;
}

function Miniatura({ foto, onRemover }: { foto: FotoLocal; onRemover: () => Promise<void> }) {
  const url = useFotoUrl(foto.client_uuid);
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" className="ph" aria-label={`Ver foto (${foto.enviada ? "enviada" : "ainda no aparelho"})`} onClick={() => setAberta(true)}>
        {url ? <img src={url} alt="" /> : null}
        <span className="st" aria-hidden="true"><Icon n={foto.enviada ? "cloud" : "cloudOff"} size="sm" /></span>
      </button>
      {aberta ? (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Foto">
          <div className="bar2"><Button variant="secondary" icon="x" onClick={() => setAberta(false)}>Fechar</Button>
            <Button variant="danger" icon="trash" onClick={async () => { await onRemover(); setAberta(false); }}>Excluir foto</Button></div>
          {url ? <img src={url} alt="Foto anexada à questão" /> : null}
        </div>
      ) : null}
    </>
  );
}

function AssinaturaPreview({ foto }: { foto: FotoLocal }) {
  const url = useFotoUrl(foto.client_uuid);
  return url ? <img className="sig-preview" src={url} alt="Assinatura coletada" /> : <div className="sk" style={{ height: 96 }} />;
}

function AssinaturaDialog({ onClose, onSalvar }: { onClose: () => void; onSalvar: (b: Blob) => Promise<void> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [vazio, setVazio] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const desenhando = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--c-text").trim() || "black";
  }, []);
  const pos = (e: PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <Dialog open onClose={onClose} title="Assinatura"
      footer={<>
        <Button variant="secondary" onClick={() => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setVazio(true); }}>Limpar</Button>
        <Button loading={salvando} disabled={vazio} onClick={() => { setSalvando(true); ref.current!.toBlob((b) => { if (b) void onSalvar(b); }, "image/png"); }}>Salvar assinatura</Button>
      </>}>
      <p className="muted" style={{ margin: 0 }}>Peça para o responsável assinar com o dedo dentro do quadro.</p>
      <canvas ref={ref} className="sigpad" aria-label="Área de assinatura"
        onPointerDown={(e: PointerEvent) => { desenhando.current = true; (e.target as Element).setPointerCapture(e.pointerId); const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); setVazio(false); }}
        onPointerMove={(e: PointerEvent) => { if (!desenhando.current) return; const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); }}
        onPointerUp={() => { desenhando.current = false; }} onPointerCancel={() => { desenhando.current = false; }} />
    </Dialog>
  );
}

function LeitorCodigo({ onClose, onLido }: { onClose: () => void; onLido: (v: string) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const suporta = "BarcodeDetector" in window;
  async function ler(file: Blob) {
    try {
      type BD = { detect(img: ImageBitmap): Promise<{ rawValue: string }[]> };
      const Det = (window as unknown as { BarcodeDetector: new () => BD }).BarcodeDetector;
      const r = await new Det().detect(await createImageBitmap(file));
      if (r[0]?.rawValue) onLido(r[0].rawValue); else setErro("Nenhum código encontrado na foto. Tente mais perto e com luz.");
    } catch { setErro("Não foi possível ler. Digite o código abaixo."); }
  }
  return (
    <Dialog open onClose={onClose} title="Ler código" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!manual.trim()} onClick={() => onLido(manual.trim())}>Usar código</Button></>}>
      {suporta ? (
        <label className="btn primary xl block" style={{ cursor: "pointer" }}><Icon n="camera" />Fotografar o código
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e: { target: HTMLInputElement }) => { const f = e.target.files?.[0]; if (f) void ler(f); }} />
        </label>
      ) : <Callout tone="info">Este navegador não lê códigos pela câmera. Digite o número.</Callout>}
      {erro ? <Callout tone="warn">{erro}</Callout> : null}
      <div className="field"><label htmlFor="cod-man">Ou digite</label><input id="cod-man" className="input f-input mono" inputMode="numeric" value={manual} onChange={(e: { target: { value: string } }) => setManual(e.target.value)} /></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function Concluida({ me, insp, ev, nomeAv, recarregar }: { me: Membro; insp: InspecaoLocal; ev: Evaluation; nomeAv: string; recarregar: () => Promise<void> }) {
  useTick(["device"]);
  useEffect(() => { const t = setInterval(() => { void recarregar(); }, 1500); return () => clearInterval(t); }, []);
  const toast = useToast();
  const enviada = insp.estado === "enviada";
  const cfg = insp.definicao.config;
  const nota = enviada ? insp.nota_servidor ?? null : ev.nota_pct;
  const classe = enviada ? cfg.classificacoes?.find((c) => c.nome === insp.classificacao_servidor) ?? null : ev.classificacao;
  return (
    <>
      <header className="f-top"><div className="grow"><h1>Inspeção finalizada</h1><div className="sub">{nomeAv} · {insp.nome_formulario}</div></div><SyncPill me={me} /></header>
      <main className="f-body">
        <div className="done-hero">
          <span className="ic"><Icon n="check" size="xl" /></span>
          <h2 style={{ fontSize: "var(--text-lg)" }}>{enviada ? "Enviada para o painel" : insp.estado === "erro" ? "Não foi possível enviar" : net.online ? "Enviando…" : "Guardada no aparelho"}</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "40ch" }}>
            {enviada ? "O gestor já consegue ver a nota e baixar o relatório."
              : insp.estado === "erro" ? insp.erro
              : net.online ? "Só um instante." : "Ela sobe sozinha quando a internet voltar. Pode seguir para a próxima."}
          </p>
          {cfg.calcular_nota !== false && nota !== null ? (
            <div className="card" style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{enviada ? "NOTA" : "NOTA PRÉVIA"}</div>
              <div className="score-inline" style={{ fontSize: "var(--text-xl)", justifyContent: "center", marginTop: 4 }}>
                <span className="dot" style={{ background: corClassificacao(classe?.cor) }} />{fmt.pct(nota)}
              </div>
              {classe ? <div style={{ fontWeight: 600 }}>{classe.nome}</div> : null}
              <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 4 }}>{ev.nao_conformidades.length} não conformidade(s)</div>
            </div>
          ) : null}
        </div>
        <Button size="xl" block icon="repeat" onClick={async () => {
          try { const n = await device.novaInspecao(me.id, insp.formulario_id, insp.avaliado_id); navigate("/campo/aplicar/" + n.client_uuid, { replace: true }); }
          catch (e) { toast({ tone: "error", text: (e as Error).message }); }
        }}>Aplicar de novo em {nomeAv}</Button>
        <Link to="/campo/nova" className="btn secondary xl block">Outra inspeção</Link>
        <Link to="/campo" className="btn ghost lg block">Voltar ao início</Link>
      </main>
    </>
  );
}
