// S05 — Agendamentos (aba de Inspeções) · S06 — Agendar · S07 — Inativar
import { useMemo, useState } from "react";
import { descreverRegra, DIAS_CURTOS, DIAS_SEMANA, diaDaSemana, instantesDaRegra, somarDias, validarRegra } from "../data/agenda";
import { pode, server } from "../data/server";
import type { Agendamento, ID, Membro, OcorrenciaSituacao, RegraAgenda } from "../data/types";
import { useData, useDebounced } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, Dialog, EmptyState, ErrorState, SkeletonRows, Switch, TextField, useToast } from "../ui/primitives";
import { Link } from "../ui/router";

const hojeOrg = () => new Intl.DateTimeFormat("en-CA", { timeZone: server.org().fuso_horario }).format(new Date());
type Linha = Awaited<ReturnType<typeof server.listarOcorrencias>>[number];

const SITUACAO: Record<OcorrenciaSituacao, { txt: string; tone: "ok" | "nc" | "warn" | "na" | "acc"; icon: "clock" | "check" | "alert" | "minus" }> = {
  pendente: { txt: "Pendente", tone: "acc", icon: "clock" },
  atrasada: { txt: "Atrasada", tone: "nc", icon: "alert" },
  completa: { txt: "Completa", tone: "ok", icon: "check" },
  inativa: { txt: "Inativa", tone: "na", icon: "minus" },
};
export function SituacaoAgenda({ s }: { s: OcorrenciaSituacao }) {
  const x = SITUACAO[s];
  return <Badge tone={x.tone} icon={x.icon}>{x.txt}</Badge>;
}

function quando(l: Linha): { dia: string; hora: string } {
  const fuso = l.agendamento.fuso_horario;
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(l.previsto_em));
  const hora = l.agendamento.dia_inteiro ? "Dia inteiro" : new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" }).format(new Date(l.previsto_em));
  return { dia, hora };
}

export function Agendamentos({ me }: { me: Membro }) {
  const toast = useToast();
  const gerencia = pode(me, "gerenciar_agendamentos");
  const [de, setDe] = useState(hojeOrg());
  const [ate, setAte] = useState(somarDias(hojeOrg(), 14));
  const [situacao, setSituacao] = useState<OcorrenciaSituacao | "">("");
  const [busca, setBusca] = useState("");
  const buscaD = useDebounced(busca);
  const lista = useData(() => server.listarOcorrencias(me, { de, ate, situacao, busca: buscaD }), [me.id, de, ate, situacao, buscaD], ["agenda", "inspecoes", "membros"]);
  const [editar, setEditar] = useState<Agendamento | "novo" | null>(null);
  const [inativar, setInativar] = useState<Linha | null>(null);

  return (
    <>
      <div className="filterbar" role="search">
        <div className="field search"><label htmlFor="ag-q">Buscar</label>
          <div className="searchbox"><Icon n="search" /><input id="ag-q" className="input" style={{ height: 40 }} placeholder="Avaliado, formulário ou pessoa"
            value={busca} onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} /></div></div>
        <div className="field"><label htmlFor="ag-de">De</label><input id="ag-de" type="date" className="input" value={de} onChange={(e: { target: { value: string } }) => setDe(e.target.value)} /></div>
        <div className="field"><label htmlFor="ag-ate">Até</label><input id="ag-ate" type="date" className="input" value={ate} onChange={(e: { target: { value: string } }) => setAte(e.target.value)} /></div>
        <div className="field"><label htmlFor="ag-st">Situação</label>
          <select id="ag-st" className="select" value={situacao} onChange={(e: { target: { value: string } }) => setSituacao(e.target.value as OcorrenciaSituacao | "")}>
            <option value="">Todas</option><option value="pendente">Pendente</option><option value="atrasada">Atrasada</option>
            <option value="completa">Completa</option><option value="inativa">Inativa</option>
          </select></div>
        {gerencia ? <Button icon="calendar" onClick={() => setEditar("novo")}>Agendar</Button> : null}
      </div>

      {lista.status === "error" ? <ErrorState error={lista.error} onRetry={lista.reload} />
        : !lista.data ? <SkeletonRows cols={6} />
        : !lista.data.length ? (
          <div className="card flat"><EmptyState icon="calendar" title={situacao || buscaD ? "Nada com esses filtros" : "Nada agendado neste período"}
            text="Programe inspeções únicas ou recorrentes. Quem for aplicar vê na agenda do app, mesmo sem internet."
            action={gerencia ? <Button icon="calendar" onClick={() => setEditar("novo")}>Agendar inspeção</Button> : undefined} /></div>
        ) : (
          <>
            <p className="muted" aria-live="polite" style={{ margin: "0 0 var(--space-2)" }}>{lista.data.length} {lista.data.length === 1 ? "ocorrência" : "ocorrências"}</p>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Inspeções agendadas</caption>
                <thead><tr><th>Quando</th><th>Avaliado</th><th>Formulário</th><th>Quem aplica</th><th>Repetição</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{lista.data.map((l) => {
                  const q = quando(l);
                  return (
                    <tr key={l.id} data-ocorrencia={l.id}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}><div style={{ fontWeight: 600 }}>{q.dia}</div><div className="muted" style={{ fontSize: "var(--text-xs)" }}>{q.hora}</div></td>
                      <td style={{ fontWeight: 600 }}>{l.avaliado}</td>
                      <td>{l.formulario}</td>
                      <td>{l.responsaveis.join(", ")}</td>
                      <td className="muted" style={{ fontSize: "var(--text-sm)", maxWidth: 260 }}>{l.descricao}</td>
                      <td>{l.situacao === "inativa" && l.justificativa ? <span title={"Motivo: " + l.justificativa}><SituacaoAgenda s={l.situacao} /></span> : <SituacaoAgenda s={l.situacao} />}</td>
                      <td className="r" style={{ whiteSpace: "nowrap" }}>
                        {l.inspecao_id ? <Link to={"/web/inspecoes/" + l.inspecao_id} className="btn ghost sm">Ver inspeção</Link> : null}
                        {gerencia && l.agendamento.ativo ? <Button variant="ghost" size="sm" icon="edit" label={`Editar agendamento de ${l.avaliado}`} onClick={() => setEditar(l.agendamento)} /> : null}
                        {(l.situacao === "pendente" || l.situacao === "atrasada") && (gerencia || l.agendamento.responsaveis.includes(me.id))
                          ? <Button variant="ghost" size="sm" icon="x" label={`Inativar ocorrência de ${l.avaliado}`} onClick={() => setInativar(l)} /> : null}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>
        )}

      {editar ? <AgendarDialog me={me} inicial={editar === "novo" ? null : editar} onClose={() => setEditar(null)}
        onSalvo={(n, novo) => { setEditar(null); toast({ tone: "info", text: novo ? `Agendado. ${n} ${n === 1 ? "ocorrência gerada" : "ocorrências geradas"} para os próximos 14 dias.` : "Agendamento atualizado. As próximas ocorrências seguem a regra nova." }); }} /> : null}
      {inativar ? <InativarDialog me={me} linha={inativar} onClose={() => setInativar(null)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// S06 — Agendar / editar
// ---------------------------------------------------------------------------

type Rascunho = RegraAgenda & { formulario_id: ID; avaliado_id: ID; responsaveis: ID[] };

function AgendarDialog({ me, inicial, onClose, onSalvo }: { me: Membro; inicial: Agendamento | null; onClose: () => void; onSalvo: (geradas: number, novo: boolean) => void }) {
  const refs = useData(async () => {
    const [fs, avs] = await Promise.all([server.listarFormularios(), server.listarAvaliados()]);
    return { fs: fs.filter((f) => f.versao_publicada_id), avs };
  }, []);
  const [r, setR] = useState<Rascunho>(() => inicial ? {
    ...inicial, dias_semana: inicial.dias_semana ?? [], horarios: inicial.horarios.length ? inicial.horarios : ["08:00"],
  } : {
    formulario_id: "", avaliado_id: "", responsaveis: [], data_inicio: hojeOrg(), horarios: ["08:00"], dia_inteiro: false,
    fuso_horario: server.org().fuso_horario, recorrencia: "nenhuma", dias_semana: [], termino: "nunca",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (p: Partial<Rascunho>) => { setR({ ...r, ...p }); setErro(null); };

  const form = refs.data?.fs.find((f) => f.id === r.formulario_id);
  const avaliados = (refs.data?.avs ?? []).filter((a) => a.ativo && (!form || !form.avaliados_vinculados.length || form.avaliados_vinculados.includes(a.id)));
  const pessoas = server.membros().filter((m) => m.ativo && pode(m, "aplicar"));
  const temAcesso = (m: Membro) => !r.formulario_id || (
    (pode(m, "gerenciar_formularios") || m.formularios_permitidos === "todos" || m.formularios_permitidos.includes(r.formulario_id))
    && (!r.avaliado_id || m.avaliados_permitidos === "todos" || m.avaliados_permitidos.includes(r.avaliado_id)));

  const regra: RegraAgenda = { ...r, horarios: r.dia_inteiro ? [] : r.horarios };
  const problemas = validarRegra(regra);
  const proximas = useMemo(() => problemas.length ? [] : instantesDaRegra(regra, hojeOrg(), somarDias(hojeOrg(), 120)).filter((x) => Date.parse(x) > Date.now() - 2 * 3600e3).slice(0, 4),
    [JSON.stringify(regra)]);

  async function salvar() {
    setSalvando(true); setErro(null);
    try { const out = await server.salvarAgendamento(me, { ...regra, id: inicial?.id, formulario_id: r.formulario_id, avaliado_id: r.avaliado_id, responsaveis: r.responsaveis }); onSalvo(out.geradas, !inicial); }
    catch (e) { setErro((e as Error).message); }
    finally { setSalvando(false); }
  }

  const fuso = server.org().fuso_horario;
  const fmtProx = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", ...(r.dia_inteiro ? {} : { hour: "2-digit", minute: "2-digit" }) }).format(new Date(iso));

  return (
    <Dialog open onClose={onClose} title={inicial ? "Editar agendamento" : "Agendar inspeção"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon="calendar" loading={salvando} onClick={() => void salvar()}>{inicial ? "Salvar" : "Agendar"}</Button></>}>
      {!refs.data ? <SkeletonRows rows={4} cols={2} /> : (
        <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void salvar(); }}>
          <div className="field"><label htmlFor="ag-f">Formulário</label>
            <select id="ag-f" className="select" value={r.formulario_id} onChange={(e: { target: { value: string } }) => set({ formulario_id: e.target.value, avaliado_id: "" })}>
              <option value="">Escolha…</option>
              {refs.data.fs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ag-a">Avaliado</label>
            <select id="ag-a" className="select" value={r.avaliado_id} disabled={!r.formulario_id} onChange={(e: { target: { value: string } }) => set({ avaliado_id: e.target.value })}>
              <option value="">{r.formulario_id ? "Escolha…" : "Escolha o formulário primeiro"}</option>
              {avaliados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select></div>
          <fieldset className="group">
            <legend>Quem aplica</legend>
            <div className="checklist">{pessoas.map((m) => {
              const ok = temAcesso(m);
              return (
                <label key={m.id} className="check" style={ok ? undefined : { opacity: 0.6 }}>
                  <input type="checkbox" checked={r.responsaveis.includes(m.id)} disabled={!ok && !r.responsaveis.includes(m.id)}
                    onChange={(e: { target: { checked: boolean } }) => set({ responsaveis: e.target.checked ? [...r.responsaveis, m.id] : r.responsaveis.filter((x) => x !== m.id) })} />
                  <span>{m.nome}<small>{ok ? m.funcao : "sem acesso a este formulário ou avaliado"}</small></span>
                </label>
              );
            })}</div>
          </fieldset>

          <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
            <TextField label="Começa em" type="date" value={r.data_inicio} onChange={(v) => set({ data_inicio: v, dias_semana: r.recorrencia === "semanal" && !r.dias_semana?.length && v ? [diaDaSemana(v)] : r.dias_semana })} />
            <div className="field"><label htmlFor="ag-rec">Repetir</label>
              <select id="ag-rec" className="select" value={r.recorrencia} onChange={(e: { target: { value: string } }) => {
                const rec = e.target.value as RegraAgenda["recorrencia"];
                set({ recorrencia: rec, dias_semana: rec === "semanal" && !r.dias_semana?.length ? [diaDaSemana(r.data_inicio)] : r.dias_semana, termino: rec === "nenhuma" ? "nunca" : r.termino });
              }}>
                <option value="nenhuma">Não repete</option><option value="diaria">Todo dia</option><option value="semanal">Toda semana</option><option value="mensal">Todo mês</option>
              </select></div>
          </div>

          {r.recorrencia === "semanal" ? (
            <fieldset className="group">
              <legend>Nos dias</legend>
              <div className="row" style={{ gap: "var(--space-2)" }}>{DIAS_CURTOS.map((d, k) => (
                <label key={d} className={"chip-dia" + (r.dias_semana?.includes(k) ? " on" : "")}>
                  <input type="checkbox" className="sr-only" aria-label={DIAS_SEMANA[k]} checked={!!r.dias_semana?.includes(k)}
                    onChange={(e: { target: { checked: boolean } }) => set({ dias_semana: e.target.checked ? [...(r.dias_semana ?? []), k] : (r.dias_semana ?? []).filter((x) => x !== k) })} />
                  {d}
                </label>
              ))}</div>
            </fieldset>
          ) : null}

          <Switch label="O dia inteiro" desc="Sem horário marcado; o aviso sai às 08:00 e fica atrasada só no dia seguinte." checked={r.dia_inteiro} onChange={(v) => set({ dia_inteiro: v })} />
          {r.dia_inteiro ? null : (
            <fieldset className="group">
              <legend>Horários</legend>
              <div className="row" style={{ gap: "var(--space-2)" }}>
                {r.horarios.map((h, k) => (
                  <span key={k} className="row" style={{ gap: 4 }}>
                    <input type="time" className="input" style={{ width: 130 }} aria-label={`Horário ${k + 1}`} value={h}
                      onChange={(e: { target: { value: string } }) => set({ horarios: r.horarios.map((x, j) => (j === k ? e.target.value : x)) })} />
                    {r.horarios.length > 1 ? <Button variant="ghost" size="sm" icon="x" label={`Remover horário ${k + 1}`} onClick={() => set({ horarios: r.horarios.filter((_, j) => j !== k) })} /> : null}
                  </span>
                ))}
                <Button variant="secondary" size="sm" icon="plus" onClick={() => set({ horarios: [...r.horarios, "14:00"] })}>Horário</Button>
              </div>
            </fieldset>
          )}

          {r.recorrencia !== "nenhuma" ? (
            <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
              <div className="field"><label htmlFor="ag-fim">Termina</label>
                <select id="ag-fim" className="select" value={r.termino} onChange={(e: { target: { value: string } }) => set({ termino: e.target.value as RegraAgenda["termino"] })}>
                  <option value="nunca">Nunca</option><option value="data">Em uma data</option><option value="quantidade">Depois de algumas vezes</option>
                </select></div>
              {r.termino === "data" ? <TextField label="Último dia" type="date" value={r.termino_data ?? ""} onChange={(v) => set({ termino_data: v })} /> : null}
              {r.termino === "quantidade" ? <TextField label="Quantas vezes" inputMode="numeric" value={r.termino_qtd ? String(r.termino_qtd) : ""} onChange={(v) => set({ termino_qtd: Number(v.replace(/\D/g, "")) || undefined })} /> : null}
            </div>
          ) : null}

          <div className="callout info" aria-live="polite" data-testid="resumo-regra">
            <Icon n="calendar" />
            <div>
              <b>{problemas.length ? "Complete a regra" : descreverRegra(regra)}</b>
              {problemas.length ? <div className="muted" style={{ fontSize: "var(--text-sm)" }}>{problemas[0]}</div>
                : proximas.length ? <div className="muted num" style={{ fontSize: "var(--text-sm)" }}>Próximas: {proximas.map(fmtProx).join(" · ")}</div>
                : <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Nenhuma ocorrência daqui para frente.</div>}
            </div>
          </div>
          {inicial ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>O que já foi feito ou inativado não muda. As ocorrências futuras pendentes são refeitas pela regra nova.</p> : null}
          {erro ? <Callout tone="danger" icon="alert">{erro}</Callout> : null}
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// S07 — Inativar
// ---------------------------------------------------------------------------

function InativarDialog({ me, linha, onClose }: { me: Membro; linha: Linha; onClose: () => void }) {
  const toast = useToast();
  const [escopo, setEscopo] = useState<"esta" | "seguintes">("esta");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const q = quando(linha);
  const repete = linha.agendamento.recorrencia !== "nenhuma";

  async function confirmar() {
    setOcupado(true); setErro(null);
    try {
      const n = await server.inativarOcorrencia(me, linha.id, escopo, motivo);
      toast({ tone: "info", text: escopo === "esta" ? "Ocorrência inativada." : `${n} ${n === 1 ? "ocorrência inativada" : "ocorrências inativadas"} e agendamento encerrado.` });
      onClose();
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  return (
    <Dialog open onClose={onClose} title="Inativar agendamento"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="danger" loading={ocupado} onClick={() => void confirmar()}>Inativar</Button></>}>
      <form className="stack" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); void confirmar(); }}>
        <p style={{ margin: 0 }}><b>{linha.avaliado}</b> · {linha.formulario}<br /><span className="muted num">{q.dia} · {q.hora}</span></p>
        {repete ? (
          <fieldset className="group">
            <legend>O que inativar</legend>
            <label className="check"><input type="radio" name="escopo" checked={escopo === "esta"} onChange={() => setEscopo("esta")} /><span>Só esta</span></label>
            <label className="check"><input type="radio" name="escopo" checked={escopo === "seguintes"} onChange={() => setEscopo("seguintes")} />
              <span>Esta e todas as seguintes<small>O agendamento é encerrado e não gera mais ocorrências.</small></span></label>
          </fieldset>
        ) : null}
        <TextField label="Motivo" multiline required value={motivo} onChange={setMotivo} error={erro} placeholder="Ex.: loja fechada para reforma" autoFocus />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
