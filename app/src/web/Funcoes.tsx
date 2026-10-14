// S31 — Funções: matriz ações × funções. Cada marcação salva na hora.
import { useState } from "react";
import { server } from "../data/server";
import type { Acao, Funcao, Membro } from "../data/types";
import { useData } from "../ui/hooks";
import { Button, Callout, Dialog, ErrorState, PageHeader, SkeletonRows, TextField, useToast } from "../ui/primitives";
import { ACOES_INFO } from "./acoes";

type FuncaoN = Funcao & { qtd_pessoas: number };

export function Funcoes({ me }: { me: Membro }) {
  const toast = useToast();
  const d = useData(() => server.listarFuncoes(), [], ["membros"]);
  const [nova, setNova] = useState<{ nome: string; base: string } | null>(null);
  const [editando, setEditando] = useState<FuncaoN | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function alternar(f: FuncaoN, a: Acao, on: boolean) {
    try {
      await server.salvarFuncao(me, { id: f.id, nome: f.nome, acoes: on ? [...f.acoes, a] : f.acoes.filter((x) => x !== a) });
    } catch (e) { toast({ tone: "error", text: (e as Error).message }); }
  }
  async function criar() {
    if (!nova) return;
    setOcupado(true); setErro(null);
    try { const f = await server.criarFuncao(me, nova.nome, nova.base || undefined); setNova(null); toast({ tone: "info", text: `Função ${f.nome} criada.` }); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  async function renomear() {
    if (!editando) return;
    setOcupado(true); setErro(null);
    try { await server.salvarFuncao(me, { ...editando, nome }); setEditando(null); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  async function excluir() {
    if (!editando) return;
    setOcupado(true); setErro(null);
    try { await server.excluirFuncao(me, editando.id); toast({ tone: "info", text: `Função ${editando.nome} excluída.` }); setEditando(null); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  return (
    <>
      <PageHeader title="Funções" desc="O que cada cargo pode fazer. Quais formulários e avaliados cada pessoa alcança fica em Permissões."
        actions={<Button icon="plus" onClick={() => { setErro(null); setNova({ nome: "", base: "" }); }}>Nova função</Button>} />
      {d.status === "error" ? <ErrorState error={d.error} onRetry={d.reload} />
        : !d.data ? <SkeletonRows rows={8} cols={4} />
        : (
          <div className="stack">
            <div className="table-wrap">
              <table className="table matrix">
                <caption className="sr-only">Ações permitidas por função</caption>
                <thead><tr>
                  <th scope="col">Ação</th>
                  {d.data.map((f) => (
                    <th key={f.id} scope="col" className="fn">
                      <div style={{ color: "var(--c-text)", fontSize: "var(--text-sm)" }}>{f.nome}</div>
                      <div style={{ fontWeight: 400 }}>{f.qtd_pessoas} {f.qtd_pessoas === 1 ? "pessoa" : "pessoas"}</div>
                      {f.sistema ? <div style={{ fontWeight: 400, marginTop: "var(--space-2)" }}>fixa</div> : <Button variant="ghost" size="sm" icon="edit" label={`Renomear ou excluir ${f.nome}`}
                        onClick={() => { setErro(null); setNome(f.nome); setEditando(f); }} />}
                    </th>
                  ))}
                </tr></thead>
                <tbody>{ACOES_INFO.map((a) => (
                  <tr key={a.acao}>
                    <td className="acao"><span style={{ fontWeight: 600 }}>{a.nome}</span><small>{a.desc}</small></td>
                    {d.data!.map((f) => (
                      <td key={f.id} className="c">
                        <label><input type="checkbox" aria-label={`${f.nome}: ${a.nome}`} checked={f.acoes.includes(a.acao)} disabled={f.sistema}
                          onChange={(e: { target: { checked: boolean } }) => void alternar(f, a.acao, e.target.checked)} /></label>
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Callout icon="info">Administrador tem todas as ações e não muda. Mudanças valem na hora para quem tem a função, inclusive no próximo sincronismo do app de campo.</Callout>
          </div>
        )}

      <Dialog open={!!nova} onClose={() => setNova(null)} title="Nova função"
        footer={<><Button variant="secondary" onClick={() => setNova(null)}>Cancelar</Button><Button loading={ocupado} onClick={criar}>Criar</Button></>}>
        {nova ? (
          <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void criar(); }}>
            <TextField label="Nome" required autoFocus value={nova.nome} onChange={(v) => setNova({ ...nova, nome: v })} error={erro} placeholder="Ex.: Auditor externo" />
            <div className="field"><label htmlFor="fn-base">Começar com as ações de</label>
              <select id="fn-base" className="select" value={nova.base} onChange={(e: { target: { value: string } }) => setNova({ ...nova, base: e.target.value })}>
                <option value="">Só aplicar inspeções</option>
                {(d.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select></div>
            <button type="submit" hidden />
          </form>
        ) : null}
      </Dialog>

      <Dialog open={!!editando} onClose={() => setEditando(null)} title={editando ? `Função ${editando.nome}` : ""}
        footer={<><Button variant="danger" icon="trash" loading={ocupado} onClick={excluir}>Excluir</Button><div className="grow" /><Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button><Button loading={ocupado} onClick={renomear}>Salvar nome</Button></>}>
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void renomear(); }}>
          <TextField label="Nome" required autoFocus value={nome} onChange={setNome} error={erro} />
          {editando?.qtd_pessoas ? <p className="muted" style={{ margin: 0 }}>Só dá para excluir depois de trocar a função das {editando.qtd_pessoas} pessoa(s) que a usam.</p> : null}
          <button type="submit" hidden />
        </form>
      </Dialog>
    </>
  );
}
