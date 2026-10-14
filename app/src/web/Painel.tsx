// Painel de indicadores: KPIs, nota por semana (linha), nota por avaliado e NCs mais frequentes (barras).
// Uma série por gráfico → uma cor só (--c-viz-series, validada nos dois modos); identidade vem do título.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Button, Callout, EmptyState, ErrorState, PageHeader, SkeletonBlock, useToast } from "../ui/primitives";
import { Link, navigate, useRoute, withQuery } from "../ui/router";

type Dados = Awaited<ReturnType<typeof server.painel>>;

const hojeOrg = () => new Intl.DateTimeFormat("en-CA", { timeZone: server.org().fuso_horario }).format(new Date());
const menosDias = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10);
const PERIODOS: Record<string, { nome: string; de: () => string }> = {
  "30": { nome: "Últimos 30 dias", de: () => menosDias(hojeOrg(), 29) },
  "90": { nome: "Últimos 90 dias", de: () => menosDias(hojeOrg(), 89) },
  "mes": { nome: "Este mês", de: () => hojeOrg().slice(0, 8) + "01" },
  "365": { nome: "Últimos 12 meses", de: () => menosDias(hojeOrg(), 364) },
};
const br = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const num1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function Painel({ me }: { me: Membro }) {
  const r = useRoute();
  const toast = useToast();
  const per = PERIODOS[r.query.get("periodo") ?? ""] ? r.query.get("periodo")! : "90";
  const form = r.query.get("formulario") ?? "";
  const ate = hojeOrg(), de = PERIODOS[per]!.de();
  const d = useData(() => server.painel(me, { de, ate, formulario_id: form || undefined }), [me.id, per, form], ["inspecoes", "agenda", "planos"]);
  const [ultimo, setUltimo] = useState<Dados | null>(null);
  useEffect(() => { if (d.data) setUltimo(d.data); }, [d.data]);
  const dados = d.data ?? ultimo; // recarregar mantém o quadro anterior, esmaecido
  const [gerando, setGerando] = useState(false);
  const setQ = (p: Record<string, string>) => navigate(withQuery("/web/painel", { periodo: per === "90" ? undefined : per, formulario: form, ...p }), { replace: true });

  async function demo() {
    setGerando(true);
    try { const n = await server.gerarDadosDemo(me); toast({ tone: "info", text: `${n} inspeções de exemplo criadas nas últimas 12 semanas.` }); }
    catch (e) { toast({ tone: "error", text: (e as Error).message }); }
    finally { setGerando(false); }
  }

  return (
    <>
      <PageHeader title="Painel" desc="Como as lojas e setores estão indo, com base nas inspeções finalizadas que você pode ver." />
      <div className="filterbar" role="group" aria-label="Filtros do painel">
        <div className="field"><label htmlFor="pn-per">Período</label>
          <select id="pn-per" className="select" value={per} onChange={(e: { target: { value: string } }) => setQ({ periodo: e.target.value === "90" ? "" : e.target.value })}>
            {Object.entries(PERIODOS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}
          </select></div>
        <div className="field" style={{ minWidth: 240 }}><label htmlFor="pn-f">Formulário</label>
          <select id="pn-f" className="select" value={form} onChange={(e: { target: { value: string } }) => setQ({ formulario: e.target.value })}>
            <option value="">Todos</option>
            {(dados?.formularios ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select></div>
        <p className="muted num" style={{ margin: "0 0 10px", fontSize: "var(--text-sm)" }}>{fmt.data(de + "T12:00:00Z")} a {fmt.data(ate + "T12:00:00Z")}</p>
      </div>

      {d.status === "error" ? <ErrorState error={d.error} onRetry={d.reload} />
        : !dados ? <div className="stack"><SkeletonBlock h={110} /><SkeletonBlock h={300} /></div>
        : (
          <div className="stack" style={{ gap: "var(--space-5)", opacity: d.data ? 1 : 0.6, transition: "opacity var(--motion-base)" }} aria-busy={d.data ? undefined : "true"}>
            {dados.kpis.inspecoes.atual < 3 && me.is_master ? (
              <Callout icon="info">
                <div className="row-between" style={{ width: "100%" }}>
                  <span>Poucas inspeções no período para tendências. Quer ver o painel com dados de exemplo?</span>
                  <Button variant="secondary" size="sm" loading={gerando} onClick={() => void demo()}>Gerar 12 semanas de exemplo</Button>
                </div>
              </Callout>
            ) : null}
            <Kpis k={dados.kpis} />
            {!dados.kpis.inspecoes.atual ? (
              <div className="card flat"><EmptyState icon="chart" title="Nenhuma inspeção finalizada neste período" text="Escolha um período maior ou outro formulário." /></div>
            ) : (
              <>
                <Cartao titulo="Nota média por semana" sub="Média das inspeções finalizadas em cada semana. As linhas finas marcam onde começam Regular (70) e Bom (85)."
                  tabela={<TabelaSemanas d={dados} />}>
                  <LinhaSemanal semanas={dados.semanas} />
                </Cartao>
                <div className="pn-grid">
                  <Cartao titulo="Nota média por avaliado" sub="Do pior para o melhor: onde agir primeiro." tabela={<TabelaAvaliados d={dados} />}>
                    <Barras itens={dados.porAvaliado.map((a) => ({ id: a.id, rotulo: a.nome, valor: a.nota ?? 0, texto: a.nota === null ? "—" : num1(a.nota) + "%",
                      dica: `${a.qtd} ${a.qtd === 1 ? "inspeção" : "inspeções"} · ${a.ncs} ${a.ncs === 1 ? "não conformidade" : "não conformidades"}` }))} max={100} />
                  </Cartao>
                  <Cartao titulo="Não conformidades mais frequentes" sub="Quantas vezes cada questão saiu não conforme no período." tabela={<TabelaNcs d={dados} />}>
                    {dados.topNcs.length ? <Barras itens={dados.topNcs.map((q) => ({ id: q.chave, rotulo: q.titulo, sub: q.formulario, valor: q.n, texto: String(q.n),
                      dica: `${num1(q.pct)}% das vezes em que a questão foi respondida` }))} />
                      : <EmptyState icon="check" title="Nenhuma não conformidade" />}
                  </Cartao>
                </div>
              </>
            )}
          </div>
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function Delta({ atual, anterior, unidade, maiorEhMelhor, casas = 1 }: { atual: number | null; anterior: number | null; unidade: string; maiorEhMelhor: boolean; casas?: number }) {
  if (atual === null || anterior === null) return <span className="muted">sem período anterior para comparar</span>;
  const diff = atual - anterior;
  const txt = Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: casas });
  if (Math.abs(diff) < Math.pow(10, -casas) / 2) return <span className="muted">igual ao período anterior</span>;
  const bom = diff > 0 === maiorEhMelhor;
  return (
    <span className={"delta " + (bom ? "bom" : "ruim")}>
      <Icon n={diff > 0 ? "arrowUp" : "arrowDown"} size="sm" />
      <span>{diff > 0 ? "+" : "−"}{txt}{unidade} <span className="muted">vs período anterior</span></span>
    </span>
  );
}

function Kpis({ k }: { k: Dados["kpis"] }) {
  return (
    <div className="kpis" role="list">
      <div className="kpi card flat" role="listitem">
        <div className="lbl">Inspeções finalizadas</div>
        <div className="val" data-testid="kpi-inspecoes">{k.inspecoes.atual.toLocaleString("pt-BR")}</div>
        <Delta atual={k.inspecoes.atual} anterior={k.inspecoes.anterior || null} unidade="" maiorEhMelhor casas={0} />
      </div>
      <div className="kpi card flat" role="listitem">
        <div className="lbl">Nota média</div>
        <div className="val" data-testid="kpi-nota">{k.nota.atual === null ? "—" : num1(k.nota.atual) + "%"}</div>
        <Delta atual={k.nota.atual} anterior={k.nota.anterior} unidade=" p.p." maiorEhMelhor />
      </div>
      <div className="kpi card flat" role="listitem">
        <div className="lbl">Não conformidades por inspeção</div>
        <div className="val">{k.ncs_por_inspecao.atual === null ? "—" : num1(k.ncs_por_inspecao.atual)}</div>
        <Delta atual={k.ncs_por_inspecao.atual} anterior={k.ncs_por_inspecao.anterior} unidade="" maiorEhMelhor={false} />
      </div>
      <div className="kpi card flat" role="listitem">
        <div className="lbl">Agenda cumprida</div>
        <div className="val">{k.agenda.pct === null ? "—" : Math.round(k.agenda.pct) + "%"}</div>
        <span className="muted">{k.agenda.cumpridas + k.agenda.atrasadas ? `${k.agenda.cumpridas} feitas · ${k.agenda.atrasadas} atrasadas` : "nada vencido no período"}
          {k.planos_em_atraso ? <> · <Link to="/web/planos?situacao=em_atraso">{k.planos_em_atraso} {k.planos_em_atraso === 1 ? "plano" : "planos"} em atraso</Link></> : null}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moldura do gráfico + tabela
// ---------------------------------------------------------------------------

function Cartao({ titulo, sub, tabela, children }: { titulo: string; sub: string; tabela: ReactNode; children: ReactNode }) {
  return (
    <section className="card viz">
      <h2 style={{ fontSize: "var(--text-base)" }}>{titulo}</h2>
      <p className="muted" style={{ margin: "2px 0 var(--space-4)", fontSize: "var(--text-sm)" }}>{sub}</p>
      {children}
      <details className="viz-tabela"><summary>Ver como tabela</summary><div className="table-wrap">{tabela}</div></details>
    </section>
  );
}

function TabelaSemanas({ d }: { d: Dados }) {
  return (
    <table className="table"><caption className="sr-only">Nota média por semana</caption>
      <thead><tr><th>Semana de</th><th className="r">Nota média</th><th className="r">Inspeções</th></tr></thead>
      <tbody>{d.semanas.map((s) => <tr key={s.semana}><td className="num">{br(s.semana)}</td><td className="r num">{s.nota === null ? "—" : num1(s.nota) + "%"}</td><td className="r num">{s.qtd}</td></tr>)}</tbody>
    </table>
  );
}
function TabelaAvaliados({ d }: { d: Dados }) {
  return (
    <table className="table"><caption className="sr-only">Nota média por avaliado</caption>
      <thead><tr><th>Avaliado</th><th className="r">Nota média</th><th className="r">Inspeções</th><th className="r">Não conf.</th></tr></thead>
      <tbody>{d.porAvaliado.map((a) => <tr key={a.id}><td>{a.nome}</td><td className="r num">{a.nota === null ? "—" : num1(a.nota) + "%"}</td><td className="r num">{a.qtd}</td><td className="r num">{a.ncs}</td></tr>)}</tbody>
    </table>
  );
}
function TabelaNcs({ d }: { d: Dados }) {
  return (
    <table className="table"><caption className="sr-only">Não conformidades mais frequentes</caption>
      <thead><tr><th>Questão</th><th>Formulário</th><th className="r">Vezes</th><th className="r">% das respostas</th></tr></thead>
      <tbody>{d.topNcs.map((q) => <tr key={q.chave}><td>{q.titulo}</td><td className="muted">{q.formulario}</td><td className="r num">{q.n}</td><td className="r num">{num1(q.pct)}%</td></tr>)}</tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Linha (SVG medido; crosshair que acha a semana mais próxima; teclado com ← →)
// ---------------------------------------------------------------------------

function useLargura<T extends Element>(): [{ current: T | null }, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setW(Math.max(260, Math.round(es[0]!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function LinhaSemanal({ semanas }: { semanas: Dados["semanas"] }) {
  const [ref, W] = useLargura<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const H = 240, m = { t: 12, r: 64, b: 28, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (i: number) => m.l + (semanas.length <= 1 ? iw / 2 : (i * iw) / (semanas.length - 1));
  const y = (v: number) => m.t + ih - (v / 100) * ih;
  // segmentos contínuos (semana sem inspeção quebra a linha, não vira zero)
  const segs: { i: number; v: number }[][] = [[]];
  semanas.forEach((w, i) => {
    if (w.nota === null) { if (segs[segs.length - 1]!.length) segs.push([]); }
    else segs[segs.length - 1]!.push({ i, v: w.nota });
  });
  const caminhos = segs.filter((sg) => sg.length).map((sg) => sg.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(""));
  const ultimo = [...semanas.keys()].reverse().find((i) => semanas[i]!.nota !== null);
  const passo = Math.max(1, Math.ceil(semanas.length / Math.max(2, Math.floor(iw / 64))));

  function mover(ev: { clientX: number; currentTarget: Element }) {
    const b = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - b.left;
    const i = semanas.length <= 1 ? 0 : Math.round(((px - m.l) / iw) * (semanas.length - 1));
    setSel(Math.max(0, Math.min(semanas.length - 1, i)));
  }
  const s = sel === null ? null : semanas[sel]!;

  return (
    <div ref={ref} className="viz-plot">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Linha da nota média semanal. ${ultimo !== undefined ? `Última semana: ${num1(semanas[ultimo]!.nota!)}%.` : ""} Use as setas para percorrer as semanas.`}
        tabIndex={0} onPointerMove={mover} onPointerLeave={() => setSel(null)} onBlur={() => setSel(null)}
        onKeyDown={(e: { key: string; preventDefault(): void }) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setSel((v) => Math.max(0, Math.min(semanas.length - 1, (v ?? (e.key === "ArrowRight" ? -1 : semanas.length)) + (e.key === "ArrowRight" ? 1 : -1)))); }
        }}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={v === 0 ? "viz-base" : "viz-grid"} />
            <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="viz-tick">{v}</text>
          </g>
        ))}
        {[{ v: 70, t: "Regular" }, { v: 85, t: "Bom" }].map((f) => (
          <g key={f.v}><line x1={m.l} x2={W - m.r} y1={y(f.v)} y2={y(f.v)} className="viz-ref" /><text x={W - m.r + 6} y={y(f.v)} dy="0.32em" className="viz-tick">{f.t}</text></g>
        ))}
        {semanas.map((w, i) => (i % passo === 0 ? <text key={w.semana} x={x(i)} y={H - 8} textAnchor="middle" className="viz-tick">{br(w.semana)}</text> : null))}
        {caminhos.map((d0, k) => <path key={k} d={d0} className="viz-line" />)}
        {semanas.map((w, i) => (w.nota === null ? null : <circle key={w.semana} cx={x(i)} cy={y(w.nota)} r={i === sel || i === ultimo ? 4 : 3} className="viz-dot" />))}
        {ultimo !== undefined && sel === null ? (() => { const yy = y(semanas[ultimo]!.nota!); return <text x={x(ultimo) - 6} y={yy < m.t + 18 ? yy + 20 : yy - 10} textAnchor="end" className="viz-endlabel">{num1(semanas[ultimo]!.nota!)}%</text>; })() : null}
        {sel !== null ? <line x1={x(sel)} x2={x(sel)} y1={m.t} y2={m.t + ih} className="viz-cross" /> : null}
      </svg>
      {s ? (
        <div className="viz-tip" role="status" style={{ left: Math.min(Math.max(x(sel!) - 80, 0), W - 170), top: 0 }}>
          <div className="v">{s.nota === null ? "sem inspeção" : num1(s.nota) + "%"}</div>
          <div className="k"><span className="key-line" />Semana de {br(s.semana)} · {s.qtd} {s.qtd === 1 ? "inspeção" : "inspeções"}</div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (rótulos longos cabem; valor na ponta; dica no hover/foco)
// ---------------------------------------------------------------------------

function Barras({ itens, max }: { itens: { id: string; rotulo: string; sub?: string; valor: number; texto: string; dica: string }[]; max?: number }) {
  const topo = max ?? Math.max(1, ...itens.map((i) => i.valor));
  const [sel, setSel] = useState<string | null>(null);
  return (
    <ul className="viz-bars">
      {itens.map((it) => (
        <li key={it.id} tabIndex={0} onPointerEnter={() => setSel(it.id)} onPointerLeave={() => setSel(null)} onFocus={() => setSel(it.id)} onBlur={() => setSel(null)}
          aria-label={`${it.rotulo}: ${it.texto}. ${it.dica}`} className={sel === it.id ? "on" : undefined}>
          <div className="lbl"><span className="truncate">{it.rotulo}</span>{it.sub ? <small className="muted truncate">{it.sub}</small> : null}</div>
          <div className="track">
            <span className="vbar" style={{ width: `${Math.max(1, (it.valor / topo) * 100)}%` }} />
            <span className="val num" style={{ left: `calc(${Math.max(1, (it.valor / topo) * 100)}% + 6px)` }}>{it.texto}</span>
          </div>
          {sel === it.id ? <div className="viz-tip inline" role="status"><div className="v">{it.texto}</div><div className="k">{it.dica}</div></div> : null}
        </li>
      ))}
    </ul>
  );
}

