// S21 — Avaliados · S22 Campos (marco 3) · S23 Importar (marco 2)
import { useMemo, useState } from "react";
import { server } from "../data/server";
import { baixar } from "../pdf";
import { gerarCsv } from "../planilha";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Button, ButtonLink, Dialog, EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs, TextField, useToast } from "../ui/primitives";
import { useRoute } from "../ui/router";

export function Avaliados() {
  const r = useRoute();
  const aba = r.query.get("aba") ?? "lista";
  const toast = useToast();
  const lista = useData(() => server.listarAvaliados(), [], ["avaliados"]);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [dados, setDados] = useState({ nome: "", codigo_externo: "", documento: "", email: "", endereco: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.data ?? []).filter((a) => !q || [a.nome, a.codigo_externo, a.endereco].join(" ").toLowerCase().includes(q));
  }, [lista.data, busca]);

  async function criar() {
    setSalvando(true); setErro(null);
    try {
      const a = await server.criarAvaliado({
        nome: dados.nome, codigo_externo: dados.codigo_externo.trim() || undefined, documento: dados.documento.trim() || undefined,
        email: dados.email.trim() || undefined, endereco: dados.endereco.trim() || undefined,
      });
      setNovo(false);
      toast({ tone: "info", text: `${a.nome} cadastrado.` });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <PageHeader title="Avaliados" desc="Lojas, setores, fornecedores ou docas que passam por inspeção."
        actions={<>
          <Button variant="secondary" icon="download" disabled={!lista.data?.length} onClick={() => baixar(gerarCsv([
            ["Nome", "Código", "CNPJ", "E-mail", "Telefone", "Endereço"],
            ...(lista.data ?? []).map((a) => [a.nome, a.codigo_externo, a.documento, a.email, a.telefone, a.endereco]),
          ]), "avaliados.csv", "text/csv;charset=utf-8")}>Exportar</Button>
          <ButtonLink to="/web/avaliados/importar" variant="secondary" icon="upload">Importar planilha</ButtonLink>
          <Button icon="plus" onClick={() => { setDados({ nome: "", codigo_externo: "", documento: "", email: "", endereco: "" }); setErro(null); setNovo(true); }}>Novo avaliado</Button>
        </>} />
      <Tabs items={[
        { to: "/web/avaliados", label: "Lista", current: aba === "lista", icon: "list" },
        { to: "/web/avaliados?aba=campos", label: "Campos", current: aba === "campos", icon: "edit" },
      ]} />
      {aba === "campos" ? (
        <div className="card flat"><EmptyState icon="edit" title="Campos personalizados chegam no marco 3" text="Crie campos próprios (regional, bandeira, gerente), marque obrigatórios e escolha quais aparecem na lista." /></div>
      ) : lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows rows={4} cols={4} />
        : !lista.data.length ? (
          <div className="card flat"><EmptyState icon="store" title="Nenhum avaliado ainda" text="Cadastre as lojas ou setores que serão inspecionados." action={<Button icon="plus" onClick={() => setNovo(true)}>Novo avaliado</Button>} /></div>
        ) : (
          <>
            <div className="filterbar" role="search">
              <div className="field search"><label htmlFor="b-av">Buscar</label>
                <div className="searchbox"><Icon n="search" /><input id="b-av" className="input" style={{ height: 40 }} value={busca} placeholder="Nome, código ou endereço"
                  onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div></div>
            </div>
            {!filtrados.length ? <div className="card flat"><EmptyState icon="search" title="Nenhum avaliado com esse termo" /></div> : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Avaliados</caption>
                  <thead><tr><th>Nome</th><th>Código</th><th>E-mail</th><th>Endereço</th><th>Cadastrado</th></tr></thead>
                  <tbody>{filtrados.map((a) => (
                    <tr key={a.id}><td style={{ fontWeight: 600 }}>{a.nome}</td><td className="mono">{a.codigo_externo ?? "—"}</td><td className="muted">{a.email ?? "—"}</td><td className="muted">{a.endereco ?? "—"}</td><td className="num muted">{fmt.data(a.created_at)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

      <Dialog open={novo} onClose={() => setNovo(false)} title="Novo avaliado"
        footer={<><Button variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button><Button loading={salvando} onClick={criar}>Cadastrar</Button></>}>
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void criar(); }}>
          <TextField label="Nome" required value={dados.nome} onChange={(v) => setDados({ ...dados, nome: v })} error={erro} autoFocus />
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="grow"><TextField label="Código" help="Código da loja no seu sistema" value={dados.codigo_externo} onChange={(v) => setDados({ ...dados, codigo_externo: v })} /></div>
            <div className="grow"><TextField label="CNPJ" value={dados.documento} onChange={(v) => setDados({ ...dados, documento: v })} inputMode="numeric" /></div>
          </div>
          <TextField label="E-mail" type="email" help="Recebe o relatório, se o formulário pedir" value={dados.email} onChange={(v) => setDados({ ...dados, email: v })} />
          <TextField label="Endereço" value={dados.endereco} onChange={(v) => setDados({ ...dados, endereco: v })} />
          <button type="submit" hidden />
        </form>
      </Dialog>
    </>
  );
}
