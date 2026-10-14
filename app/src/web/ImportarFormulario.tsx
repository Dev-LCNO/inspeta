// S20 — Importar formulário: baixar modelo → subir planilha → prévia por tópico → criar rascunho no editor
import { useRef, useState } from "react";
import { COLUNAS_MODELO, LINHAS_EXEMPLO, lerFormulario, type ResultadoLeitura } from "../data/importarFormulario";
import { server } from "../data/server";
import { baixar } from "../pdf";
import { gerarCsv, lerPlanilha } from "../planilha";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, PageHeader, TextField, useToast } from "../ui/primitives";
import { navigate } from "../ui/router";

const TIPO_NOME: Record<string, string> = {
  escolha_simples: "Escolha única", escolha_multipla: "Múltipla escolha", numerica: "Número", texto: "Texto", data_hora: "Data", assinatura: "Assinatura",
};

export function ImportarFormulario() {
  const toast = useToast();
  const input = useRef<HTMLInputElement | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [res, setRes] = useState<ResultadoLeitura | null>(null);
  const [nome, setNome] = useState("");
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function abrir(f: File) {
    setLendo(true); setErroArquivo(null);
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error("Arquivo acima de 5 MB.");
      const r = lerFormulario(await lerPlanilha(f));
      setRes(r); setArquivo(f.name);
      if (!nome) setNome(f.name.replace(/\.(xlsx|csv)$/i, "").replace(/[-_]+/g, " ").trim());
    } catch (e) { setRes(null); setErroArquivo((e as Error).message); }
    finally { setLendo(false); }
  }
  const bloqueia = !!res?.erros.some((e) => e.linha === 0) || !res?.definicao;

  async function criar() {
    if (!res?.definicao) return;
    setCriando(true);
    try {
      const f = await server.criarFormulario(nome, res.definicao);
      toast({ tone: "info", text: `Rascunho criado com ${res.questoes} questões. Revise e publique.` });
      navigate("/web/formularios/" + f.id);
    } catch (e) { toast({ tone: "error", text: (e as Error).message }); setCriando(false); }
  }

  let n = 0;
  return (
    <>
      <PageHeader crumbs={[{ to: "/web/formularios", label: "Formulários" }]} title="Importar formulário"
        desc="Monte o checklist numa planilha, uma linha por questão, e suba aqui. Ele entra como rascunho: dá para ajustar no editor antes de publicar."
        actions={<Button variant="secondary" icon="download" onClick={() => baixar(gerarCsv([COLUNAS_MODELO, ...LINHAS_EXEMPLO]), "modelo-formulario.csv", "text/csv;charset=utf-8")}>Baixar modelo</Button>} />
      <div className="stack">
        <section className="card stack-sm" aria-labelledby="if1">
          <h2 id="if1" style={{ fontSize: "var(--text-base)" }}><span className="muted">1.</span> Planilha</h2>
          <div role="button" tabIndex={0} aria-label="Escolher planilha do formulário" aria-busy={lendo ? "true" : undefined}
            onClick={() => input.current?.click()} onKeyDown={(e: { key: string }) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
            onDragOver={(e: { preventDefault(): void }) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
            onDrop={(e: { preventDefault(): void; dataTransfer: DataTransfer }) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files[0]; if (f) void abrir(f); }}
            className={"dropzone" + (arrastando ? " on" : "")}>
            {lendo ? <span className="spin" style={{ margin: "0 auto" }} /> : <Icon n="upload" size="xl" />}
            <div style={{ fontWeight: 600, marginTop: 8 }}>{arquivo ?? "Arraste a planilha aqui ou clique para escolher"}</div>
            <div className="muted" style={{ fontSize: "var(--text-xs)" }}>.xlsx ou .csv · colunas: {COLUNAS_MODELO.join(", ")}</div>
          </div>
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="Arquivo do formulário"
            onChange={(e: { target: HTMLInputElement }) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void abrir(f); }} />
          {erroArquivo ? <Callout tone="danger">{erroArquivo}</Callout> : null}
          <details className="muted" style={{ fontSize: "var(--text-sm)" }}>
            <summary style={{ cursor: "pointer", color: "var(--c-accent)", fontWeight: 600 }}>Como preencher</summary>
            <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: 18 }}>
              <li><b>Tópico</b> pode ficar vazio: a questão entra no tópico da linha de cima.</li>
              <li><b>Tipo</b>: Sim/Não, Escolha única, Múltipla escolha, Número, Inteiro, Texto, Data, Data e hora ou Assinatura.</li>
              <li><b>Opções</b> e <b>Pontos</b> separados por ponto e vírgula (ou barra vertical |), na mesma ordem. <b>Não conformes</b> lista as opções que são não conformidade.</li>
              <li><b>Mínimo</b> e <b>Máximo</b> definem o limite de conformidade das questões numéricas.</li>
            </ul>
          </details>
        </section>

        {res ? (
          <section className="card stack-sm" aria-labelledby="if2" aria-live="polite">
            <h2 id="if2" style={{ fontSize: "var(--text-base)" }}><span className="muted">2.</span> Prévia</h2>
            <div className="row">
              <Badge tone="ok" icon="list">{res.topicos} {res.topicos === 1 ? "tópico" : "tópicos"}</Badge>
              <Badge tone="ok" icon="check">{res.questoes} {res.questoes === 1 ? "questão" : "questões"}</Badge>
              {res.erros.length ? <Badge tone="nc" icon="alert">{res.erros.length} com problema</Badge> : null}
            </div>
            {res.erros.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }} data-testid="erros-import">
                {res.erros.slice(0, 10).map((e, k) => <li key={k}>{e.linha ? `Linha ${e.linha}: ` : ""}{e.motivo}</li>)}
                {res.erros.length > 10 ? <li>e mais {res.erros.length - 10}…</li> : null}
              </ul>
            ) : null}
            {res.erros.some((e) => e.linha > 0) && !bloqueia ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Linhas com problema ficam de fora; as demais entram. Você pode completar no editor.</p> : null}
            {res.definicao ? (
              <div className="import-previa">
                {res.definicao.topicos.map((t) => (
                  <div key={t.key}>
                    <div style={{ fontWeight: 700, margin: "var(--space-2) 0 var(--space-1)" }}>{t.titulo}</div>
                    <ol start={n + 1} style={{ margin: 0, paddingLeft: 24 }}>
                      {t.questoes.map((q) => { n++; return (
                        <li key={q.key} style={{ padding: "2px 0" }}>{q.titulo} <span className="muted" style={{ fontSize: "var(--text-xs)" }}>· {TIPO_NOME[q.tipo] ?? q.tipo}{q.opcoes ? ` (${q.opcoes.map((o) => o.texto).join(", ")})` : ""}{q.obrigatoria ? "" : " · opcional"}</span></li>
                      ); })}
                    </ol>
                  </div>
                ))}
              </div>
            ) : null}
            {res.definicao ? (
              <div className="row" style={{ alignItems: "flex-end" }}>
                <div className="grow" style={{ maxWidth: 420 }}><TextField label="Nome do formulário" value={nome} onChange={setNome} /></div>
                <Button icon="plus" loading={criando} disabled={bloqueia || !nome.trim()} onClick={() => void criar()}>Criar rascunho</Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
