// S24 — Planos de ação: histórico · S25 — Meus modelos
import { Fragment, useEffect, useMemo, useState } from "react";
import { server } from "../data/server";
import type { Membro, PlanoAcao, PlanoSituacao } from "../data/types";
import { respostaTexto } from "../pdf";
import { fmt } from "../ui/format";
import { useData, useDebounced } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, Dialog, EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs, TextField, useToast } from "../ui/primitives";
import { Link, navigate, useRoute, withQuery } from "../ui/router";

export const SITUACAO: Record<PlanoSituacao, { tone: "acc" | "nc" | "ok"; icon: "clock" | "alert" | "check"; txt: string }> = {
  aberto: { tone: "acc", icon: "clock", txt: "Aberto" },
  em_atraso: { tone: "nc", icon: "alert", txt: "Em atraso" },
  finalizado: { tone: "ok", icon: "check", txt: "Finalizado" },
};
export function SituacaoBadge({ s }: { s: PlanoSituacao }) {
  const x = SITUACAO[s];
  return <Badge tone={x.tone} icon={x.icon}>{x.txt}</Badge>;
}
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

type Linha = PlanoAcao & { situacao: PlanoSituacao; avaliado: string; formulario: string };

export function Planos({ me }: { me: Membro }) {
  const r = useRoute();
  const aba = r.query.get("aba") ?? "historico";
  return (
    <>
      <PageHeader title="Planos de ação" desc="Correções disparadas pelas não conformidades. O responsável recebe um link por e-mail e responde sem precisar de senha." />
      <Tabs items={[
        { to: "/web/planos", label: "Histórico", current: aba === "historico", icon: "history" },
        { to: "/web/planos?aba=modelos", label: "Meus modelos", current: aba === "modelos", icon: "file" },
      ]} />
      {aba === "modelos" ? <Modelos /> : <Historico me={me} />}
    </>
  );
}

function Historico({ me }: { me: Membro }) {
  const r = useRoute();
  const [busca, setBusca] = useState(r.query.get("q") ?? "");
  const buscaD = useDebounced(busca);
  const situacao = (r.query.get("situacao") ?? "") as PlanoSituacao | "";
  const lista = useData(() => server.listarPlanos(me, { busca: buscaD, situacao }), [me.id, buscaD, situacao], ["planos", "inspecoes"]);
  const [aberto, setAberto] = useState<string | null>(r.query.get("plano"));
  const setQ = (patch: Record<string, string>) => navigate(withQuery("/web/planos", { q: buscaD, situacao, ...patch }), { replace: true });
  useEffect(() => { if (buscaD !== (r.query.get("q") ?? "")) setQ({ q: buscaD }); }, [buscaD]);
  const atual = lista.data?.find((p) => p.id === aberto) ?? null;
  const contagem = useMemo(() => {
    const c = { aberto: 0, em_atraso: 0, finalizado: 0 };
    for (const p of lista.data ?? []) c[p.situacao]++;
    return c;
  }, [lista.data]);

  return (
    <>
      <div className="filterbar" role="search">
        <div className="field search"><label htmlFor="pb">Buscar</label>
          <div className="searchbox"><Icon n="search" /><input id="pb" className="input" style={{ height: 40 }} placeholder="Avaliado, plano ou e-mail"
            value={busca} onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div></div>
        <div className="field"><label htmlFor="ps">Situação</label>
          <select id="ps" className="select" value={situacao} onChange={(e: { target: { value: string } }) => setQ({ situacao: e.target.value })}>
            <option value="">Todas</option><option value="aberto">Aberto</option><option value="em_atraso">Em atraso</option><option value="finalizado">Finalizado</option>
          </select></div>
      </div>
      {lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows cols={6} />
        : !lista.data.length ? (
          <div className="card flat"><EmptyState icon="target" title={busca || situacao ? "Nenhum plano com esses filtros" : "Nenhum plano de ação ainda"}
            text={busca || situacao ? undefined : "Eles aparecem quando uma inspeção finalizada tem não conformidade ligada a um modelo de plano. Ligue os modelos nas questões, no editor de formulários."} /></div>
        ) : (
          <>
            <p className="muted" aria-live="polite" style={{ margin: "0 0 var(--space-2)" }}>
              {lista.data.length} {lista.data.length === 1 ? "plano" : "planos"}
              {!situacao ? <> · {contagem.aberto} abertos · <span style={{ color: contagem.em_atraso ? "var(--c-danger)" : undefined }}>{contagem.em_atraso} em atraso</span> · {contagem.finalizado} finalizados</> : null}
            </p>
            <div className="table-wrap responsive">
              <table className="table">
                <caption className="sr-only">Planos de ação</caption>
                <thead><tr><th>Avaliado</th><th>Plano</th><th className="r">Não conf.</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
                <tbody>{lista.data.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setAberto(p.id)}>
                    <td><button type="button" className="rowlink" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", fontWeight: 600, color: "var(--c-text)" }}
                      onClick={(e: { stopPropagation(): void }) => { e.stopPropagation(); setAberto(p.id); }}>{p.avaliado}</button></td>
                    <td>{p.modelo_snapshot.nome}</td>
                    <td className="r num">{p.questao_keys.length}</td>
                    <td>{p.responsavel_email ?? <Badge tone="warn" icon="alert">Sem e-mail</Badge>}</td>
                    <td className="num" style={{ color: p.situacao === "em_atraso" ? "var(--c-danger)" : undefined, fontWeight: p.situacao === "em_atraso" ? 600 : undefined }}>{dataBR(p.prazo)}</td>
                    <td><SituacaoBadge s={p.situacao} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="cards">{lista.data.map((p) => (
              <button key={p.id} type="button" className="list-card" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => setAberto(p.id)}>
                <div className="row-between"><b>{p.avaliado}</b><SituacaoBadge s={p.situacao} /></div>
                <span className="muted">{p.modelo_snapshot.nome} · {p.questao_keys.length} não conf.</span>
                <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>Prazo {dataBR(p.prazo)} · {p.responsavel_email ?? "sem e-mail"}</span>
              </button>
            ))}</div>
          </>
        )}
      {atual ? <PlanoDialog me={me} p={atual} onClose={() => setAberto(null)} /> : null}
    </>
  );
}

function PlanoDialog({ me, p, onClose }: { me: Membro; p: Linha; onClose: () => void }) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState(p.responsavel_email ?? "");
  const [ocupado, setOcupado] = useState<"link" | "email" | null>(null);
  const ctx = useData(async () => {
    const i = await server.obterInspecao(me, p.inspecao_id);
    const v = await server.obterVersao(i.formulario_versao_id);
    const fotos: Record<string, string> = {};
    for (const a of p.anexos) { const d = await server.anexo(a.client_uuid); if (d) fotos[a.client_uuid] = d; }
    return { i, v, fotos };
  }, [p.id, p.status]);
  const qs = ctx.data ? new Map(ctx.data.v.definicao.topicos.flatMap((t) => t.questoes).map((q) => [q.key, q])) : null;
  const perguntas = p.modelo_snapshot.definicao.topicos.flatMap((t) => t.questoes);

  async function gerar(reenviar: boolean) {
    setOcupado(reenviar ? "email" : "link");
    try {
      const r = await server.novoLinkPlano(p.id, me, reenviar ? email : undefined);
      setLink(r.link);
      try { await navigator.clipboard.writeText(r.link); } catch { /* sem permissão: o link fica visível para copiar */ }
      toast({ tone: "info", text: reenviar ? `E-mail reenviado para ${email}. O link anterior deixou de valer.` : "Link novo copiado. O anterior deixou de valer." });
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`${p.modelo_snapshot.nome} — ${p.avaliado}`}
      footer={<><Link to={"/web/inspecoes/" + p.inspecao_id} className="btn secondary">Ver inspeção</Link><Button onClick={onClose}>Fechar</Button></>}>
      <div className="row"><SituacaoBadge s={p.situacao} /><span className="muted num">Prazo {dataBR(p.prazo)}</span>{p.finalizado_em ? <span className="muted">· respondido por {p.respondido_por} em {fmt.dataHora(p.finalizado_em)}</span> : null}</div>
      {!ctx.data ? <div className="sk" style={{ height: 80 }} /> : p.questao_keys.map((k) => {
        const q = qs!.get(k);
        const resp = p.respostas[k];
        return (
          <section key={k} className="card flat stack-sm" style={{ padding: "var(--space-4)" }}>
            <div><Badge tone="nc" icon="x">Não conforme</Badge> <b>{q?.titulo}</b></div>
            {q ? <div className="muted">Resposta na inspeção: {respostaTexto(q, ctx.data!.i.respostas[k])}{ctx.data!.i.respostas[k]?.observacao ? ` — "${ctx.data!.i.respostas[k]!.observacao}"` : ""}</div> : null}
            {resp ? (
              <dl className="meta-list" style={{ marginTop: 6 }}>
                {perguntas.map((pq) => <Fragment key={pq.key}><dt>{pq.titulo}</dt><dd>{respostaTexto(pq, resp[pq.key])}</dd></Fragment>)}
              </dl>
            ) : <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Aguardando resposta do responsável.</span>}
            {p.anexos.filter((a) => a.nc_key === k).length ? (
              <div className="thumbs">{p.anexos.filter((a) => a.nc_key === k).map((a) => ctx.data!.fotos[a.client_uuid]
                ? <img key={a.client_uuid} src={ctx.data!.fotos[a.client_uuid]} alt="Foto da correção" /> : null)}</div>
            ) : null}
          </section>
        );
      })}
      {p.status !== "finalizado" ? (
        <section className="stack-sm">
          <div className="label">Link do responsável</div>
          <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Por segurança, o link só é mostrado quando é gerado. Gerar um novo invalida o anterior.</p>
          {link ? <div className="row" style={{ flexWrap: "nowrap" }}><input className="input mono grow" readOnly value={link} aria-label="Link do plano" onFocus={(e: { target: HTMLInputElement }) => e.target.select()} />
            <Button variant="secondary" icon="copy" label="Copiar link" onClick={() => { void navigator.clipboard.writeText(link).catch(() => undefined); toast({ tone: "info", text: "Link copiado." }); }} /></div> : null}
          <div><Button variant="secondary" icon="refresh" loading={ocupado === "link"} onClick={() => gerar(false)}>Gerar novo link</Button></div>
          <form className="row" noValidate style={{ alignItems: "flex-end" }} onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void gerar(true); }}>
            <div className="grow"><TextField label="Reenviar por e-mail para" type="email" value={email} onChange={setEmail} /></div>
            <Button type="submit" icon="mail" loading={ocupado === "email"} disabled={!email.trim()}>Reenviar</Button>
          </form>
          {p.ultimo_email_em ? <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Último e-mail: {fmt.dataHora(p.ultimo_email_em)}</span> : <Callout tone="warn">Nenhum e-mail foi enviado: o avaliado não tem e-mail no cadastro. Gere o link e mande por outro canal, ou reenvie para um e-mail.</Callout>}
        </section>
      ) : null}
    </Dialog>
  );
}

function Modelos() {
  const lista = useData(() => server.listarPlanosModelo(), [], ["planos"]);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  async function criar() {
    setCriando(true); setErro(null);
    try { const m = await server.criarPlanoModelo(nome); navigate("/web/planos/modelos/" + m.id); }
    catch (e) { setErro((e as Error).message); }
    finally { setCriando(false); }
  }
  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-4)" }}>
        <p className="muted" style={{ margin: 0 }}>Cada modelo é um checklist curto de correção. Ligue-o às questões no editor de formulários.</p>
        <Button icon="plus" onClick={() => { setNome(""); setErro(null); setNovo(true); }}>Novo modelo</Button>
      </div>
      {lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows rows={2} cols={4} />
        : !lista.data.length ? <div className="card flat"><EmptyState icon="target" title="Nenhum modelo" action={<Button icon="plus" onClick={() => setNovo(true)}>Novo modelo</Button>} /></div>
        : (
          <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {lista.data.map((m) => (
              <Link key={m.id} to={"/web/planos/modelos/" + m.id} className="list-card">
                <b>{m.nome}</b>
                <span className="muted">{m.definicao.topicos.reduce((n, t) => n + t.questoes.length, 0)} perguntas · prazo de {m.prazo_dias} {m.prazo_dias === 1 ? "dia" : "dias"}</span>
                <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{m.agrupamento === "por_inspecao" ? "Um link por inspeção" : "Um link por não conformidade"} · envia para {m.destinatario === "avaliado" ? "o avaliado" : m.email_fixo}</span>
              </Link>
            ))}
          </div>
        )}
      <Dialog open={novo} onClose={() => setNovo(false)} title="Novo modelo de plano"
        footer={<><Button variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button><Button loading={criando} onClick={criar}>Criar e editar</Button></>}>
        <form onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void criar(); }}>
          <TextField label="Nome" value={nome} onChange={setNome} error={erro} help="Ex.: Limpeza corretiva, Ajuste de precificação" autoFocus />
        </form>
      </Dialog>
    </>
  );
}
