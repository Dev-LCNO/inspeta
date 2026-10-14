// S13 — Formulários
import { useState } from "react";
import { server } from "../data/server";
import { fmt } from "../ui/format";
import { useData } from "../ui/hooks";
import { Badge, Button, ButtonLink, Dialog, EmptyState, ErrorState, PageHeader, SkeletonRows, TextField } from "../ui/primitives";
import { Link, navigate } from "../ui/router";

export function Formularios() {
  const lista = useData(() => server.listarFormularios(), [], ["formularios", "inspecoes"]);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      const f = await server.criarFormulario(nome);
      setNovo(false);
      navigate("/web/formularios/" + f.id);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <>
      <PageHeader title="Formulários" desc="Os checklists que sua equipe aplica. Edite à vontade: só vale para o campo depois de publicar."
        actions={<>
          <ButtonLink to="/web/formularios/importar" variant="secondary" icon="upload">Importar planilha</ButtonLink>
          <Button icon="plus" onClick={() => { setNome(""); setErro(null); setNovo(true); }}>Novo formulário</Button>
        </>} />

      {lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows rows={3} cols={5} />
        : !lista.data.length ? (
          <div className="card flat"><EmptyState icon="file" title="Nenhum formulário ainda" text="Crie o primeiro para começar a inspecionar."
            action={<Button icon="plus" onClick={() => setNovo(true)}>Novo formulário</Button>} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Formulários</caption>
              <thead><tr><th>Nome</th><th>Versão no campo</th><th className="r">Questões</th><th className="r">Inspeções</th><th>Editado</th></tr></thead>
              <tbody>
                {lista.data.map((f) => (
                  <tr key={f.id} onClick={() => navigate("/web/formularios/" + f.id)} style={{ cursor: "pointer" }}>
                    <td><Link to={"/web/formularios/" + f.id} className="rowlink" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>{f.nome}</Link></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {f.versao_numero ? <span className="num">v{f.versao_numero}</span> : <Badge tone="na" icon="minus">Nunca publicado</Badge>}
                        {f.versao_numero && f.tem_alteracoes ? <Badge tone="warn" icon="edit">Alterações não publicadas</Badge> : null}
                      </div>
                    </td>
                    <td className="r num">{f.qtd_questoes}</td>
                    <td className="r num">{f.qtd_inspecoes}</td>
                    <td className="num muted">{fmt.dataHora(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Dialog open={novo} onClose={() => setNovo(false)} title="Novo formulário"
        footer={<><Button variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button><Button loading={criando} onClick={criar}>Criar e editar</Button></>}>
        <form onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void criar(); }}>
          <TextField label="Nome" value={nome} onChange={setNome} error={erro} help="Ex.: Abertura de loja, Recebimento de FLV, Auditoria de câmara fria" autoFocus />
        </form>
      </Dialog>
    </>
  );
}
