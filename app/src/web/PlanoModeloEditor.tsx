// S25 — Editor de modelo de plano de ação (reaproveita o editor de questões do S14)
import { useEffect, useState } from "react";
import { renumerarFormulas, type FormDefinition } from "@app/form-engine";
import { server } from "../data/server";
import type { PlanoModelo } from "../data/types";
import { useData } from "../ui/hooks";
import { Badge, Button, ErrorState, PageHeader, SkeletonBlock, TextField, useToast } from "../ui/primitives";
import { AbaQuestoes } from "./FormBuilder";

export function PlanoModeloEditor({ id }: { id: string }) {
  const toast = useToast();
  const d = useData(() => server.obterPlanoModelo(id), [id]);
  const [m, setM] = useState<PlanoModelo | null>(null);
  const [sujo, setSujo] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (d.data && !m) { setM(d.data); setSel(d.data.definicao.topicos[0]?.questoes[0]?.key ?? null); } }, [d.data]);

  if (d.status === "error") return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!m) return <div className="stack"><SkeletonBlock h={60} /><SkeletonBlock h={300} /></div>;
  const set = (patch: Partial<PlanoModelo>) => { setM({ ...m, ...patch }); setSujo(true); };
  const edit = (fn: (x: FormDefinition) => void) => { const c = structuredClone(m.definicao); fn(c); renumerarFormulas(m.definicao, c); set({ definicao: c }); };

  async function salvar() {
    setSalvando(true);
    try { setM(await server.salvarPlanoModelo(m!)); setSujo(false); toast({ tone: "info", text: "Modelo salvo. Vale para os próximos planos gerados." }); }
    catch (e) { toast({ tone: "error", text: (e as Error).message }); }
    finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader crumbs={[{ to: "/web/planos?aba=modelos", label: "Planos de ação" }]} title={m.nome || "Modelo sem nome"}
        desc={sujo ? <Badge tone="warn" icon="edit">Alterações não salvas</Badge> : "Planos já gerados guardam a versão do modelo da época."}
        actions={<Button icon="check" loading={salvando} disabled={!sujo} onClick={salvar}>Salvar</Button>} />
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <TextField label="Nome" value={m.nome} onChange={(v) => set({ nome: v })} />
          <TextField label="Prazo para responder (dias)" inputMode="numeric" value={String(m.prazo_dias)}
            onChange={(v) => { const n = Number(v.replace(/\D/g, "")); set({ prazo_dias: Math.max(1, Math.min(90, n || 1)) }); }} />
          <div className="field"><label htmlFor="ag">Links</label>
            <select id="ag" className="select" value={m.agrupamento} onChange={(e: { target: { value: string } }) => set({ agrupamento: e.target.value as PlanoModelo["agrupamento"] })}>
              <option value="por_inspecao">Um link por inspeção (todas as NCs juntas)</option>
              <option value="por_nc">Um link por não conformidade</option>
            </select></div>
          <div className="field"><label htmlFor="dest">Enviar para</label>
            <select id="dest" className="select" value={m.destinatario} onChange={(e: { target: { value: string } }) => set({ destinatario: e.target.value as PlanoModelo["destinatario"] })}>
              <option value="avaliado">E-mail do avaliado</option><option value="fixo">Um e-mail fixo</option>
            </select></div>
          {m.destinatario === "fixo" ? <TextField label="E-mail fixo" type="email" value={m.email_fixo ?? ""} onChange={(v) => set({ email_fixo: v })} placeholder="manutencao@empresa.com.br" /> : null}
        </div>
      </section>
      <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Perguntas que o responsável responde</h2>
      <AbaQuestoes def={m.definicao} edit={edit} sel={sel} setSel={setSel} tipos={["texto", "escolha_simples", "escolha_multipla", "numerica", "data_hora"]} />
    </>
  );
}
