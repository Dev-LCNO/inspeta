// E-mails (simulação): o que o Resend enviaria. Some quando o backend real entrar.
import { server } from "../data/server";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Callout, EmptyState, ErrorState, PageHeader, SkeletonRows } from "../ui/primitives";

export function CaixaSaida() {
  const l = useData(() => server.caixaDeSaida(), [], ["planos", "inspecoes", "membros"]);
  return (
    <>
      <PageHeader title="E-mails enviados" desc="Relatórios e links de plano de ação que o sistema mandou." />
      <div style={{ marginBottom: "var(--space-4)" }}><Callout tone="info">Ambiente de demonstração: nenhum e-mail sai de verdade. Com o backend ligado, estes envios passam pelo provedor de e-mail.</Callout></div>
      {l.status === "error" ? <ErrorState error={l.error} onRetry={l.reload} />
        : !l.data ? <SkeletonRows rows={3} cols={3} />
        : !l.data.length ? <div className="card flat"><EmptyState icon="mail" title="Nenhum e-mail ainda" text="Finalize uma inspeção com não conformidade para ver o plano de ação e o relatório saindo." /></div>
        : (
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {l.data.map((e) => (
              <li key={e.id} className="card flat stack-sm" style={{ padding: "var(--space-4)" }}>
                <div className="row-between">
                  <b>{e.assunto}</b>
                  <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>{fmt.dataHoraCompleta(e.criado_em)}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Icon n="mail" size="sm" />
                  {e.para ? <span>Para <b>{e.para}</b></span> : <Badge tone="warn" icon="alert">Sem destinatário</Badge>}
                  {e.anexo ? <Badge tone="na" icon="file">PDF do relatório</Badge> : null}
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-line" }} className="muted">{e.texto}</p>
                {e.link ? <a className="btn secondary sm" style={{ alignSelf: "flex-start" }} href={e.link} target="_blank" rel="noreferrer"><Icon n="target" />Abrir link do plano</a> : null}
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
