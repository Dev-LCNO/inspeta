// S26 — Responder plano de ação pelo link do e-mail (sem login)
import { Fragment, useId, useRef, useState } from "react";
import { evaluateForm, type Answer, type Answers, type Question } from "@app/form-engine";
import { comprimirImagem } from "../data/device";
import { server } from "../data/server";
import { respostaTexto } from "../pdf";
import { fmt, parseNumero } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, EmptyState, SkeletonBlock, TextField, useToast } from "../ui/primitives";
import { SituacaoBadge } from "./Planos";

interface FotoNova { client_uuid: string; nc_key: string; questao_key: string; dataUrl: string; bytes: number }

export function PlanoPublico({ token }: { token: string }) {
  const toast = useToast();
  const d = useData(() => server.planoPorToken(token), [token], ["planos"]);
  const [respostas, setRespostas] = useState<Record<string, Answers>>({});
  const [fotos, setFotos] = useState<FotoNova[]>([]);
  const [nome, setNome] = useState("");
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (d.status === "error") return (
    <main className="field-app"><div className="f-body"><EmptyState icon="alert" title="Link indisponível" text={d.error.message} /></div></main>
  );
  if (!d.data) return <main className="field-app"><div className="f-body"><SkeletonBlock h={140} /><SkeletonBlock h={300} /></div></main>;
  const { plano, avaliado, formulario, inspecao, ncs, org } = d.data;
  const def = plano.modelo_snapshot.definicao;
  const perguntas = def.topicos.flatMap((t) => t.questoes);

  const comFotos = (nc: string): Answers => {
    const r: Answers = structuredClone(respostas[nc] ?? {});
    for (const f of fotos.filter((x) => x.nc_key === nc)) { const a = (r[f.questao_key] ??= {}); a.fotos = (a.fotos ?? 0) + 1; }
    return r;
  };
  const pendencias = ncs.map((n) => ({ nc: n.key, ev: evaluateForm(def, comFotos(n.key)) }));
  const totalPend = pendencias.reduce((s, p) => s + p.ev.pendentes.length, 0) + (nome.trim() ? 0 : 1);

  const responder = (nc: string, q: string, patch: Partial<Answer> | null) => setRespostas((r) => {
    const x = { ...(r[nc] ?? {}) };
    if (patch === null) delete x[q]; else x[q] = { ...x[q], ...patch };
    return { ...r, [nc]: x };
  });

  async function enviar() {
    setTentou(true);
    if (totalPend) { toast({ tone: "error", text: "Preencha o que está marcado em vermelho." }); return; }
    setEnviando(true);
    try {
      await server.responderPlano(token, { respostas, fotos, nome });
      d.reload();
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="field-app">
      <header className="f-top"><div className="grow"><div className="sub">{org.nome}</div><h1>Plano de ação: {plano.modelo_snapshot.nome}</h1></div><SituacaoBadge s={plano.situacao} /></header>
      <div className="f-body">
        <section className="card stack-sm">
          <dl className="meta-list">
            <dt>Local</dt><dd>{avaliado}</dd>
            <dt>Inspeção</dt><dd>{formulario}</dd>
            <dt>Feita em</dt><dd className="num">{fmt.dataHoraCompleta(inspecao.finalizada_em)} · {inspecao.responsavel}</dd>
            <dt>Prazo</dt><dd className="num" style={{ color: plano.situacao === "em_atraso" ? "var(--c-danger)" : undefined }}>{plano.prazo.split("-").reverse().join("/")}{plano.situacao === "em_atraso" ? " (vencido)" : ""}</dd>
          </dl>
        </section>

        {plano.status === "finalizado" ? (
          <>
            <Callout tone="ok">Respondido por <b>{plano.respondido_por}</b> em {fmt.dataHoraCompleta(plano.finalizado_em)}. Obrigado!</Callout>
            {ncs.map((n) => (
              <section key={n.key} className="card stack-sm">
                <b>{n.numero}. {n.titulo}</b>
                <dl className="meta-list">{perguntas.map((q) => <Fragment key={q.key}><dt>{q.titulo}</dt><dd>{respostaTexto(q, plano.respostas[n.key]?.[q.key])}</dd></Fragment>)}</dl>
              </section>
            ))}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>A inspeção encontrou {ncs.length === 1 ? "um problema" : `${ncs.length} problemas`}. Para cada um, registre o que foi feito.</p>
            {ncs.map((n, k) => {
              const ev = pendencias[k]!.ev;
              return (
                <section key={n.key} className="stack" aria-labelledby={"nc-" + n.key}>
                  <div className="q nc">
                    <div className="row" style={{ gap: 6, marginBottom: 6 }}><Badge tone="nc" icon="x">Não conforme</Badge>{n.reincidente ? <Badge tone="nc" icon="repeat">Repetiu</Badge> : null}</div>
                    <h2 id={"nc-" + n.key} className="qt" style={{ fontSize: "var(--text-md)" }}>{n.numero}. {n.titulo}</h2>
                    {n.questao ? <div className="muted" style={{ marginTop: 4 }}>Encontrado: <b style={{ color: "var(--c-text)" }}>{respostaTexto(n.questao, n.resposta)}</b>{n.resposta?.observacao ? ` — "${n.resposta.observacao}"` : ""}</div> : null}
                  </div>
                  {perguntas.map((q) => (
                    <Pergunta key={q.key} q={q} a={respostas[n.key]?.[q.key]} pend={tentou ? ev.questoes[q.key]?.pendencias ?? [] : []}
                      fotos={fotos.filter((f) => f.nc_key === n.key && f.questao_key === q.key)}
                      onAnswer={(p) => responder(n.key, q.key, p)}
                      onFoto={async (files) => {
                        const novas: FotoNova[] = [];
                        for (const f of files) { const c = await comprimirImagem(f); novas.push({ client_uuid: crypto.randomUUID(), nc_key: n.key, questao_key: q.key, ...c }); }
                        setFotos((xs) => [...xs, ...novas]);
                      }}
                      onRemover={(id) => setFotos((xs) => xs.filter((x) => x.client_uuid !== id))} />
                  ))}
                </section>
              );
            })}
            <section className="card">
              <TextField label="Seu nome" value={nome} onChange={setNome} error={tentou && !nome.trim() ? "Informe quem está respondendo." : null} autoComplete="name" />
            </section>
            <Button size="xl" block icon="check" loading={enviando} onClick={enviar}>Enviar respostas</Button>
            <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)", textAlign: "center" }}>Depois de enviar, não dá para alterar. O gestor recebe na hora.</p>
          </>
        )}
      </div>
    </main>
  );
}

function Pergunta({ q, a, pend, fotos, onAnswer, onFoto, onRemover }: {
  q: Question; a?: Answer; pend: { tipo: string }[]; fotos: FotoNova[];
  onAnswer: (p: Partial<Answer> | null) => void; onFoto: (f: File[]) => Promise<void>; onRemover: (id: string) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [txt, setTxt] = useState(a?.numero == null ? "" : String(a.numero).replace(".", ","));
  const id = useId();
  const faltaFoto = pend.some((p) => p.tipo === "foto");
  return (
    <fieldset className={"q" + (pend.length ? " pend" : "")}>
      <legend id={id} className="qt">{q.titulo}{q.obrigatoria ? <span className="req" aria-hidden="true"> *</span> : null}</legend>
      {q.ajuda?.texto ? <div className="help-box" style={{ marginTop: 0, marginBottom: 8 }}>{q.ajuda.texto}</div> : null}
      {q.tipo === "texto" ? <textarea className="textarea" aria-labelledby={id} value={a?.texto ?? ""} onChange={(e: { target: { value: string } }) => onAnswer(e.target.value ? { texto: e.target.value } : null)} /> : null}
      {q.tipo === "data_hora" ? <input className="input f-input" type={q.data_hora?.campos === "data" ? "date" : "datetime-local"} aria-labelledby={id} value={a?.data ?? ""} onChange={(e: { target: { value: string } }) => onAnswer(e.target.value ? { data: e.target.value } : null)} /> : null}
      {q.tipo === "numerica" ? <input className="numin" inputMode="decimal" aria-labelledby={id} value={txt} onChange={(e: { target: { value: string } }) => { setTxt(e.target.value); const n = parseNumero(e.target.value); onAnswer(n === null ? null : { numero: n }); }} /> : null}
      {q.tipo === "escolha_simples" || q.tipo === "escolha_multipla" ? (
        <div role={q.tipo === "escolha_multipla" ? "group" : "radiogroup"} aria-labelledby={id}>
          {(q.opcoes ?? []).map((o) => {
            const on = (a?.opcoes ?? []).includes(o.key);
            return (
              <button key={o.key} type="button" role={q.tipo === "escolha_multipla" ? "checkbox" : "radio"} aria-checked={on} className={"opt neutral" + (q.tipo === "escolha_multipla" ? " multi" : "")}
                onClick={() => {
                  if (q.tipo === "escolha_simples") return onAnswer({ opcoes: [o.key] });
                  const s = new Set(a?.opcoes ?? []); if (on) s.delete(o.key); else s.add(o.key);
                  onAnswer(s.size ? { opcoes: [...s] } : null);
                }}>
                <span className="r" aria-hidden="true">{on ? <Icon n="check" /> : null}</span>{o.texto}
              </button>
            );
          })}
        </div>
      ) : null}
      {q.foto_obrigatoria || fotos.length ? (
        <div className="photos">
          {fotos.map((f) => <button key={f.client_uuid} type="button" className="ph" aria-label="Remover foto" onClick={() => onRemover(f.client_uuid)}><img src={f.dataUrl} alt="" /><span className="st"><Icon n="x" size="sm" /></span></button>)}
          <button type="button" className="ph add" aria-label="Adicionar foto" onClick={() => ref.current?.click()}><Icon n="camera" /></button>
          <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={async (e: { target: HTMLInputElement }) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) await onFoto(fs); }} />
        </div>
      ) : null}
      {pend.length ? <p className="lim out" style={{ margin: "8px 0 0" }}><Icon n="alert" size="sm" />{[pend.some((p) => p.tipo === "obrigatoria") ? "Responda esta pergunta" : "", faltaFoto ? "anexe uma foto" : ""].filter(Boolean).join(" e ")}</p> : null}
    </fieldset>
  );
}
