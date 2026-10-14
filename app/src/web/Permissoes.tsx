// S30 — Permissões: pessoas (função + acessos) e equipes (acessos herdados pelos membros).
import { useEffect, useMemo, useState } from "react";
import { resolverMembros } from "../data/acesso";
import { server } from "../data/server";
import type { Acesso, Equipe, ID, Membro, MembroRegistro } from "../data/types";
import { useData } from "../ui/hooks";
import { Icon } from "../ui/icons";
import {
  Badge, Button, Callout, Dialog, EmptyState, ErrorState, PageHeader, SkeletonBlock, SkeletonRows, Switch, Tabs, TextField, useToast,
} from "../ui/primitives";
import { Link, navigate, useRoute } from "../ui/router";

/** Tudo o que as telas de permissão precisam, numa leitura. */
function useBase() {
  return useData(async () => {
    const [pessoas, funcoes, equipes, formularios, avaliados] = await Promise.all([
      server.listarPessoas(), server.listarFuncoes(), server.listarEquipes(), server.listarFormularios(), server.listarAvaliados(),
    ]);
    return { pessoas, funcoes, equipes, formularios, avaliados };
  }, [], ["membros", "formularios", "avaliados"]);
}
type Base = NonNullable<ReturnType<typeof useBase>["data"]>;

const contagem = (v: ID[] | "todos", total: number, um: string, varios: string) =>
  v === "todos" ? `Todos (${total})` : v.length === 0 ? "Nenhum" : `${v.length} ${v.length === 1 ? um : varios}`;

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export function Permissoes({ me }: { me: Membro }) {
  const r = useRoute();
  const aba = r.query.get("aba") === "equipes" ? "equipes" : "pessoas";
  const toast = useToast();
  const b = useBase();
  const [convite, setConvite] = useState<{ nome: string; email: string; funcao_id: string } | null>(null);
  const [novaEquipe, setNovaEquipe] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");

  async function convidar() {
    if (!convite) return;
    setOcupado(true); setErro(null);
    try {
      const p = await server.convidarPessoa(me, convite);
      setConvite(null);
      toast({ tone: "info", text: `Convite enviado para ${p.email}. Agora escolha o que ${p.nome.split(" ")[0]} pode acessar.` });
      navigate("/web/permissoes/pessoas/" + p.id);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  async function criarEquipe() {
    if (novaEquipe === null) return;
    setOcupado(true); setErro(null);
    try { const e = await server.criarEquipe(me, novaEquipe); setNovaEquipe(null); navigate("/web/permissoes/equipes/" + e.id); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  const q = busca.trim().toLowerCase();
  const pessoas = (b.data?.pessoas ?? []).filter((p) => !q || (p.nome + " " + p.email).toLowerCase().includes(q));
  const efetivos = useMemo(() => b.data ? new Map(resolverMembros(b.data.pessoas, b.data.funcoes, b.data.equipes).map((m) => [m.id, m])) : new Map<ID, Membro>(), [b.data]);

  return (
    <>
      <PageHeader title="Permissões" desc="Quem aplica quais formulários, em quais avaliados, e de quem vê as inspeções."
        actions={aba === "pessoas"
          ? <Button icon="plus" disabled={!b.data} onClick={() => { setErro(null); setConvite({ nome: "", email: "", funcao_id: b.data?.funcoes.find((f) => f.nome === "Aplicador")?.id ?? b.data?.funcoes[0]?.id ?? "" }); }}>Convidar pessoa</Button>
          : <Button icon="plus" onClick={() => { setErro(null); setNovaEquipe(""); }}>Nova equipe</Button>} />
      <Tabs items={[
        { to: "/web/permissoes", label: "Pessoas", current: aba === "pessoas", icon: "key" },
        { to: "/web/permissoes?aba=equipes", label: "Equipes", current: aba === "equipes", icon: "list" },
      ]} />
      {b.status === "error" ? <ErrorState error={b.error} onRetry={b.reload} />
        : !b.data ? <SkeletonRows rows={4} cols={5} />
        : aba === "pessoas" ? (
          <>
            <div className="filterbar" role="search">
              <div className="field search"><label htmlFor="b-pes">Buscar</label>
                <div className="searchbox"><Icon n="search" /><input id="b-pes" className="input" style={{ height: 40 }} value={busca} placeholder="Nome ou e-mail"
                  onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div></div>
            </div>
            {!pessoas.length ? <div className="card flat"><EmptyState icon="search" title="Ninguém com esse nome ou e-mail" /></div> : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Pessoas da conta</caption>
                  <thead><tr><th>Nome</th><th>Função</th><th>Equipes</th><th>Formulários</th><th>Situação</th></tr></thead>
                  <tbody>{pessoas.map((p) => {
                    const ef = efetivos.get(p.id);
                    return (
                      <tr key={p.id}>
                        <td><Link to={"/web/permissoes/pessoas/" + p.id} className="rowlink">{p.nome}</Link><div className="muted truncate" style={{ fontSize: "var(--text-xs)" }}>{p.email}</div></td>
                        <td>{ef?.funcao}{p.is_master ? <> <Badge tone="acc">dono</Badge></> : null}</td>
                        <td className="muted">{b.data!.equipes.filter((e) => e.membros.includes(p.id)).map((e) => e.nome).join(", ") || "—"}</td>
                        <td className="num">{ef?.acoes.includes("gerenciar_formularios") || p.is_master ? "Todos (edita)" : contagem(ef?.formularios_permitidos ?? [], b.data!.formularios.length, "formulário", "formulários")}</td>
                        <td>{p.ativo ? <Badge tone="ok">Ativo</Badge> : <Badge tone="na">Desativado</Badge>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </>
        ) : !b.data.equipes.length ? (
          <div className="card flat"><EmptyState icon="list" title="Nenhuma equipe ainda" text="Equipes juntam pessoas com o mesmo acesso, como os supervisores de uma regional." action={<Button icon="plus" onClick={() => setNovaEquipe("")}>Nova equipe</Button>} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Equipes</caption>
              <thead><tr><th>Equipe</th><th>Pessoas</th><th>Formulários</th><th>Avaliados</th></tr></thead>
              <tbody>{b.data.equipes.map((e) => (
                <tr key={e.id}>
                  <td><Link to={"/web/permissoes/equipes/" + e.id} className="rowlink">{e.nome}</Link></td>
                  <td className="muted">{e.membros.map((id) => b.data!.pessoas.find((p) => p.id === id)?.nome.split(" ")[0]).filter(Boolean).join(", ") || "Ninguém"}</td>
                  <td className="num">{contagem(e.acesso.formularios, b.data!.formularios.length, "formulário", "formulários")}</td>
                  <td className="num">{contagem(e.acesso.avaliados, b.data!.avaliados.length, "avaliado", "avaliados")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

      <Dialog open={!!convite} onClose={() => setConvite(null)} title="Convidar pessoa"
        footer={<><Button variant="secondary" onClick={() => setConvite(null)}>Cancelar</Button><Button icon="mail" loading={ocupado} onClick={convidar}>Enviar convite</Button></>}>
        {convite ? (
          <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void convidar(); }}>
            <TextField label="Nome" required autoFocus value={convite.nome} onChange={(v) => setConvite({ ...convite, nome: v })} />
            <TextField label="E-mail" type="email" required value={convite.email} onChange={(v) => setConvite({ ...convite, email: v })} help="A pessoa entra com este e-mail" />
            <div className="field"><label htmlFor="cv-fn">Função</label>
              <select id="cv-fn" className="select" value={convite.funcao_id} onChange={(e: { target: { value: string } }) => setConvite({ ...convite, funcao_id: e.target.value })}>
                {(b.data?.funcoes ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select></div>
            {erro ? <Callout tone="danger" icon="alert">{erro}</Callout> : null}
            <button type="submit" hidden />
          </form>
        ) : null}
      </Dialog>
      <Dialog open={novaEquipe !== null} onClose={() => setNovaEquipe(null)} title="Nova equipe"
        footer={<><Button variant="secondary" onClick={() => setNovaEquipe(null)}>Cancelar</Button><Button loading={ocupado} onClick={criarEquipe}>Criar</Button></>}>
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void criarEquipe(); }}>
          <TextField label="Nome da equipe" required autoFocus value={novaEquipe ?? ""} onChange={setNovaEquipe} error={erro} placeholder="Ex.: Regional Norte" />
          <button type="submit" hidden />
        </form>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Peças compartilhadas
// ---------------------------------------------------------------------------

function Checklist({ legend, desc, todos, value, itens, onChange, vazio }: {
  legend: string; desc?: string; todos?: string; value: ID[] | "todos"; itens: { id: ID; nome: string; detalhe?: string }[];
  onChange: (v: ID[] | "todos") => void; vazio?: string;
}) {
  const lista = value === "todos" ? [] : value;
  return (
    <fieldset className="group">
      <legend>{legend}</legend>
      {desc ? <p className="muted" style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-sm)" }}>{desc}</p> : null}
      {todos ? <Switch label={todos} checked={value === "todos"} onChange={(on) => onChange(on ? "todos" : [])} /> : null}
      {value === "todos" ? null : !itens.length ? <p className="muted" style={{ margin: 0 }}>{vazio ?? "Nada para escolher."}</p> : (
        <div className="checklist">{itens.map((it) => (
          <label key={it.id} className="check">
            <input type="checkbox" checked={lista.includes(it.id)}
              onChange={(e: { target: { checked: boolean } }) => onChange(e.target.checked ? [...lista, it.id] : lista.filter((x) => x !== it.id))} />
            <span>{it.nome}{it.detalhe ? <small>{it.detalhe}</small> : null}</span>
          </label>
        ))}</div>
      )}
    </fieldset>
  );
}

function AcessoEditor({ a, set, base, dono, modo }: { a: Acesso; set: (a: Acesso) => void; base: Base; dono?: ID; modo: "pessoa" | "equipe" }) {
  const quem = modo === "pessoa" ? "esta pessoa" : "quem estiver na equipe";
  const deQuem = modo === "pessoa" ? "dela" : "de quem estiver na equipe";
  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <Checklist legend="Formulários que aplica" desc={`Aparecem no app de campo ${deQuem} no próximo sincronismo.`}
        todos="Todos os formulários, inclusive os que forem criados" value={a.formularios} onChange={(v) => set({ ...a, formularios: v })}
        itens={base.formularios.map((f) => ({ id: f.id, nome: f.nome, detalhe: f.versao_numero ? `v${f.versao_numero}` : "ainda não publicado" }))} />
      <Checklist legend="Avaliados" desc={`Onde ${quem} pode aplicar inspeções.`}
        todos="Todos os avaliados" value={a.avaliados} onChange={(v) => set({ ...a, avaliados: v })}
        itens={base.avaliados.map((x) => ({ id: x.id, nome: x.nome, detalhe: x.codigo_externo }))} />
      <fieldset className="group">
        <legend>Vê as inspeções de</legend>
        <p className="muted" style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-sm)" }}>Além das próprias. Quem tem a ação “Ver todas as inspeções” já vê tudo.</p>
        <Checklist legend="Equipes" value={a.ver_equipes} onChange={(v) => set({ ...a, ver_equipes: v === "todos" ? [] : v })}
          itens={base.equipes.map((e) => ({ id: e.id, nome: e.nome, detalhe: `${e.membros.length} ${e.membros.length === 1 ? "pessoa" : "pessoas"}` }))} vazio="Nenhuma equipe criada." />
        <div style={{ height: "var(--space-3)" }} />
        <Checklist legend="Pessoas" value={a.ver_membros} onChange={(v) => set({ ...a, ver_membros: v === "todos" ? [] : v })}
          itens={base.pessoas.filter((p) => p.id !== dono && p.ativo).map((p) => ({ id: p.id, nome: p.nome }))} />
      </fieldset>
    </div>
  );
}

function SalvarBar({ sujo, salvando, onSalvar }: { sujo: boolean; salvando: boolean; onSalvar: () => void }) {
  return <>{sujo ? <Badge tone="warn" icon="edit">Alterações não salvas</Badge> : null}<Button icon="check" loading={salvando} disabled={!sujo} onClick={onSalvar}>Salvar</Button></>;
}

// ---------------------------------------------------------------------------
// Pessoa
// ---------------------------------------------------------------------------

export function PessoaEditor({ me, id }: { me: Membro; id: ID }) {
  const toast = useToast();
  const b = useBase();
  const [p, setP] = useState<MembroRegistro | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { if (b.data && (!p || p.id !== id) ) setP(b.data.pessoas.find((x) => x.id === id) ?? null); }, [b.data, id]);

  if (b.status === "error") return <ErrorState error={b.error} onRetry={b.reload} />;
  if (!b.data) return <div className="stack"><SkeletonBlock h={60} /><SkeletonBlock h={320} /></div>;
  if (!p) return <div className="card flat"><EmptyState icon="alert" title="Pessoa não encontrada" action={<Link to="/web/permissoes" className="btn secondary">Voltar para permissões</Link>} /></div>;
  const base = b.data;
  const set = (patch: Partial<MembroRegistro>) => { setP({ ...p, ...patch }); setSujo(true); };
  const equipesDela = base.equipes.filter((e) => e.membros.includes(p.id));
  const ef = resolverMembros([p], base.funcoes, base.equipes)[0]!;
  const funcao = base.funcoes.find((f) => f.id === p.funcao_id);
  const nomes = (ids: ID[]) => ids.map((x) => base.pessoas.find((y) => y.id === x)?.nome.split(" ")[0]).filter(Boolean).join(", ");

  async function salvar(extra: Partial<MembroRegistro> = {}) {
    setSalvando(true);
    try {
      const novo = await server.salvarPessoa(me, p!.id, { nome: p!.nome, funcao_id: p!.funcao_id, acesso: p!.acesso, ...extra });
      setP(novo); setSujo(false);
      toast({ tone: "info", text: extra.ativo === false ? `Acesso de ${novo.nome} desativado.` : extra.ativo ? `Acesso de ${novo.nome} reativado.` : "Permissões salvas." });
    } catch (e) { toast({ tone: "error", text: (e as Error).message }); }
    finally { setSalvando(false); setConfirmar(false); }
  }

  return (
    <>
      <PageHeader crumbs={[{ to: "/web/permissoes", label: "Permissões" }]} title={p.nome || "Sem nome"}
        desc={<>{p.email}{p.ativo ? null : <> · <Badge tone="na">Desativado</Badge></>}</>}
        actions={<SalvarBar sujo={sujo} salvando={salvando} onSalvar={() => void salvar()} />} />
      <div className="split">
        <div className="stack" style={{ gap: "var(--space-5)" }}>
          <section className="card">
            <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <TextField label="Nome" value={p.nome} onChange={(v) => set({ nome: v })} />
              <div className="field"><label htmlFor="pe-fn">Função</label>
                <select id="pe-fn" className="select" value={p.funcao_id} disabled={p.is_master} onChange={(e: { target: { value: string } }) => set({ funcao_id: e.target.value })}>
                  {base.funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
                {p.is_master ? <div className="help">Dono da conta: sempre Administrador.</div> : <div className="help"><Link to="/web/funcoes">Ver o que cada função faz</Link></div>}</div>
            </div>
          </section>
          <section className="card">
            {funcao?.acoes.includes("gerenciar_formularios") || p.is_master
              ? <div style={{ marginBottom: "var(--space-4)" }}><Callout icon="info">Com a função {funcao?.nome}, esta pessoa edita formulários e por isso aplica qualquer um deles.</Callout></div> : null}
            <AcessoEditor a={p.acesso} set={(a) => set({ acesso: a })} base={base} dono={p.id} modo="pessoa" />
          </section>
        </div>
        <aside className="stack">
          <section className="card flat stack-sm" aria-labelledby="ef-h">
            <h2 id="ef-h" style={{ fontSize: "var(--text-base)" }}>Acesso efetivo</h2>
            <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>Somando o que foi dado a ela e às equipes dela{equipesDela.length ? ` (${equipesDela.map((e) => e.nome).join(", ")})` : ""}.</p>
            <dl className="stack-sm" style={{ margin: 0 }}>
              <div><dt className="muted" style={{ fontSize: "var(--text-xs)" }}>Formulários</dt><dd style={{ margin: 0 }} data-testid="ef-form">
                {ef.acoes.includes("gerenciar_formularios") || p.is_master ? "Todos" : ef.formularios_permitidos === "todos" ? "Todos" : ef.formularios_permitidos.map((x) => base.formularios.find((f) => f.id === x)?.nome).filter(Boolean).join(", ") || "Nenhum"}</dd></div>
              <div><dt className="muted" style={{ fontSize: "var(--text-xs)" }}>Avaliados</dt><dd style={{ margin: 0 }}>
                {ef.avaliados_permitidos === "todos" ? "Todos" : ef.avaliados_permitidos.map((x) => base.avaliados.find((a) => a.id === x)?.nome).filter(Boolean).join(", ") || "Nenhum"}</dd></div>
              <div><dt className="muted" style={{ fontSize: "var(--text-xs)" }}>Inspeções que vê</dt><dd style={{ margin: 0 }} data-testid="ef-ve">
                {ef.acoes.includes("ver_todas_inspecoes") || p.is_master ? "Todas" : ef.ve_inspecoes_de.length ? `As próprias e as de ${nomes(ef.ve_inspecoes_de)}` : "Só as próprias"}</dd></div>
            </dl>
            {sujo ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Prévia: vale depois de salvar.</p> : null}
          </section>
          {p.is_master ? null : (
            <section className="card flat stack-sm">
              <h2 style={{ fontSize: "var(--text-base)" }}>{p.ativo ? "Desativar acesso" : "Acesso desativado"}</h2>
              <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>{p.ativo ? "A pessoa sai na hora e não entra mais. As inspeções dela continuam no histórico." : "As inspeções continuam no histórico. Reative para ela voltar a entrar."}</p>
              {p.ativo
                ? <Button variant="secondary" icon="x" disabled={p.id === me.id} onClick={() => setConfirmar(true)}>Desativar</Button>
                : <Button variant="secondary" icon="refresh" loading={salvando} onClick={() => void salvar({ ativo: true })}>Reativar</Button>}
              {p.id === me.id ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Você não pode desativar o seu próprio acesso.</p> : null}
            </section>
          )}
        </aside>
      </div>
      <Dialog open={confirmar} onClose={() => setConfirmar(false)} title={`Desativar ${p.nome}?`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)}>Cancelar</Button><Button variant="danger" loading={salvando} onClick={() => void salvar({ ativo: false })}>Desativar</Button></>}>
        <p style={{ margin: 0 }}>{p.nome.split(" ")[0]} perde o acesso imediatamente. Inspeções que estiverem só no celular dela não serão mais aceitas.{sujo ? " As outras alterações desta tela também serão salvas." : ""}</p>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export function EquipeEditor({ me, id }: { me: Membro; id: ID }) {
  const toast = useToast();
  const b = useBase();
  const [e, setE] = useState<Equipe | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { if (b.data && (!e || e.id !== id)) setE(b.data.equipes.find((x) => x.id === id) ?? null); }, [b.data, id]);

  if (b.status === "error") return <ErrorState error={b.error} onRetry={b.reload} />;
  if (!b.data) return <div className="stack"><SkeletonBlock h={60} /><SkeletonBlock h={320} /></div>;
  if (!e) return <div className="card flat"><EmptyState icon="alert" title="Equipe não encontrada" action={<Link to="/web/permissoes?aba=equipes" className="btn secondary">Voltar para equipes</Link>} /></div>;
  const base = b.data;
  const set = (patch: Partial<Equipe>) => { setE({ ...e, ...patch }); setSujo(true); };

  async function salvar() {
    setSalvando(true);
    try { setE(await server.salvarEquipe(me, e!)); setSujo(false); toast({ tone: "info", text: "Equipe salva." }); }
    catch (x) { toast({ tone: "error", text: (x as Error).message }); }
    finally { setSalvando(false); }
  }
  async function excluir() {
    try { await server.excluirEquipe(me, e!.id); toast({ tone: "info", text: `Equipe ${e!.nome} excluída.` }); navigate("/web/permissoes?aba=equipes", { replace: true }); }
    catch (x) { toast({ tone: "error", text: (x as Error).message }); }
  }

  return (
    <>
      <PageHeader crumbs={[{ to: "/web/permissoes?aba=equipes", label: "Equipes" }]} title={e.nome || "Equipe sem nome"}
        desc="O acesso da equipe soma ao de cada pessoa dela."
        actions={<SalvarBar sujo={sujo} salvando={salvando} onSalvar={() => void salvar()} />} />
      <div className="split">
        <div className="stack" style={{ gap: "var(--space-5)" }}>
          <section className="card stack">
            <TextField label="Nome da equipe" value={e.nome} onChange={(v) => set({ nome: v })} />
            <Checklist legend="Pessoas na equipe" value={e.membros} onChange={(v) => set({ membros: v === "todos" ? [] : v })}
              itens={base.pessoas.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, detalhe: base.funcoes.find((f) => f.id === p.funcao_id)?.nome }))} />
          </section>
          <section className="card"><AcessoEditor a={e.acesso} set={(a) => set({ acesso: a })} base={base} modo="equipe" /></section>
        </div>
        <aside className="stack">
          <section className="card flat stack-sm">
            <h2 style={{ fontSize: "var(--text-base)" }}>Quem acompanha esta equipe</h2>
            <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }} data-testid="acompanham">
              {base.pessoas.filter((p) => p.acesso.ver_equipes.includes(e.id)).map((p) => p.nome).join(", ") || "Ninguém vê as inspeções desta equipe por ela (só quem vê todas)."}
            </p>
          </section>
          <section className="card flat stack-sm">
            <h2 style={{ fontSize: "var(--text-base)" }}>Excluir equipe</h2>
            <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>As pessoas continuam, só perdem o acesso que vinha da equipe.</p>
            <Button variant="secondary" icon="trash" onClick={() => setConfirmar(true)}>Excluir</Button>
          </section>
        </aside>
      </div>
      <Dialog open={confirmar} onClose={() => setConfirmar(false)} title={`Excluir ${e.nome}?`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)}>Cancelar</Button><Button variant="danger" onClick={() => void excluir()}>Excluir equipe</Button></>}>
        <p style={{ margin: 0 }}>Quem estava na equipe perde o acesso que vinha dela no próximo sincronismo.</p>
      </Dialog>
    </>
  );
}
