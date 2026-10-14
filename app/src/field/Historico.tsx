// M08 — Minhas inspeções neste aparelho
import { device, type EstadoLocal } from "../data/device";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { Badge, Button, EmptyState, ScoreInline, SkeletonBlock, useToast } from "../ui/primitives";
import { Link } from "../ui/router";
import { TopBar, useAparelho } from "./FieldApp";

const ESTADO: Record<EstadoLocal, { tone: "na" | "warn" | "acc" | "ok" | "nc"; txt: string; icon: "edit" | "cloudOff" | "refresh" | "check" | "alert" }> = {
  rascunho: { tone: "na", txt: "Rascunho", icon: "edit" },
  na_fila: { tone: "warn", txt: "Aguardando envio", icon: "cloudOff" },
  enviando: { tone: "acc", txt: "Enviando", icon: "refresh" },
  enviada: { tone: "ok", txt: "Enviada", icon: "check" },
  erro: { tone: "nc", txt: "Erro no envio", icon: "alert" },
};

export function Historico({ me }: { me: Membro }) {
  const ap = useAparelho(me);
  const toast = useToast();
  const s = ap.data;
  const nomeAv = new Map((s?.pacote?.avaliados ?? []).map((a) => [a.id, a.nome]));
  return (
    <>
      <TopBar me={me} title="Minhas inspeções" sub="Neste aparelho" back="/campo" />
      <main className="f-body">
        {!s ? <SkeletonBlock h={240} /> : !s.inspecoes.length ? (
          <EmptyState icon="history" title="Nenhuma inspeção neste aparelho" text="As inspeções enviadas ficam aqui por 7 dias. O histórico completo está no painel web."
            action={<Link to="/campo/nova" className="btn primary lg">Nova inspeção</Link>} />
        ) : (
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {s.inspecoes.map((i) => {
              const e = ESTADO[i.estado];
              const corpo = (
                <>
                  <div className="row-between"><b className="truncate">{nomeAv.get(i.avaliado_id) ?? "Avaliado"}</b><Badge tone={e.tone} icon={e.icon}>{e.txt}</Badge></div>
                  <span className="muted">{i.nome_formulario}</span>
                  <div className="row-between">
                    <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>{i.finalizada_em ? `Finalizada ${fmt.dataHora(i.finalizada_em)}` : `Começou ${fmt.dataHora(i.iniciada_em)}`}</span>
                    {i.estado === "enviada" ? <ScoreInline pct={i.nota_servidor ?? null} classificacao={i.classificacao_servidor} cor={i.definicao.config.classificacoes?.find((c) => c.nome === i.classificacao_servidor)?.cor} /> : null}
                  </div>
                  {i.erro ? <span style={{ color: "var(--c-danger)", fontSize: "var(--text-xs)" }}>{i.erro}</span> : null}
                </>
              );
              return (
                <li key={i.client_uuid}>
                  {i.estado === "rascunho"
                    ? <div className="list-card">
                        <Link to={"/campo/aplicar/" + i.client_uuid} className="stack-sm" style={{ color: "inherit", textDecoration: "none", gap: 6 }}>{corpo}</Link>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <Button variant="ghost" size="sm" icon="trash" onClick={async () => { if (confirm("Descartar este rascunho? As respostas e fotos serão apagadas do aparelho.")) { await device.descartar(me.id, i.client_uuid); toast({ tone: "info", text: "Rascunho descartado." }); } }}>Descartar</Button>
                          <Link to={"/campo/aplicar/" + i.client_uuid} className="btn primary sm">Continuar</Link>
                        </div>
                      </div>
                    : <div className="list-card">{corpo}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
