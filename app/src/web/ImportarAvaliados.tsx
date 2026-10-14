// S23 — Importar avaliados: arquivo → associar colunas → prévia → importar
import { useEffect, useMemo, useRef, useState } from "react";
import { server } from "../data/server";
import type { LinhaImportacao, ResultadoImportacao } from "../data/types";
import { baixar } from "../pdf";
import { gerarCsv, lerPlanilha, type Tabela } from "../planilha";
import { Icon } from "../ui/icons";
import { useData } from "../ui/hooks";
import { Badge, Button, ButtonLink, Callout, EmptyState, PageHeader, useToast } from "../ui/primitives";

type Padrao = Exclude<keyof LinhaImportacao, "campos">;
type Campo = Padrao | `campo:${string}` | "";
const CAMPOS: { v: Campo; label: string; sinonimos: string[] }[] = [
  { v: "nome", label: "Nome do avaliado", sinonimos: ["nome", "avaliado", "loja", "unidade", "razao social", "fantasia", "setor", "local"] },
  { v: "codigo_externo", label: "Código", sinonimos: ["codigo", "cod", "id", "filial", "numero da loja", "cod loja"] },
  { v: "documento", label: "CNPJ / CPF", sinonimos: ["cnpj", "cpf", "documento", "doc"] },
  { v: "email", label: "E-mail", sinonimos: ["email", "e-mail", "correio"] },
  { v: "telefone", label: "Telefone", sinonimos: ["telefone", "fone", "celular", "whatsapp", "tel"] },
  { v: "endereco", label: "Endereço", sinonimos: ["endereco", "logradouro", "rua", "bairro"] },
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();

function sugerir(cabecalho: string[], todos: typeof CAMPOS): Campo[] {
  const usados = new Set<Campo>();
  return cabecalho.map((h) => {
    const n = norm(h);
    const c = todos.find((x) => !usados.has(x.v) && x.sinonimos.some((s) => n === s || n.startsWith(s + " ") || n.endsWith(" " + s)));
    if (c) { usados.add(c.v); return c.v; }
    return "";
  });
}

export function ImportarAvaliados() {
  const toast = useToast();
  const input = useRef<HTMLInputElement | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [mapa, setMapa] = useState<Campo[]>([]);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const extras = useData(() => server.listarCamposAvaliado(), [], ["avaliados"]);
  const todos = useMemo(() => [...CAMPOS, ...(extras.data ?? []).map((c) => ({ v: `campo:${c.id}` as Campo, label: c.nome + (c.tipo === "lista" ? ` (${(c.opcoes ?? []).join(" / ")})` : ""), sinonimos: [norm(c.nome)] }))], [extras.data]);
  // os campos personalizados podem chegar depois do arquivo: completa as colunas que ficaram sem destino
  useEffect(() => {
    if (!tabela || !extras.data?.length) return;
    const sug = sugerir(tabela[0]!, todos);
    setMapa((m) => m.map((x, k) => x || (m.includes(sug[k]!) ? "" : sug[k]!) || ""));
  }, [todos]);
  const [feito, setFeito] = useState<ResultadoImportacao | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const cab = tabela?.[0] ?? [];
  const corpo = tabela?.slice(1) ?? [];
  const linhas: LinhaImportacao[] = useMemo(() => corpo.map((r) => {
    const l: LinhaImportacao = {};
    mapa.forEach((c, i) => {
      if (!c || !r[i]) return;
      if (c.startsWith("campo:")) (l.campos ??= {})[c.slice(6)] = r[i]!;
      else l[c as Padrao] = r[i];
    });
    return l;
  }), [tabela, mapa]);
  const duplicados = todos.filter((c) => mapa.filter((m) => m === c.v).length > 1).map((c) => c.label);
  const semNome = !mapa.includes("nome");

  useEffect(() => {
    if (!tabela || semNome || duplicados.length) { setPrevia(null); return; }
    let vivo = true;
    void server.importarAvaliados(linhas, { simular: true }).then((r) => { if (vivo) setPrevia(r); });
    return () => { vivo = false; };
  }, [linhas]);

  async function abrir(f: File) {
    setLendo(true); setErroArquivo(null); setFeito(null);
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error("Arquivo acima de 5 MB.");
      const t = await lerPlanilha(f);
      if (t.length < 2) throw new Error("A planilha precisa de uma linha de cabeçalho e pelo menos uma linha de dados.");
      setTabela(t); setMapa(sugerir(t[0]!, todos)); setArquivo(f.name);
    } catch (e) {
      setTabela(null); setErroArquivo((e as Error).message);
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    setImportando(true);
    try {
      const r = await server.importarAvaliados(linhas);
      setFeito(r);
      toast({ tone: "info", text: `${r.novos} novos e ${r.atualizados} atualizados.` });
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setImportando(false);
    }
  }

  const modelo = () => baixar(gerarCsv([
    ["Nome", "Código", "CNPJ", "E-mail", "Telefone", "Endereço", ...(extras.data ?? []).map((c) => c.nome)],
    ["Loja 05 — Tucumã", "LJ05", "12.345.678/0005-90", "gerencia.lj05@empresa.com.br", "(68) 99999-0000", "Rua Exemplo, 100", ...(extras.data ?? []).map((c) => c.opcoes?.[0] ?? "")],
  ]), "modelo-avaliados.csv", "text/csv;charset=utf-8");

  return (
    <>
      <PageHeader crumbs={[{ to: "/web/avaliados", label: "Avaliados" }]} title="Importar avaliados"
        desc="Suba uma planilha do Excel (.xlsx) ou um .csv. Quem já existe com o mesmo código é atualizado; o resto entra como novo."
        actions={<Button variant="secondary" icon="download" onClick={modelo}>Baixar modelo</Button>} />

      {feito ? (
        <div className="card">
          <EmptyState icon="check" title="Importação concluída"
            text={`${feito.novos} ${feito.novos === 1 ? "avaliado novo" : "avaliados novos"}, ${feito.atualizados} ${feito.atualizados === 1 ? "atualizado" : "atualizados"}${feito.erros.length ? ` e ${feito.erros.length} ${feito.erros.length === 1 ? "linha ignorada" : "linhas ignoradas"}` : ""}.`}
            action={<div className="row"><ButtonLink to="/web/avaliados" icon="store">Ver avaliados</ButtonLink><Button variant="secondary" onClick={() => { setTabela(null); setFeito(null); setArquivo(null); }}>Importar outro arquivo</Button></div>} />
        </div>
      ) : (
        <div className="stack">
          <section className="card stack-sm" aria-labelledby="p1">
            <h2 id="p1" style={{ fontSize: "var(--text-base)" }}><span className="muted">1.</span> Arquivo</h2>
            <div role="button" tabIndex={0} aria-label="Escolher planilha" aria-busy={lendo ? "true" : undefined}
              onClick={() => input.current?.click()} onKeyDown={(e: { key: string }) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
              onDragOver={(e: { preventDefault(): void }) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
              onDrop={(e: { preventDefault(): void; dataTransfer: DataTransfer }) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files[0]; if (f) void abrir(f); }}
              style={{ border: `var(--bw-strong) dashed ${arrastando ? "var(--c-accent)" : "var(--c-border-input)"}`, background: arrastando ? "var(--c-accent-soft)" : "var(--c-surface)",
                borderRadius: "var(--radius-lg)", padding: "var(--space-8) var(--space-4)", textAlign: "center", cursor: "pointer" }}>
              {lendo ? <span className="spin" style={{ margin: "0 auto" }} /> : <Icon n="upload" size="xl" />}
              <div style={{ fontWeight: 600, marginTop: 8 }}>{arquivo ?? "Arraste a planilha aqui ou clique para escolher"}</div>
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>.xlsx ou .csv · até 5 MB · primeira aba · primeira linha é o cabeçalho</div>
            </div>
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="Arquivo da planilha"
              onChange={(e: { target: HTMLInputElement }) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void abrir(f); }} />
            {erroArquivo ? <Callout tone="danger">{erroArquivo}</Callout> : null}
          </section>

          {tabela ? (
            <>
              <section className="card stack-sm" aria-labelledby="p2">
                <h2 id="p2" style={{ fontSize: "var(--text-base)" }}><span className="muted">2.</span> Associe as colunas</h2>
                <p className="muted" style={{ margin: 0 }}>{corpo.length} {corpo.length === 1 ? "linha" : "linhas"} encontradas. Já sugeri pelo nome das colunas; confira.</p>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Coluna da planilha</th><th>Exemplos</th><th>Vai para</th></tr></thead>
                    <tbody>{cab.map((h, i) => {
                      const ex = corpo.map((r) => r[i]).filter(Boolean).slice(0, 3);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{h || <span className="muted">(sem título, coluna {i + 1})</span>}</td>
                          <td className="muted" style={{ fontSize: "var(--text-xs)", maxWidth: 320 }}><span className="truncate" style={{ display: "block" }}>{ex.join(" · ") || "vazia"}</span></td>
                          <td style={{ width: 240 }}>
                            <select className="select" aria-label={`Campo para a coluna ${h || i + 1}`} value={mapa[i] ?? ""}
                              style={mapa[i] ? { borderColor: "var(--c-accent)" } : undefined}
                              onChange={(e: { target: { value: string } }) => setMapa((m) => m.map((x, k) => (k === i ? (e.target.value as Campo) : x)))}>
                              <option value="">Ignorar</option>
                              <optgroup label="Cadastro">{CAMPOS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</optgroup>
                              {extras.data?.length ? <optgroup label="Campos personalizados">{todos.slice(CAMPOS.length).map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</optgroup> : null}
                            </select>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                {semNome ? <Callout tone="danger">Escolha qual coluna é o <b>Nome do avaliado</b>. É o único campo obrigatório.</Callout> : null}
                {duplicados.length ? <Callout tone="danger">Duas colunas apontam para o mesmo campo: {duplicados.join(", ")}.</Callout> : null}
              </section>

              <section className="card stack-sm" aria-labelledby="p3" aria-live="polite">
                <h2 id="p3" style={{ fontSize: "var(--text-base)" }}><span className="muted">3.</span> Prévia</h2>
                {!previa ? <span className="muted">{semNome || duplicados.length ? "Ajuste as colunas para ver a prévia." : "Calculando…"}</span> : (
                  <>
                    <div className="row">
                      <Badge tone="ok" icon="plus">{previa.novos} {previa.novos === 1 ? "novo" : "novos"}</Badge>
                      <Badge tone="acc" icon="refresh">{previa.atualizados} {previa.atualizados === 1 ? "atualizado" : "atualizados"}</Badge>
                      {previa.erros.length ? <Badge tone="nc" icon="alert">{previa.erros.length} com problema</Badge> : null}
                    </div>
                    {previa.erros.length ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }} className="muted">
                        {previa.erros.slice(0, 8).map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                        {previa.erros.length > 8 ? <li>e mais {previa.erros.length - 8}…</li> : null}
                      </ul>
                    ) : null}
                    {previa.erros.length ? <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>Linhas com problema são ignoradas; as demais entram normalmente.</p> : null}
                    <div><Button icon="upload" loading={importando} disabled={!(previa.novos + previa.atualizados)} onClick={importar}>
                      Importar {previa.novos + previa.atualizados} {previa.novos + previa.atualizados === 1 ? "avaliado" : "avaliados"}
                    </Button></div>
                  </>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
