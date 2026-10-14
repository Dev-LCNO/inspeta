// S04 — Histórico de inspeções (filtros na URL) · S05 — Agendamentos (marco 3)
import { useEffect, useMemo, useState } from "react";
import { server } from "../data/server";
import type { InspecaoStatus, Membro } from "../data/types";
import { fmt } from "../ui/format";
import { useData, useDebounced } from "../ui/hooks";
import { Icon } from "../ui/icons";
import {
  Button, ButtonLink, EmptyState, ErrorState, PageHeader, ScoreInline, SkeletonRows, StatusBadge, Tabs,
} from "../ui/primitives";
import { Link, navigate, useRoute, withQuery } from "../ui/router";

export function Inspecoes({ me }: { me: Membro }) {
  const r = useRoute();
  const aba = r.query.get("aba") ?? "historico";
  const [busca, setBusca] = useState(r.query.get("q") ?? "");
  const de = r.query.get("de") ?? "";
  const ate = r.query.get("ate") ?? "";
  const status = (r.query.get("status") ?? "") as InspecaoStatus | "";
  const buscaD = useDebounced(busca);

  const setQ = (patch: Record<string, string>) =>
    navigate(withQuery("/web/inspecoes", { aba: aba === "historico" ? undefined : aba, q: buscaD, de, ate, status, ...patch }), { replace: true });
  useEffect(() => { if (buscaD !== (r.query.get("q") ?? "")) setQ({ q: buscaD }); }, [buscaD]);

  const lista = useData(() => server.listarInspecoes(me, { busca: buscaD, de, ate, status }), [me.id, buscaD, de, ate, status], ["inspecoes"]);
  const refs = useData(async () => {
    const [avs, fs] = await Promise.all([server.listarAvaliados(), server.listarFormularios()]);
    return { av: new Map(avs.map((a) => [a.id, a.nome])), f: new Map(fs.map((f) => [f.id, f.nome])), m: new Map(server.membros().map((m) => [m.id, m.nome])) };
  }, [], ["avaliados", "formularios"]);
  const filtrando = !!(buscaD || de || ate || status);

  const linhas = useMemo(() => {
    const rf = refs.data;
    if (!lista.data || !rf) return null;
    return lista.data.map((i) => ({
      ...i,
      avaliado: rf.av.get(i.avaliado_id) ?? "Avaliado removido",
      formulario: rf.f.get(i.formulario_id) ?? "Formulário removido",
      responsavel: rf.m.get(i.responsavel_id) ?? "—",
    }));
  }, [lista.data, refs.data]);

  return (
    <>
      <PageHeader title="Inspeções" desc="Tudo o que foi aplicado em campo, já com a nota calculada no servidor."
        actions={<ButtonLink to="/campo/nova" icon="plus">Nova inspeção</ButtonLink>} />
      <Tabs items={[
        { to: "/web/inspecoes", label: "Histórico", current: aba === "historico", icon: "history" },
        { to: "/web/inspecoes?aba=agendamentos", label: "Agendamentos", current: aba === "agendamentos", icon: "calendar" },
      ]} />

      {aba === "agendamentos" ? (
        <div className="card flat"><EmptyState icon="calendar" title="Agendamentos chegam no marco 3"
          text="Programe inspeções recorrentes (todo dia, toda segunda e quinta, uma vez por mês) e o aplicador recebe o aviso no celular na hora certa." /></div>
      ) : (
        <>
          <div className="filterbar" role="search">
            <div className="field search">
              <label htmlFor="f-q">Buscar</label>
              <div className="searchbox"><Icon n="search" /><input id="f-q" className="input" style={{ height: 40 }} placeholder="Avaliado, formulário, pessoa ou ID"
                value={busca} onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="f-de">De</label><input id="f-de" type="date" className="input" value={de} onChange={(e: { target: { value: string } }) => setQ({ de: e.target.value })} /></div>
            <div className="field"><label htmlFor="f-ate">Até</label><input id="f-ate" type="date" className="input" value={ate} onChange={(e: { target: { value: string } }) => setQ({ ate: e.target.value })} /></div>
            <div className="field"><label htmlFor="f-st">Status</label>
              <select id="f-st" className="select" value={status} onChange={(e: { target: { value: string } }) => setQ({ status: e.target.value })}>
                <option value="">Todos</option><option value="completa">Completa</option><option value="rascunho">Rascunho</option>
                <option value="em_aprovacao">Em aprovação</option><option value="aprovada">Aprovada</option><option value="reprovada">Reprovada</option>
              </select>
            </div>
            {filtrando ? <Button variant="ghost" onClick={() => { setBusca(""); navigate("/web/inspecoes", { replace: true }); }}>Limpar filtros</Button> : null}
          </div>

          {lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
            : !linhas ? <SkeletonRows cols={7} />
            : !linhas.length ? (
              <div className="card flat">
                {filtrando
                  ? <EmptyState icon="search" title="Nada com esses filtros" text="Tente outro período ou limpe a busca."
                      action={<Button variant="secondary" onClick={() => { setBusca(""); navigate("/web/inspecoes", { replace: true }); }}>Limpar filtros</Button>} />
                  : <EmptyState title="Nenhuma inspeção ainda" text="Quando alguém finalizar uma inspeção no app de campo e sincronizar, ela aparece aqui."
                      action={<ButtonLink to="/campo/nova" icon="plus">Fazer a primeira</ButtonLink>} />}
              </div>
            ) : (
              <>
                <p className="muted" aria-live="polite" style={{ margin: "0 0 var(--space-2)" }}>{linhas.length} {linhas.length === 1 ? "inspeção" : "inspeções"}</p>
                <div className="table-wrap responsive">
                  <table className="table">
                    <caption className="sr-only">Histórico de inspeções</caption>
                    <thead><tr><th>Avaliado</th><th>Formulário</th><th>Responsável</th><th>Finalizada</th><th className="r">Nota</th><th className="r">Não conf.</th><th>Status</th></tr></thead>
                    <tbody>
                      {linhas.map((i) => (
                        <tr key={i.id} onClick={() => navigate("/web/inspecoes/" + i.id)} style={{ cursor: "pointer" }}>
                          <td><Link to={"/web/inspecoes/" + i.id} className="rowlink" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>{i.avaliado}</Link></td>
                          <td>{i.formulario}</td>
                          <td>{i.responsavel}</td>
                          <td className="num">{fmt.dataHora(i.finalizada_em)}</td>
                          <td className="r"><ScoreInline pct={i.nota_pct} classificacao={i.classificacao} cor={i.classificacao_cor} /></td>
                          <td className="r num">{i.status === "rascunho" ? "—" : i.qtd_nao_conformidades ? <span style={{ color: "var(--c-danger)", fontWeight: 600 }}>{i.qtd_nao_conformidades}</span> : "0"}</td>
                          <td><StatusBadge status={i.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cards">
                  {linhas.map((i) => (
                    <Link key={i.id} to={"/web/inspecoes/" + i.id} className="list-card">
                      <div className="row-between"><b className="truncate">{i.avaliado}</b><ScoreInline pct={i.nota_pct} classificacao={i.classificacao} cor={i.classificacao_cor} /></div>
                      <span className="muted">{i.formulario}</span>
                      <div className="row-between"><span className="muted num" style={{ fontSize: "var(--text-xs)" }}>{i.responsavel} · {fmt.dataHora(i.finalizada_em)}</span><StatusBadge status={i.status} /></div>
                    </Link>
                  ))}
                </div>
              </>
            )}
        </>
      )}
    </>
  );
}
