// S14 Editor (Questões) · S15 Configurações · S16 Relatório (marco 2) · S17 Avaliados · S18 notas por questão
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateFormula, formulaReferences, index as indexDef, validateDefinition,
  type DefinitionIssue, type FormDefinition, type Option, type Question, type QuestionType, type Topic,
} from "@app/form-engine";
import { server } from "../data/server";
import type { Avaliado, Formulario, Membro } from "../data/types";
import { corClassificacao, fmt, parseNumero } from "../ui/format";
import { useData } from "../ui/hooks";
import { Icon, type IconName } from "../ui/icons";
import { Badge, Button, Callout, EmptyState, ErrorState, PageHeader, SkeletonBlock, Switch, Tabs, TextField, useToast } from "../ui/primitives";
import { useRoute } from "../ui/router";

const uuid = () => crypto.randomUUID();
const TIPOS: { v: QuestionType; label: string; icon: IconName }[] = [
  { v: "escolha_simples", label: "Escolha única", icon: "circleDot" },
  { v: "escolha_multipla", label: "Múltipla escolha", icon: "checkSquare" },
  { v: "numerica", label: "Número", icon: "hash" },
  { v: "texto", label: "Texto", icon: "type" },
  { v: "data_hora", label: "Data e hora", icon: "calendar" },
  { v: "assinatura", label: "Assinatura", icon: "pen" },
  { v: "calculo", label: "Cálculo", icon: "calc" },
];
const tipoInfo = (t: QuestionType) => TIPOS.find((x) => x.v === t)!;

function novaQuestao(tipo: QuestionType = "escolha_simples"): Question {
  const q: Question = { key: uuid(), titulo: "", tipo, obrigatoria: true };
  return ajustarTipo(q, tipo);
}
function ajustarTipo(q: Question, tipo: QuestionType): Question {
  const base: Question = { key: q.key, titulo: q.titulo, tipo, obrigatoria: q.obrigatoria, foto_obrigatoria: q.foto_obrigatoria, ajuda: q.ajuda, depende_de: q.depende_de };
  if (tipo === "escolha_simples" || tipo === "escolha_multipla")
    base.opcoes = q.opcoes?.length ? q.opcoes : [
      { key: uuid(), texto: "Sim", pontos: 10, conforme: true },
      { key: uuid(), texto: "Não", pontos: 0, conforme: false },
    ];
  if (tipo === "numerica") base.numerica = q.numerica ?? { formato: "decimal" };
  if (tipo === "texto") base.texto = q.texto ?? {};
  if (tipo === "data_hora") base.data_hora = q.data_hora ?? { campos: "data_hora" };
  if (tipo === "calculo") { base.calculo = q.calculo ?? { formula: "" }; base.obrigatoria = false; }
  if (tipo === "assinatura") base.foto_obrigatoria = false;
  return base;
}

type SaveState = { st: "idle" | "salvando" | "salvo" | "erro"; em?: string; erro?: string };

export function FormBuilder({ me, id }: { me: Membro; id: string }) {
  const r = useRoute();
  const aba = r.query.get("aba") ?? "questoes";
  const toast = useToast();
  const carregado = useData(() => Promise.all([server.obterFormulario(id), server.listarFormularios(), server.listarAvaliados()]), [id]);

  const [form, setForm] = useState<Formulario | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ st: "idle" });
  const [problemas, setProblemas] = useState<DefinitionIssue[] | null>(null);
  const [publicando, setPublicando] = useState(false);
  const versaoRef = useRef<string | undefined>(undefined);
  const dirty = useRef(false);

  useEffect(() => {
    if (carregado.data && !form) {
      setForm(carregado.data[0]);
      versaoRef.current = carregado.data[0].updated_at;
      setSel(carregado.data[0].rascunho.topicos[0]?.questoes[0]?.key ?? null);
    }
  }, [carregado.data]);

  // autosave com trava otimista
  useEffect(() => {
    if (!form || !dirty.current) return;
    setSave({ st: "salvando" });
    const t = setTimeout(async () => {
      try {
        const salvo = await server.salvarRascunho(id, { nome: form.nome, rascunho: form.rascunho, avaliados_vinculados: form.avaliados_vinculados }, versaoRef.current);
        versaoRef.current = salvo.updated_at;
        dirty.current = false;
        setSave({ st: "salvo", em: salvo.updated_at });
      } catch (e) {
        setSave({ st: "erro", erro: (e as Error).message });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [form]);

  const info = carregado.data?.[1].find((f) => f.id === id);
  const avaliados = carregado.data?.[2] ?? [];

  if (carregado.status === "error") return <ErrorState error={carregado.error} onRetry={carregado.reload} />;
  if (!form) return <div className="stack"><SkeletonBlock h={60} /><SkeletonBlock h={420} /></div>;

  const def = form.rascunho;
  const edit = (fn: (d: FormDefinition) => void) => {
    const d = structuredClone(def);
    fn(d);
    dirty.current = true;
    setProblemas(null);
    setForm({ ...form, rascunho: d });
  };
  const setNome = (nome: string) => { dirty.current = true; setForm({ ...form, nome }); };

  async function publicar() {
    const local = validateDefinition(def);
    if (local.length) { setProblemas(local); return; }
    setPublicando(true);
    try {
      if (dirty.current) {
        const salvo = await server.salvarRascunho(id, { nome: form!.nome, rascunho: def, avaliados_vinculados: form!.avaliados_vinculados }, versaoRef.current);
        versaoRef.current = salvo.updated_at;
        dirty.current = false;
      }
      const res = await server.publicar(id, me.id);
      if (!res.ok) { setProblemas(res.problemas); return; }
      const atual = await server.obterFormulario(id);
      versaoRef.current = atual.updated_at;
      setForm(atual);
      setProblemas([]);
      carregado.reload();
      toast({ tone: "info", text: `Versão ${res.versao.numero} publicada. Os aparelhos recebem na próxima sincronização.` });
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setPublicando(false);
    }
  }

  const proximaVersao = (info?.versao_numero ?? 0) + 1;
  const alterado = !info?.versao_numero || !!info?.tem_alteracoes || dirty.current || save.st === "salvando";

  return (
    <>
      <PageHeader
        crumbs={[{ to: "/web/formularios", label: "Formulários" }]}
        title={<input className="topic-title" style={{ fontSize: "var(--text-xl)", fontWeight: 700, padding: "2px 4px", marginLeft: -6 }}
          aria-label="Nome do formulário" value={form.nome} onChange={(e: { target: { value: string } }) => setNome(e.target.value)} />}
        desc={<span className="row" style={{ gap: 8 }}>
          {info?.versao_numero ? <span>No campo: <b className="num">v{info.versao_numero}</b></span> : <Badge tone="na">Nunca publicado</Badge>}
          {alterado && info?.versao_numero ? <Badge tone="warn" icon="edit">Alterações não publicadas</Badge> : null}
          <span aria-live="polite" className="muted" style={{ fontSize: "var(--text-xs)" }}>
            {save.st === "salvando" ? "Salvando…" : save.st === "salvo" ? `Rascunho salvo ${fmt.relativo(save.em)}` : save.st === "erro" ? <span style={{ color: "var(--c-danger)" }}>{save.erro}</span> : "Rascunho salvo"}
          </span>
        </span>}
        actions={<Button icon="rocket" loading={publicando} disabled={!alterado} onClick={publicar}>Publicar v{proximaVersao}</Button>}
      />
      {problemas?.length ? (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Callout tone="danger">
            <b>Corrija antes de publicar ({problemas.length}):</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{problemas.slice(0, 8).map((p, k) => <li key={k}>{p.onde}: {p.problema}</li>)}</ul>
          </Callout>
        </div>
      ) : null}
      <Tabs items={[
        { to: `/web/formularios/${id}`, label: "Questões", current: aba === "questoes", icon: "list" },
        { to: `/web/formularios/${id}?aba=configuracoes`, label: "Configurações", current: aba === "configuracoes", icon: "shield" },
        { to: `/web/formularios/${id}?aba=relatorio`, label: "Relatório", current: aba === "relatorio", icon: "file" },
        { to: `/web/formularios/${id}?aba=avaliados`, label: `Avaliados${form.avaliados_vinculados.length ? ` (${form.avaliados_vinculados.length})` : ""}`, current: aba === "avaliados", icon: "store" },
      ]} />

      {aba === "questoes" ? <AbaQuestoes def={def} edit={edit} sel={sel} setSel={setSel} />
        : aba === "configuracoes" ? <AbaConfig def={def} edit={edit} />
        : aba === "avaliados" ? <AbaAvaliados avaliados={avaliados} vinculados={form.avaliados_vinculados}
            set={(ids) => { dirty.current = true; setForm({ ...form, avaliados_vinculados: ids }); }} />
        : <div className="card flat"><EmptyState icon="file" title="Layout do relatório chega no marco 2"
            text="Logos de cabeçalho e rodapé, cor, uma ou duas colunas, fotos por questão ou por tópico, e quem recebe o PDF por e-mail. Hoje o relatório sai no layout padrão." /></div>}
    </>
  );
}

// ======================= Aba Questões =======================
function AbaQuestoes({ def, edit, sel, setSel }: { def: FormDefinition; edit: (fn: (d: FormDefinition) => void) => void; sel: string | null; setSel: (k: string | null) => void }) {
  const idx = useMemo(() => indexDef(def), [def]);
  const selQ = sel ? idx.questions.get(sel) : undefined;
  const choiceQs = [...idx.questions.values()].filter((x) => x.q.tipo === "escolha_simples" || x.q.tipo === "escolha_multipla");

  const findQ = (d: FormDefinition, key: string) => {
    for (const t of d.topicos) { const i = t.questoes.findIndex((q) => q.key === key); if (i >= 0) return { t, i }; }
    return null;
  };
  const moverQ = (key: string, dir: -1 | 1) => edit((d) => {
    const f = findQ(d, key); if (!f) return;
    const j = f.i + dir;
    if (j >= 0 && j < f.t.questoes.length) { const [q] = f.t.questoes.splice(f.i, 1); f.t.questoes.splice(j, 0, q!); return; }
    const ti = d.topicos.indexOf(f.t) + dir; // passa para o tópico vizinho
    const alvo = d.topicos[ti]; if (!alvo) return;
    const [q] = f.t.questoes.splice(f.i, 1);
    if (dir < 0) alvo.questoes.push(q!); else alvo.questoes.unshift(q!);
  });
  const addQ = (topicKey: string, after?: string) => {
    const q = novaQuestao();
    edit((d) => {
      const t = d.topicos.find((x) => x.key === topicKey)!;
      const i = after ? t.questoes.findIndex((x) => x.key === after) + 1 : t.questoes.length;
      t.questoes.splice(i, 0, q);
    });
    setSel(q.key);
  };
  const addT = () => {
    const q = novaQuestao();
    edit((d) => d.topicos.push({ key: uuid(), titulo: `Tópico ${d.topicos.length + 1}`, questoes: [q] }));
    setSel(q.key);
  };

  return (
    <div className="builder">
      <nav className="outline card flat" aria-label="Estrutura do formulário" style={{ padding: "var(--space-3)" }}>
        {def.topicos.map((t) => (
          <div key={t.key}>
            <a className="outline-t truncate" href={"#t-" + t.key} onClick={(e: { preventDefault(): void }) => { e.preventDefault(); document.getElementById("t-" + t.key)?.scrollIntoView({ behavior: "smooth" }); }}>{t.titulo || "Sem título"}</a>
            {t.questoes.map((q) => (
              <a key={q.key} className="outline-q" href={"#q-" + q.key} onClick={(e: { preventDefault(): void }) => { e.preventDefault(); setSel(q.key); document.getElementById("q-" + q.key)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                <span className="num">{idx.questions.get(q.key)!.numero}</span><span className="truncate">{q.titulo || "Sem título"}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="stack">
        {def.topicos.map((t, ti) => (
          <section key={t.key} className="topic-block" id={"t-" + t.key} aria-label={"Tópico " + (t.titulo || ti + 1)}>
            <div className="row" style={{ gap: 4 }}>
              <input className="topic-title grow" value={t.titulo} aria-label="Título do tópico" placeholder="Título do tópico"
                onChange={(e: { target: { value: string } }) => edit((d) => { d.topicos[ti]!.titulo = e.target.value; })} />
              <Button variant="ghost" size="sm" icon="up" label="Subir tópico" disabled={ti === 0} onClick={() => edit((d) => { const [x] = d.topicos.splice(ti, 1); d.topicos.splice(ti - 1, 0, x!); })} />
              <Button variant="ghost" size="sm" icon="down" label="Descer tópico" disabled={ti === def.topicos.length - 1} onClick={() => edit((d) => { const [x] = d.topicos.splice(ti, 1); d.topicos.splice(ti + 1, 0, x!); })} />
              <Button variant="ghost" size="sm" icon="trash" label="Excluir tópico" disabled={def.topicos.length === 1}
                onClick={() => { if (confirm(`Excluir o tópico "${t.titulo}" e suas ${t.questoes.length} questões?`)) edit((d) => { d.topicos.splice(ti, 1); }); }} />
            </div>
            {t.depende_de ? <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Aparece só quando a questão {idx.questions.get(t.depende_de.questao)?.numero ?? "?"} tiver a opção escolhida.</span> : null}
            {t.questoes.map((q) => {
              const n = idx.questions.get(q.key)!.numero;
              const ativo = sel === q.key;
              const ti2 = tipoInfo(q.tipo);
              return (
                <div key={q.key} id={"q-" + q.key} className={"qblock" + (ativo ? " sel" : "")} role="button" tabIndex={0} aria-pressed={ativo}
                  onClick={() => setSel(q.key)} onKeyDown={(e: { key: string; preventDefault(): void }) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(q.key); } }}>
                  <div className="qhead">
                    <span className="qnum">{n}</span>
                    <span className="grow" style={{ fontWeight: 600 }}>{q.titulo || <span className="muted">Questão sem título</span>}{q.obrigatoria ? <span style={{ color: "var(--c-danger)" }} aria-label="obrigatória"> *</span> : null}</span>
                    <Badge tone="acc" icon={ti2.icon}>{ti2.label}</Badge>
                  </div>
                  <div className="row" style={{ marginTop: 6, marginLeft: 30, gap: 6 }}>
                    {q.opcoes?.length ? <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{q.opcoes.map((o) => o.texto).join(" · ")}</span> : null}
                    {q.numerica?.limite && (q.numerica.limite.min != null || q.numerica.limite.max != null) ? <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>Limite {q.numerica.limite.min ?? "−∞"} a {q.numerica.limite.max ?? "∞"} {q.numerica.unidade ?? ""}</span> : null}
                    {q.calculo ? <span className="mono muted" style={{ fontSize: "var(--text-xs)" }}>= {q.calculo.formula || "?"}</span> : null}
                    {q.depende_de ? <Badge tone="na" icon="flow">Depende da {idx.questions.get(q.depende_de.questao)?.numero ?? "?"}</Badge> : null}
                    {q.foto_obrigatoria ? <Badge tone="na" icon="camera">Foto</Badge> : null}
                  </div>
                  {ativo ? (
                    <div className="row" style={{ marginTop: "var(--space-3)", gap: 4, marginLeft: 26 }} onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" icon="up" onClick={() => moverQ(q.key, -1)}>Subir</Button>
                      <Button variant="ghost" size="sm" icon="down" onClick={() => moverQ(q.key, 1)}>Descer</Button>
                      <Button variant="ghost" size="sm" icon="copy" onClick={() => {
                        const c: Question = { ...structuredClone(q), key: uuid(), titulo: q.titulo + " (cópia)", opcoes: q.opcoes?.map((o) => ({ ...o, key: uuid() })) };
                        edit((d) => { const f = findQ(d, q.key)!; f.t.questoes.splice(f.i + 1, 0, c); }); setSel(c.key);
                      }}>Duplicar</Button>
                      <Button variant="ghost" size="sm" icon="trash" onClick={() => {
                        edit((d) => { const f = findQ(d, q.key)!; f.t.questoes.splice(f.i, 1); }); setSel(null);
                      }}>Excluir</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="row">
              <Button variant="ghost" icon="plus" onClick={() => addQ(t.key, sel && t.questoes.some((q) => q.key === sel) ? sel : undefined)}>Nova questão</Button>
            </div>
          </section>
        ))}
        <Button variant="secondary" icon="plus" onClick={addT}>Novo tópico</Button>
      </div>

      <aside className="panel card" aria-label="Configurações da questão">
        {selQ ? <PainelQuestao key={selQ.q.key} q={selQ.q} numero={selQ.numero} topic={selQ.topic} idx={idx} choiceQs={choiceQs}
          set={(fn) => edit((d) => { const f = findQ(d, selQ.q.key); if (f) fn(f.t.questoes[f.i]!, f.t); })} />
          : <EmptyState icon="edit" title="Escolha uma questão" text="Clique numa questão para configurar tipo, pontos, conformidade e regras." />}
      </aside>
    </div>
  );
}

function PainelQuestao({ q, numero, topic, idx, choiceQs, set }: {
  q: Question; numero: number; topic: Topic; idx: ReturnType<typeof indexDef>;
  choiceQs: { q: Question; numero: number }[]; set: (fn: (q: Question, t: Topic) => void) => void;
}) {
  const setQ = (patch: Partial<Question>) => set((x) => Object.assign(x, patch));
  const setOpt = (k: number, patch: Partial<Option>) => set((x) => Object.assign(x.opcoes![k]!, patch));
  const pontuavel = q.tipo === "escolha_simples" || q.tipo === "escolha_multipla" || q.tipo === "numerica";
  const formulaInfo = useMemo(() => {
    if (q.tipo !== "calculo") return null;
    try {
      const refs = formulaReferences(q.calculo?.formula ?? "");
      const bad = refs.filter((n) => { const t = idx.byNumber.get(n); return !t || (t.tipo !== "numerica" && t.tipo !== "calculo") || t.key === q.key; });
      const teste = evaluateFormula(q.calculo?.formula ?? "0", () => 1);
      return { ok: !bad.length, msg: bad.length ? `[${bad.join("], [")}] não é questão numérica` : `Com todos os valores = 1, resulta ${fmt.num(teste)}` };
    } catch (e) {
      return { ok: false, msg: (e as Error).message };
    }
  }, [q.calculo?.formula, idx]);

  return (
    <div className="stack">
      <div className="row-between"><h2 style={{ fontSize: "var(--text-base)" }}>Questão {numero}</h2><span className="muted" style={{ fontSize: "var(--text-xs)" }}>{topic.titulo}</span></div>
      <TextField label="Pergunta" value={q.titulo} onChange={(v) => setQ({ titulo: v })} multiline rows={2} placeholder="Ex.: A câmara fria está entre −2 °C e 4 °C?" />
      <div className="field">
        <label htmlFor="tipo-q">Tipo de resposta</label>
        <select id="tipo-q" className="select" value={q.tipo} onChange={(e: { target: { value: string } }) => set((x) => {
          const n = ajustarTipo(x, e.target.value as QuestionType);
          for (const k of Object.keys(x)) delete (x as unknown as Record<string, unknown>)[k];
          Object.assign(x, n);
        })}>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>

      {q.tipo === "escolha_simples" || q.tipo === "escolha_multipla" ? (
        <div className="stack-sm">
          <div className="label">Opções, pontos e conformidade</div>
          <div className="opt-row muted" style={{ fontSize: "var(--text-xs)" }}><span>Texto</span><span>Pontos</span><span>Resultado</span><span /></div>
          {(q.opcoes ?? []).map((o, k) => (
            <div key={o.key} className="stack-sm" style={{ gap: 4 }}>
              <div className="opt-row">
                <input className="input" aria-label={`Texto da opção ${k + 1}`} value={o.texto} onChange={(e: { target: { value: string } }) => setOpt(k, { texto: e.target.value })} />
                <input className="input num" aria-label={`Pontos da opção ${k + 1}`} inputMode="decimal" disabled={o.na}
                  value={o.na ? "" : String(o.pontos ?? "").replace(".", ",")} onChange={(e: { target: { value: string } }) => setOpt(k, { pontos: parseNumero(e.target.value) ?? undefined })} />
                <select className="select" style={{ height: 36, fontSize: "var(--text-sm)" }} aria-label={`Resultado da opção ${k + 1}`}
                  value={o.na ? "na" : o.conforme === true ? "ok" : o.conforme === false ? "nc" : "neutro"}
                  onChange={(e: { target: { value: string } }) => {
                    const v = e.target.value;
                    setOpt(k, { na: v === "na" || undefined, conforme: v === "ok" ? true : v === "nc" ? false : null, pontos: v === "na" ? undefined : o.pontos ?? 0 });
                  }}>
                  <option value="ok">Conforme</option><option value="nc">Não conforme</option><option value="neutro">Sem regra</option><option value="na">Não se aplica</option>
                </select>
                <Button variant="ghost" size="sm" icon="x" label={`Remover opção ${k + 1}`} disabled={(q.opcoes?.length ?? 0) <= 2}
                  onClick={() => set((x) => { x.opcoes!.splice(k, 1); })} />
              </div>
              {o.conforme === false ? (
                <div className="row" style={{ gap: 6, paddingLeft: 4, fontSize: "var(--text-xs)" }}>
                  <label className="muted" htmlFor={"desc-" + o.key}>Desconto</label>
                  <input id={"desc-" + o.key} className="input num" style={{ width: 64, height: 30 }} inputMode="numeric" value={o.desconto?.pct ?? ""}
                    onChange={(e: { target: { value: string } }) => { const v = parseNumero(e.target.value); setOpt(k, { desconto: v ? { pct: Math.min(100, Math.max(0, v)), escopo: o.desconto?.escopo ?? "topico" } : undefined }); }} />
                  <span className="muted">% da nota do</span>
                  <select className="select" style={{ width: "auto", height: 30, fontSize: "var(--text-xs)" }} aria-label="Escopo do desconto" disabled={!o.desconto}
                    value={o.desconto?.escopo ?? "topico"} onChange={(e: { target: { value: string } }) => setOpt(k, { desconto: { pct: o.desconto?.pct ?? 0, escopo: e.target.value as "topico" | "formulario" } })}>
                    <option value="topico">tópico</option><option value="formulario">formulário</option>
                  </select>
                </div>
              ) : null}
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="plus" onClick={() => set((x) => { x.opcoes!.push({ key: uuid(), texto: `Opção ${x.opcoes!.length + 1}`, pontos: 0, conforme: null }); })}>Adicionar opção</Button>
          {(q.opcoes ?? []).some((o) => o.conforme === false) ? (
            <div className="card flat" style={{ padding: "var(--space-3)" }}>
              <div className="label" style={{ marginBottom: 4 }}>Quando a resposta for não conforme, exigir</div>
              <label className="check"><input type="checkbox" checked={!!q.nc_exige?.foto} onChange={(e: { target: { checked: boolean } }) => setQ({ nc_exige: { ...q.nc_exige, foto: e.target.checked } })} />Foto</label>
              <label className="check"><input type="checkbox" checked={!!q.nc_exige?.observacao} onChange={(e: { target: { checked: boolean } }) => setQ({ nc_exige: { ...q.nc_exige, observacao: e.target.checked } })} />Observação</label>
            </div>
          ) : null}
        </div>
      ) : null}

      {q.tipo === "numerica" ? <PainelNumerica q={q} set={set} /> : null}

      {q.tipo === "texto" ? <Switch label="Permitir leitura de código" desc="Mostra o botão da câmera para ler código de barras ou QR." checked={!!q.texto?.leitura_codigo} onChange={(v) => setQ({ texto: { leitura_codigo: v } })} /> : null}

      {q.tipo === "data_hora" ? (
        <div className="field"><label htmlFor="dh">Pedir</label>
          <select id="dh" className="select" value={q.data_hora?.campos ?? "data_hora"} onChange={(e: { target: { value: string } }) => setQ({ data_hora: { campos: e.target.value as "data" | "data_hora" } })}>
            <option value="data">Só a data</option><option value="data_hora">Data e horário</option>
          </select></div>
      ) : null}

      {q.tipo === "calculo" ? (
        <div className="stack-sm">
          <TextField label="Fórmula" value={q.calculo?.formula ?? ""} onChange={(v) => setQ({ calculo: { ...q.calculo, formula: v } })}
            help="Use [n] para o número da questão. Ex.: [3] - [4] ou ([2] / [1]) * 100" className="input mono" error={formulaInfo && !formulaInfo.ok ? formulaInfo.msg : null} />
          {formulaInfo?.ok ? <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{formulaInfo.msg}</span> : null}
          <TextField label="Se alguma questão da fórmula ficar vazia, usar" value={q.calculo?.valor_se_vazio == null ? "" : String(q.calculo.valor_se_vazio)}
            onChange={(v) => setQ({ calculo: { formula: q.calculo?.formula ?? "", valor_se_vazio: parseNumero(v) } })} help="Deixe vazio para o resultado ficar em branco." inputMode="decimal" />
        </div>
      ) : null}

      <div>
        <div className="label" style={{ marginBottom: 2 }}>Regras</div>
        {q.tipo !== "calculo" ? <Switch label="Obrigatória" desc="O aplicador não finaliza sem responder." checked={!!q.obrigatoria} onChange={(v) => setQ({ obrigatoria: v })} /> : null}
        {q.tipo !== "calculo" && q.tipo !== "assinatura" ? <Switch label="Foto obrigatória" desc="Exige pelo menos uma foto em qualquer resposta." checked={!!q.foto_obrigatoria} onChange={(v) => setQ({ foto_obrigatoria: v })} /> : null}
        <Switch label="Texto de ajuda" desc="Aparece no botão de ajuda da questão, no app." checked={q.ajuda !== undefined} onChange={(v) => setQ({ ajuda: v ? { texto: "" } : undefined })} />
        {q.ajuda !== undefined ? <TextField label="Ajuda" value={q.ajuda.texto ?? ""} onChange={(v) => setQ({ ajuda: { texto: v } })} multiline rows={2} /> : null}
        <Switch label="Mostrar só sob condição" desc="A questão aparece apenas quando outra resposta for escolhida." checked={!!q.depende_de}
          onChange={(v) => {
            const alvo = choiceQs.find((c) => c.q.key !== q.key && c.numero < numero) ?? choiceQs.find((c) => c.q.key !== q.key);
            setQ({ depende_de: v && alvo ? { questao: alvo.q.key, opcao: alvo.q.opcoes![0]!.key } : undefined });
          }} disabled={!choiceQs.some((c) => c.q.key !== q.key)} />
        {q.depende_de ? (
          <div className="stack-sm">
            <div className="field"><label htmlFor="dep-q">Quando a questão</label>
              <select id="dep-q" className="select" value={q.depende_de.questao} onChange={(e: { target: { value: string } }) => {
                const t = choiceQs.find((c) => c.q.key === e.target.value)!;
                setQ({ depende_de: { questao: t.q.key, opcao: t.q.opcoes![0]!.key } });
              }}>
                {choiceQs.filter((c) => c.q.key !== q.key).map((c) => <option key={c.q.key} value={c.q.key}>{c.numero}. {c.q.titulo || "Sem título"}</option>)}
              </select></div>
            <div className="field"><label htmlFor="dep-o">tiver a resposta</label>
              <select id="dep-o" className="select" value={q.depende_de.opcao} onChange={(e: { target: { value: string } }) => setQ({ depende_de: { questao: q.depende_de!.questao, opcao: e.target.value } })}>
                {(idx.questions.get(q.depende_de.questao)?.q.opcoes ?? []).map((o) => <option key={o.key} value={o.key}>{o.texto}</option>)}
              </select></div>
          </div>
        ) : null}
      </div>
      {!pontuavel ? <p className="muted" style={{ fontSize: "var(--text-xs)", margin: 0 }}>Este tipo de questão não entra na nota.</p> : null}
    </div>
  );
}

function PainelNumerica({ q, set }: { q: Question; set: (fn: (q: Question) => void) => void }) {
  const n = q.numerica ?? { formato: "decimal" as const };
  const setN = (patch: Partial<NonNullable<Question["numerica"]>>) => set((x) => { x.numerica = { ...n, ...patch }; });
  const faixas = n.faixas_nota ?? [];
  const numTxt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
  return (
    <div className="stack-sm">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field grow"><label htmlFor="fmt">Formato</label>
          <select id="fmt" className="select" value={n.formato} onChange={(e: { target: { value: string } }) => setN({ formato: e.target.value as "decimal" })}>
            <option value="decimal">Decimal</option><option value="inteiro">Inteiro</option><option value="percentual">Percentual</option>
          </select></div>
        <div className="grow"><TextField label="Unidade" value={n.unidade ?? ""} onChange={(v) => setN({ unidade: v || undefined })} placeholder="°C, kg, un" /></div>
      </div>
      <div className="label">Limite de conformidade</div>
      <div className="row">
        <div className="grow"><TextField label="Mínimo" value={numTxt(n.limite?.min)} inputMode="decimal" onChange={(v) => setN({ limite: { ...n.limite, min: parseNumero(v) } })} /></div>
        <div className="grow"><TextField label="Máximo" value={numTxt(n.limite?.max)} inputMode="decimal" onChange={(v) => setN({ limite: { ...n.limite, max: parseNumero(v) } })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={!!n.limite?.obs_obrigatoria} onChange={(e: { target: { checked: boolean } }) => setN({ limite: { ...n.limite, obs_obrigatoria: e.target.checked } })} />Fora do limite, exigir observação</label>
      <div className="label">Pontos por faixa</div>
      {faixas.map((f, k) => {
        const anterior = k === 0 ? null : faixas[k - 1]!.ate;
        return (
          <div key={k} className="row" style={{ gap: 6 }}>
            <span className="muted" style={{ minWidth: 64, fontSize: "var(--text-xs)" }}>{k === 0 ? "até" : `> ${numTxt(anterior)} até`}</span>
            <input className="input num" style={{ width: 80, height: 36 }} aria-label={`Fim da faixa ${k + 1}`} placeholder="acima" inputMode="decimal"
              value={numTxt(f.ate)} disabled={k === faixas.length - 1 && f.ate === null && faixas.length > 1}
              onChange={(e: { target: { value: string } }) => set((x) => { x.numerica!.faixas_nota![k]!.ate = parseNumero(e.target.value); })} />
            <span className="muted">→</span>
            <input className="input num" style={{ width: 64, height: 36 }} aria-label={`Pontos da faixa ${k + 1}`} inputMode="decimal" value={numTxt(f.pontos)}
              onChange={(e: { target: { value: string } }) => set((x) => { x.numerica!.faixas_nota![k]!.pontos = parseNumero(e.target.value) ?? 0; })} />
            <span className="muted" style={{ fontSize: "var(--text-xs)" }}>pts</span>
            <Button variant="ghost" size="sm" icon="x" label={`Remover faixa ${k + 1}`} onClick={() => set((x) => { x.numerica!.faixas_nota!.splice(k, 1); })} />
          </div>
        );
      })}
      <Button variant="ghost" size="sm" icon="plus" onClick={() => set((x) => {
        const fs = (x.numerica!.faixas_nota ??= []);
        const last = fs[fs.length - 1];
        if (last && last.ate === null) fs.splice(fs.length - 1, 0, { ate: 0, pontos: 0 });
        else fs.push({ ate: fs.length ? null : 0, pontos: 0 });
      })}>Adicionar faixa</Button>
      {!faixas.length ? <p className="muted" style={{ fontSize: "var(--text-xs)", margin: 0 }}>Sem faixas, o número é registrado mas não entra na nota.</p> : null}
    </div>
  );
}

// ======================= Aba Configurações (S15) =======================
function AbaConfig({ def, edit }: { def: FormDefinition; edit: (fn: (d: FormDefinition) => void) => void }) {
  const c = def.config;
  const set = (patch: Partial<FormDefinition["config"]>) => edit((d) => { Object.assign(d.config, patch); });
  const cls = c.classificacoes ?? [];
  const CORES = [{ v: "rank-good", l: "Verde (bom)" }, { v: "rank-mid", l: "Âmbar (atenção)" }, { v: "rank-bad", l: "Vermelho (ruim)" }];
  return (
    <div className="stack" style={{ maxWidth: "var(--layout-form-max)" }}>
      <section className="card">
        <h2 style={{ fontSize: "var(--text-lg)" }}>Nota</h2>
        <Switch label="Calcular nota" desc="Soma os pontos das respostas e mostra um percentual." checked={c.calcular_nota !== false} onChange={(v) => set({ calcular_nota: v })} />
        <Switch label="Esconder a nota durante a aplicação" desc="O aplicador só vê a nota depois de finalizar." checked={!!c.ocultar_nota} onChange={(v) => set({ ocultar_nota: v })} disabled={c.calcular_nota === false} />
        <div className="toggle-row">
          <div><label className="t" htmlFor="casas">Casas decimais</label><div className="d">Como a nota aparece: 87, 86,7 ou 86,67.</div></div>
          <select id="casas" className="select" style={{ width: 96 }} value={c.casas_decimais ?? 1} onChange={(e: { target: { value: string } }) => set({ casas_decimais: Number(e.target.value) as 0 | 1 | 2 })}>
            <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
          </select>
        </div>
      </section>

      <section className="card stack-sm">
        <h2 style={{ fontSize: "var(--text-lg)" }}>Classificação da nota</h2>
        <p className="muted" style={{ margin: 0 }}>Faixas com nome e cor. Aparecem no histórico, no relatório e decidem caminhos de workflow.</p>
        {cls.length ? (
          <div className="bar" style={{ margin: "var(--space-3) 0" }} aria-hidden="true">
            {[...cls].sort((a, b) => a.min - b.min).map((f, k) => <i key={k} style={{ width: `${Math.max(0, Math.min(100, f.max) - f.min)}%`, background: corClassificacao(f.cor) }} />)}
          </div>
        ) : null}
        {cls.map((f, k) => (
          <div key={k} className="row" style={{ gap: 6, alignItems: "flex-end" }}>
            <div className="grow"><TextField label={k === 0 ? "Nome" : ""} aria-label={`Nome da faixa ${k + 1}`} value={f.nome} onChange={(v) => edit((d) => { d.config.classificacoes![k]!.nome = v; })} /></div>
            <div className="field"><label htmlFor={"cor" + k} className={k ? "sr-only" : ""}>Cor</label>
              <select id={"cor" + k} className="select" value={f.cor} onChange={(e: { target: { value: string } }) => edit((d) => { d.config.classificacoes![k]!.cor = e.target.value; })}>
                {CORES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select></div>
            <div style={{ width: 80 }}><TextField label={k === 0 ? "De %" : ""} aria-label={`Início da faixa ${k + 1}`} inputMode="decimal" value={String(f.min).replace(".", ",")} onChange={(v) => edit((d) => { d.config.classificacoes![k]!.min = parseNumero(v) ?? 0; })} /></div>
            <div style={{ width: 80 }}><TextField label={k === 0 ? "Até %" : ""} aria-label={`Fim da faixa ${k + 1}`} inputMode="decimal" value={String(f.max).replace(".", ",")} onChange={(v) => edit((d) => { d.config.classificacoes![k]!.max = parseNumero(v) ?? 0; })} /></div>
            <Button variant="ghost" icon="x" label={`Remover faixa ${f.nome}`} onClick={() => edit((d) => { d.config.classificacoes!.splice(k, 1); })} />
          </div>
        ))}
        <div><Button variant="ghost" size="sm" icon="plus" onClick={() => edit((d) => { (d.config.classificacoes ??= []).push({ nome: "Nova faixa", cor: "rank-mid", min: 0, max: 0 }); })}>Adicionar faixa</Button></div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: "var(--text-lg)" }}>Aplicação</h2>
        <div className="toggle-row">
          <div><label className="t" htmlFor="reinc">Reincidência</label><div className="d">Por quantos meses o app compara com a inspeção anterior do mesmo avaliado.</div></div>
          <select id="reinc" className="select" style={{ width: 120 }} value={c.reincidencia_meses ?? 3} onChange={(e: { target: { value: string } }) => set({ reincidencia_meses: Number(e.target.value) })}>
            {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>)}
          </select>
        </div>
        <div className="toggle-row">
          <div><span className="t">Localização do aplicador</span><div className="d">Chega no marco 3.</div></div>
          <Badge tone="na">M3</Badge>
        </div>
      </section>
    </div>
  );
}

// ======================= Aba Avaliados (S17) =======================
function AbaAvaliados({ avaliados, vinculados, set }: { avaliados: Avaliado[]; vinculados: string[]; set: (ids: string[]) => void }) {
  const todos = vinculados.length === 0;
  return (
    <div className="card" style={{ maxWidth: "var(--layout-form-max)" }}>
      <h2 style={{ fontSize: "var(--text-lg)" }}>Onde este formulário é aplicado</h2>
      <p className="muted">{todos ? "Nenhum avaliado marcado: o formulário vale para todos." : `Vale só para ${vinculados.length} ${vinculados.length === 1 ? "avaliado" : "avaliados"}.`}</p>
      {!avaliados.length ? <EmptyState icon="store" title="Nenhum avaliado cadastrado" /> : (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Avaliados</legend>
          {avaliados.map((a) => (
            <label key={a.id} className="check" style={{ borderBottom: "1px solid var(--c-border)" }}>
              <input type="checkbox" checked={vinculados.includes(a.id)}
                onChange={(e: { target: { checked: boolean } }) => set(e.target.checked ? [...vinculados, a.id] : vinculados.filter((x) => x !== a.id))} />
              <span className="grow"><b>{a.nome}</b><br /><span className="muted" style={{ fontSize: "var(--text-xs)" }}>{[a.codigo_externo, a.endereco].filter(Boolean).join(" · ")}</span></span>
            </label>
          ))}
        </fieldset>
      )}
      {!todos ? <div style={{ marginTop: "var(--space-3)" }}><Button variant="ghost" onClick={() => set([])}>Liberar para todos</Button></div> : null}
    </div>
  );
}
