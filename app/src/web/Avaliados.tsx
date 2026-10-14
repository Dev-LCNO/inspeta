// S21 — Avaliados (lista, cadastro e edição) · S22 — Campos personalizados · S23 Importar (ImportarAvaliados)
import { useEffect, useMemo, useState } from "react";
import { campoVisivel, validarDefinicaoCampos } from "../data/camposAvaliado";
import { server } from "../data/server";
import type { Avaliado, CampoAvaliado, Membro } from "../data/types";
import { baixar } from "../pdf";
import { gerarCsv } from "../planilha";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, ButtonLink, Callout, Dialog, EmptyState, ErrorState, PageHeader, SkeletonRows, Switch, Tabs, TextField, useToast } from "../ui/primitives";
import { useRoute } from "../ui/router";

type Dados = { nome: string; codigo_externo: string; documento: string; email: string; endereco: string; campos: Record<string, string> };
const vazio = (): Dados => ({ nome: "", codigo_externo: "", documento: "", email: "", endereco: "", campos: {} });
const valorTexto = (c: CampoAvaliado, v?: string) => (!v ? "—" : c.tipo === "data" ? v.split("-").reverse().join("/") : v);

export function Avaliados({ me }: { me: Membro }) {
  const r = useRoute();
  const aba = r.query.get("aba") ?? "lista";
  const toast = useToast();
  const lista = useData(() => server.listarAvaliados(), [], ["avaliados"]);
  const campos = useData(() => server.listarCamposAvaliado(), [], ["avaliados"]);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Avaliado | "novo" | null>(null);
  const [dados, setDados] = useState<Dados>(vazio());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const cs = campos.data ?? [];
  const colunas = cs.filter((c) => c.na_lista);
  const listas = cs.filter((c) => c.tipo === "lista" && c.na_lista);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.data ?? []).filter((a) => (!q || [a.nome, a.codigo_externo, a.endereco, ...Object.values(a.campos ?? {})].join(" ").toLowerCase().includes(q))
      && Object.entries(filtros).every(([k, v]) => !v || a.campos?.[k] === v));
  }, [lista.data, busca, filtros]);

  function abrir(a: Avaliado | "novo") {
    setErro(null);
    setDados(a === "novo" ? vazio() : { nome: a.nome, codigo_externo: a.codigo_externo ?? "", documento: a.documento ?? "", email: a.email ?? "", endereco: a.endereco ?? "", campos: { ...(a.campos ?? {}) } });
    setEditando(a);
  }
  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const a = await server.salvarAvaliado(editando === "novo" ? null : editando!.id, {
        nome: dados.nome, codigo_externo: dados.codigo_externo.trim() || undefined, documento: dados.documento.trim() || undefined,
        email: dados.email.trim() || undefined, endereco: dados.endereco.trim() || undefined, campos: dados.campos,
      });
      setEditando(null);
      toast({ tone: "info", text: editando === "novo" ? `${a.nome} cadastrado.` : `${a.nome} atualizado.` });
    } catch (e) { setErro((e as Error).message); }
    finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader title="Avaliados" desc="Lojas, setores, fornecedores ou docas que passam por inspeção."
        actions={<>
          <Button variant="secondary" icon="download" disabled={!lista.data?.length} onClick={() => baixar(gerarCsv([
            ["Nome", "Código", "CNPJ", "E-mail", "Telefone", "Endereço", ...cs.map((c) => c.nome)],
            ...(lista.data ?? []).map((a) => [a.nome, a.codigo_externo, a.documento, a.email, a.telefone, a.endereco, ...cs.map((c) => (a.campos?.[c.id] ? valorTexto(c, a.campos[c.id]) : ""))]),
          ]), "avaliados.csv", "text/csv;charset=utf-8")}>Exportar</Button>
          <ButtonLink to="/web/avaliados/importar" variant="secondary" icon="upload">Importar planilha</ButtonLink>
          <Button icon="plus" onClick={() => abrir("novo")}>Novo avaliado</Button>
        </>} />
      <Tabs items={[
        { to: "/web/avaliados", label: "Lista", current: aba === "lista", icon: "list" },
        { to: "/web/avaliados?aba=campos", label: `Campos${cs.length ? ` (${cs.length})` : ""}`, current: aba === "campos", icon: "edit" },
      ]} />
      {aba === "campos" ? <EditorCampos me={me} campos={campos.data} />
        : lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows rows={4} cols={4} />
        : !lista.data.length ? (
          <div className="card flat"><EmptyState icon="store" title="Nenhum avaliado ainda" text="Cadastre as lojas ou setores que serão inspecionados." action={<Button icon="plus" onClick={() => abrir("novo")}>Novo avaliado</Button>} /></div>
        ) : (
          <>
            <div className="filterbar" role="search">
              <div className="field search"><label htmlFor="b-av">Buscar</label>
                <div className="searchbox"><Icon n="search" /><input id="b-av" className="input" style={{ height: 40 }} value={busca} placeholder="Nome, código, endereço ou campo"
                  onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div></div>
              {listas.map((c) => (
                <div key={c.id} className="field"><label htmlFor={"f-" + c.id}>{c.nome}</label>
                  <select id={"f-" + c.id} className="select" value={filtros[c.id] ?? ""} onChange={(e: { target: { value: string } }) => setFiltros({ ...filtros, [c.id]: e.target.value })}>
                    <option value="">Todos</option>{(c.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
                  </select></div>
              ))}
            </div>
            {!filtrados.length ? <div className="card flat"><EmptyState icon="search" title="Nenhum avaliado com esse filtro" /></div> : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Avaliados</caption>
                  <thead><tr><th>Nome</th><th>Código</th>{colunas.map((c) => <th key={c.id}>{c.nome}</th>)}<th>E-mail</th><th>Endereço</th><th>Cadastrado</th></tr></thead>
                  <tbody>{filtrados.map((a) => (
                    <tr key={a.id}>
                      <td><button type="button" className="linklike rowlink" onClick={() => abrir(a)} title="Editar">{a.nome}</button></td>
                      <td className="mono">{a.codigo_externo ?? "—"}</td>
                      {colunas.map((c) => <td key={c.id}>{valorTexto(c, a.campos?.[c.id])}</td>)}
                      <td className="muted">{a.email ?? "—"}</td><td className="muted">{a.endereco ?? "—"}</td><td className="num muted">{fmt.data(a.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

      <Dialog open={!!editando} onClose={() => setEditando(null)} title={editando === "novo" ? "Novo avaliado" : "Editar avaliado"}
        footer={<><Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button><Button loading={salvando} onClick={() => void salvar()}>{editando === "novo" ? "Cadastrar" : "Salvar"}</Button></>}>
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void salvar(); }}>
          <TextField label="Nome" required value={dados.nome} onChange={(v) => setDados({ ...dados, nome: v })} autoFocus />
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="grow"><TextField label="Código" help="Código da loja no seu sistema" value={dados.codigo_externo} onChange={(v) => setDados({ ...dados, codigo_externo: v })} /></div>
            <div className="grow"><TextField label="CNPJ" value={dados.documento} onChange={(v) => setDados({ ...dados, documento: v })} inputMode="numeric" /></div>
          </div>
          <TextField label="E-mail" type="email" help="Recebe o relatório, se o formulário pedir" value={dados.email} onChange={(v) => setDados({ ...dados, email: v })} />
          <TextField label="Endereço" value={dados.endereco} onChange={(v) => setDados({ ...dados, endereco: v })} />
          {cs.length ? <div className="label" style={{ marginBottom: -8 }}>Campos da sua empresa</div> : null}
          {cs.filter((c) => campoVisivel(c, dados.campos)).map((c) => {
            const set = (v: string) => setDados({ ...dados, campos: { ...dados.campos, [c.id]: v } });
            const v = dados.campos[c.id] ?? "";
            return c.tipo === "lista" ? (
              <div key={c.id} className="field"><label htmlFor={"cf-" + c.id}>{c.nome}{c.obrigatorio ? " *" : ""}</label>
                <select id={"cf-" + c.id} className="select" value={v} onChange={(e: { target: { value: string } }) => set(e.target.value)}>
                  <option value="">—</option>{(c.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
                </select></div>
            ) : <TextField key={c.id} label={c.nome + (c.obrigatorio ? " *" : "")} value={v} onChange={set}
                type={c.tipo === "data" ? "date" : "text"} inputMode={c.tipo === "numero" ? "decimal" : undefined}
                help={c.depende_de ? `Aparece porque ${cs.find((x) => x.id === c.depende_de!.campo_id)?.nome} é ${c.depende_de.valor}` : undefined} />;
          })}
          {erro ? <Callout tone="danger" icon="alert">{erro}</Callout> : null}
          <button type="submit" hidden />
        </form>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// S22 — editor de campos
// ---------------------------------------------------------------------------

const TIPOS: { v: CampoAvaliado["tipo"]; l: string }[] = [{ v: "texto", l: "Texto" }, { v: "lista", l: "Lista de opções" }, { v: "numero", l: "Número" }, { v: "data", l: "Data" }];

function EditorCampos({ me, campos }: { me: Membro; campos: CampoAvaliado[] | undefined }) {
  const toast = useToast();
  const [cs, setCs] = useState<CampoAvaliado[] | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (campos && !sujo) setCs(campos); }, [campos]);
  if (!cs) return <SkeletonRows rows={3} cols={3} />;
  const problemas = validarDefinicaoCampos(cs);
  const set = (k: number, p: Partial<CampoAvaliado>) => { setCs(cs.map((c, i) => (i === k ? { ...c, ...p } : c))); setSujo(true); };
  const mover = (k: number, d: number) => { const n = [...cs]; const [x] = n.splice(k, 1); n.splice(k + d, 0, x!); setCs(n); setSujo(true); };

  async function salvar() {
    setSalvando(true);
    try { setCs(await server.salvarCamposAvaliado(me, cs!)); setSujo(false); toast({ tone: "info", text: "Campos salvos." }); }
    catch (e) { toast({ tone: "error", text: (e as Error).message }); }
    finally { setSalvando(false); }
  }

  return (
    <div className="stack" style={{ maxWidth: "var(--layout-form-max)" }}>
      <div className="row-between">
        <p className="muted" style={{ margin: 0 }}>Informações da sua empresa sobre cada avaliado: regional, formato, gerente. Aparecem no cadastro, na importação e como filtro na lista.</p>
        <div className="row">{sujo ? <Badge tone="warn" icon="edit">Alterações não salvas</Badge> : null}
          <Button icon="check" loading={salvando} disabled={!sujo || problemas.length > 0} onClick={() => void salvar()}>Salvar campos</Button></div>
      </div>
      {problemas.length ? <Callout tone="danger" icon="alert"><ul style={{ margin: 0, paddingLeft: 18 }}>{problemas.map((p) => <li key={p}>{p}</li>)}</ul></Callout> : null}
      {cs.map((c, k) => {
        const listasAnteriores = cs.filter((x) => x.id !== c.id && x.tipo === "lista");
        return (
          <section key={c.id} className="card stack-sm" aria-label={`Campo ${c.nome || k + 1}`}>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="grow"><TextField label="Nome do campo" value={c.nome} onChange={(v) => set(k, { nome: v })} /></div>
              <div className="field" style={{ width: 180 }}><label htmlFor={"tp-" + c.id}>Tipo</label>
                <select id={"tp-" + c.id} className="select" value={c.tipo} onChange={(e: { target: { value: string } }) => set(k, { tipo: e.target.value as CampoAvaliado["tipo"], opcoes: e.target.value === "lista" ? c.opcoes ?? ["", ""] : undefined })}>
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select></div>
              <Button variant="ghost" size="sm" icon="up" label={`Subir ${c.nome}`} disabled={k === 0} onClick={() => mover(k, -1)} />
              <Button variant="ghost" size="sm" icon="down" label={`Descer ${c.nome}`} disabled={k === cs.length - 1} onClick={() => mover(k, 1)} />
              <Button variant="ghost" size="sm" icon="trash" label={`Excluir ${c.nome}`} onClick={() => { setCs(cs.filter((_, i) => i !== k).map((x) => (x.depende_de?.campo_id === c.id ? { ...x, depende_de: null } : x))); setSujo(true); }} />
            </div>
            {c.tipo === "lista" ? (
              <TextField label="Opções" help="Uma por linha" multiline rows={3} value={(c.opcoes ?? []).join("\n")} onChange={(v) => set(k, { opcoes: v.split("\n") })} />
            ) : null}
            <div className="row" style={{ gap: "var(--space-5)" }}>
              <label className="check"><input type="checkbox" checked={c.obrigatorio} onChange={(e: { target: { checked: boolean } }) => set(k, { obrigatorio: e.target.checked })} />Obrigatório</label>
              <label className="check"><input type="checkbox" checked={c.na_lista} onChange={(e: { target: { checked: boolean } }) => set(k, { na_lista: e.target.checked })} />Mostrar na lista{c.tipo === "lista" ? " e filtrar" : ""}</label>
            </div>
            {listasAnteriores.length ? (
              <div className="row" style={{ gap: 6, fontSize: "var(--text-sm)" }}>
                <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={!!c.depende_de}
                  onChange={(e: { target: { checked: boolean } }) => set(k, { depende_de: e.target.checked ? { campo_id: listasAnteriores[0]!.id, valor: listasAnteriores[0]!.opcoes?.[0] ?? "" } : null })} />Só mostrar quando</label>
                {c.depende_de ? <>
                  <select className="select" style={{ width: "auto", height: 34 }} aria-label={`Campo que libera ${c.nome}`} value={c.depende_de.campo_id}
                    onChange={(e: { target: { value: string } }) => { const a = cs.find((x) => x.id === e.target.value)!; set(k, { depende_de: { campo_id: a.id, valor: a.opcoes?.[0] ?? "" } }); }}>
                    {listasAnteriores.map((x) => <option key={x.id} value={x.id}>{x.nome || "(sem nome)"}</option>)}
                  </select>
                  <span className="muted">for</span>
                  <select className="select" style={{ width: "auto", height: 34 }} aria-label={`Valor que libera ${c.nome}`} value={c.depende_de.valor}
                    onChange={(e: { target: { value: string } }) => set(k, { depende_de: { ...c.depende_de!, valor: e.target.value } })}>
                    {(cs.find((x) => x.id === c.depende_de!.campo_id)?.opcoes ?? []).filter(Boolean).map((o) => <option key={o}>{o}</option>)}
                  </select>
                </> : null}
              </div>
            ) : null}
          </section>
        );
      })}
      <div><Button variant="secondary" icon="plus" onClick={() => { setCs([...cs, { id: crypto.randomUUID(), nome: "", tipo: "texto", obrigatorio: false, na_lista: false, ordem: cs.length + 1 }]); setSujo(true); }}>Novo campo</Button></div>
    </div>
  );
}
