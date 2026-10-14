// S32 — Aprovações: o que espera a minha decisão e o que eu já decidi.
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Badge, EmptyState, ErrorState, PageHeader, ScoreInline, SkeletonRows, StatusBadge, Tabs } from "../ui/primitives";
import { Link, navigate, useRoute } from "../ui/router";

export function Aprovacoes({ me }: { me: Membro }) {
  const r = useRoute();
  const aba = r.query.get("aba") === "decididas" ? "decididas" : "pendentes";
  const pend = useData(() => server.aprovacoesPendentes(me), [me.id], ["inspecoes"]);
  const feitas = useData(() => server.decisoesDe(me), [me.id], ["inspecoes"]);
  return (
    <>
      <PageHeader title="Aprovações" desc="Inspeções que esperam a sua decisão. Abra para ver as respostas, fotos e a nota antes de decidir." />
      <Tabs items={[
        { to: "/web/aprovacoes", label: `Esperando você${pend.data?.length ? ` (${pend.data.length})` : ""}`, current: aba === "pendentes", icon: "stamp" },
        { to: "/web/aprovacoes?aba=decididas", label: "Já decididas", current: aba === "decididas", icon: "history" },
      ]} />
      {aba === "pendentes" ? (
        pend.status === "error" ? <ErrorState error={pend.error} onRetry={pend.reload} />
          : !pend.data ? <SkeletonRows cols={6} />
          : !pend.data.length ? <div className="card flat"><EmptyState icon="stamp" title="Nada esperando a sua decisão" text="Quando uma inspeção chegar na sua etapa, ela aparece aqui e você recebe um e-mail." /></div>
          : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Inspeções esperando aprovação</caption>
                <thead><tr><th>Avaliado</th><th>Formulário</th><th>Aplicada por</th><th>Finalizada</th><th className="r">Nota</th><th>Etapa</th></tr></thead>
                <tbody>{pend.data.map((i) => (
                  <tr key={i.id} onClick={() => navigate("/web/inspecoes/" + i.id)} style={{ cursor: "pointer" }}>
                    <td><Link to={"/web/inspecoes/" + i.id} className="rowlink" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>{i.avaliado}</Link></td>
                    <td>{i.formulario}</td>
                    <td>{i.responsavel}</td>
                    <td className="num">{fmt.dataHora(i.finalizada_em)}</td>
                    <td className="r"><ScoreInline pct={i.nota_pct} classificacao={i.classificacao} cor={i.classificacao_cor} /></td>
                    <td><Badge tone="acc" icon="stamp">{i.aprovacao_etapa} de {i.etapas}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
      ) : feitas.status === "error" ? <ErrorState error={feitas.error} onRetry={feitas.reload} />
        : !feitas.data ? <SkeletonRows cols={5} />
        : !feitas.data.length ? <div className="card flat"><EmptyState icon="history" title="Você ainda não decidiu nenhuma" /></div>
        : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Decisões tomadas por você</caption>
              <thead><tr><th>Avaliado</th><th>Formulário</th><th>Sua decisão</th><th>Comentário</th><th>Quando</th><th>Situação agora</th></tr></thead>
              <tbody>{feitas.data.map((a) => (
                <tr key={a.id}>
                  <td><Link to={"/web/inspecoes/" + a.inspecao_id} className="rowlink">{a.avaliado}</Link></td>
                  <td>{a.formulario}</td>
                  <td>{a.decisao === "aprovada" ? <Badge tone="ok" icon="check">Aprovou · etapa {a.etapa}</Badge> : <Badge tone="nc" icon="x">Reprovou · etapa {a.etapa}</Badge>}</td>
                  <td className="muted">{a.comentario ?? "—"}</td>
                  <td className="num">{fmt.dataHora(a.em)}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </>
  );
}
