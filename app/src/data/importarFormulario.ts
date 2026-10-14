// S20 — Planilha → FormDefinition. Puro: a tela lê o arquivo, isto só interpreta as linhas.
// Uma linha por questão; o tópico se repete nas linhas (ou fica vazio e herda o de cima).
import { validateDefinition, type FormDefinition, type Option, type Question, type QuestionType } from "@app/form-engine";

export const COLUNAS_MODELO = ["Tópico", "Questão", "Tipo", "Obrigatória", "Opções", "Pontos", "Não conformes", "Unidade", "Mínimo", "Máximo", "Foto obrigatória", "Ajuda"];

export const LINHAS_EXEMPLO: string[][] = [
  ["Área de venda", "Os produtos estão dentro da validade?", "Sim/Não", "sim", "", "", "", "", "", "", "não", "Confira 3 lotes por bancada."],
  ["", "Condição das bancadas", "Múltipla escolha", "sim", "Limpas; Abastecidas; Com avaria", "5; 5; 0", "Com avaria", "", "", "", "não", ""],
  ["Câmara fria", "Temperatura da câmara", "Número", "sim", "", "", "", "°C", "-2", "4", "sim", "Leia o termômetro da porta."],
  ["", "Estado da porta", "Escolha única", "sim", "Boa; Regular; Ruim", "10; 5; 0", "Ruim", "", "", "", "não", ""],
  ["Encerramento", "Observações gerais", "Texto", "não", "", "", "", "", "", "", "não", ""],
  ["", "Assinatura do responsável", "Assinatura", "sim", "", "", "", "", "", "", "não", ""],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const TIPOS: Record<string, QuestionType | "sim_nao"> = {
  "sim/nao": "sim_nao", "sim nao": "sim_nao", "simnao": "sim_nao",
  "escolha unica": "escolha_simples", "escolha simples": "escolha_simples", "unica": "escolha_simples",
  "multipla escolha": "escolha_multipla", "escolha multipla": "escolha_multipla", "multipla": "escolha_multipla",
  "numero": "numerica", "numerica": "numerica", "decimal": "numerica", "inteiro": "numerica",
  "texto": "texto", "texto aberto": "texto", "data": "data_hora", "data e hora": "data_hora", "assinatura": "assinatura",
};
const sim = (v: string) => ["sim", "s", "x", "1", "true", "verdadeiro", "obrigatoria"].includes(norm(v));
const lista = (v: string) => v.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
const numero = (v: string): number | null => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};

export interface ResultadoLeitura {
  definicao: FormDefinition | null;
  topicos: number;
  questoes: number;
  erros: { linha: number; motivo: string }[];
}

/** `novaChave` vem de fora para o teste ser determinístico. */
export function lerFormulario(tabela: string[][], novaChave: () => string = () => crypto.randomUUID()): ResultadoLeitura {
  const erros: ResultadoLeitura["erros"] = [];
  if (!tabela.length) return { definicao: null, topicos: 0, questoes: 0, erros: [{ linha: 1, motivo: "planilha vazia" }] };
  const cab = tabela[0]!.map(norm);
  const col = (nome: string) => cab.indexOf(norm(nome));
  const ix = Object.fromEntries(COLUNAS_MODELO.map((c) => [c, col(c)]));
  for (const obrig of ["Questão", "Tipo"]) if (ix[obrig]! < 0) erros.push({ linha: 1, motivo: `falta a coluna "${obrig}" (use o modelo)` });
  if (erros.length) return { definicao: null, topicos: 0, questoes: 0, erros };

  const def: FormDefinition = {
    config: { calcular_nota: true, casas_decimais: 1, classificacoes: [
      { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 }, { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 }, { nome: "Bom", cor: "rank-good", min: 85, max: 100 },
    ] },
    topicos: [],
  };
  let topicoAtual = "";
  tabela.slice(1).forEach((linha, k) => {
    const n = k + 2;
    const v = (c: string) => (ix[c]! >= 0 ? (linha[ix[c]!] ?? "").trim() : "");
    if (linha.every((x) => !String(x ?? "").trim())) return; // linha em branco
    const titulo = v("Questão");
    if (v("Tópico")) topicoAtual = v("Tópico");
    if (!titulo) { erros.push({ linha: n, motivo: "questão sem texto" }); return; }
    const tipoTxt = norm(v("Tipo"));
    const tipo = TIPOS[tipoTxt];
    if (!tipo) { erros.push({ linha: n, motivo: `tipo "${v("Tipo")}" não reconhecido (use: Sim/Não, Escolha única, Múltipla escolha, Número, Texto, Data, Assinatura)` }); return; }
    const q: Question = { key: novaChave(), titulo, tipo: tipo === "sim_nao" ? "escolha_simples" : tipo, obrigatoria: v("Obrigatória") ? sim(v("Obrigatória")) : true };
    if (sim(v("Foto obrigatória")) && q.tipo !== "assinatura") q.foto_obrigatoria = true;
    if (v("Ajuda")) q.ajuda = { texto: v("Ajuda") };

    if (tipo === "sim_nao") {
      q.opcoes = [
        { key: novaChave(), texto: "Sim", pontos: 10, conforme: true },
        { key: novaChave(), texto: "Não", pontos: 0, conforme: false },
        { key: novaChave(), texto: "Não se aplica", na: true },
      ];
    } else if (tipo === "escolha_simples" || tipo === "escolha_multipla") {
      const ops = lista(v("Opções"));
      if (ops.length < 2) { erros.push({ linha: n, motivo: "escolha precisa de pelo menos 2 opções separadas por ;" }); return; }
      const pts = lista(v("Pontos")).map(numero);
      if (pts.length && pts.length !== ops.length) { erros.push({ linha: n, motivo: `${ops.length} opções e ${pts.length} pontos: precisam ter a mesma quantidade` }); return; }
      if (pts.some((p) => p !== null && Number.isNaN(p))) { erros.push({ linha: n, motivo: "pontos precisam ser números" }); return; }
      const ncs = lista(v("Não conformes")).map(norm);
      const desconhecida = ncs.find((x) => !ops.some((o) => norm(o) === x));
      if (desconhecida) { erros.push({ linha: n, motivo: `"${desconhecida}" em Não conformes não é uma das opções` }); return; }
      q.opcoes = ops.map((texto, i): Option => {
        const ehNa = ["nao se aplica", "n/a", "na"].includes(norm(texto));
        if (ehNa) return { key: novaChave(), texto, na: true };
        return { key: novaChave(), texto, pontos: pts.length ? (pts[i] ?? 0) : undefined, conforme: ncs.includes(norm(texto)) ? false : true };
      });
    } else if (tipo === "numerica") {
      const min = numero(v("Mínimo")), max = numero(v("Máximo"));
      if (Number.isNaN(min) || Number.isNaN(max)) { erros.push({ linha: n, motivo: "mínimo e máximo precisam ser números" }); return; }
      if (min !== null && max !== null && min > max) { erros.push({ linha: n, motivo: "mínimo maior que o máximo" }); return; }
      q.numerica = { formato: tipoTxt === "inteiro" ? "inteiro" : "decimal", unidade: v("Unidade") || undefined };
      if (min !== null || max !== null) q.numerica.limite = { min, max, obs_obrigatoria: true };
    } else if (tipo === "data_hora") {
      q.data_hora = { campos: tipoTxt === "data" ? "data" : "data_hora" };
    }

    const nomeT = topicoAtual || "Tópico 1";
    let t = def.topicos[def.topicos.length - 1];
    if (!t || t.titulo !== nomeT) { t = { key: novaChave(), titulo: nomeT, questoes: [] }; def.topicos.push(t); }
    t.questoes.push(q);
  });
  if (!def.topicos.length && !erros.length) erros.push({ linha: 2, motivo: "nenhuma questão na planilha" });
  // erros do próprio motor (ex.: chaves) entram como aviso de linha 0
  if (def.topicos.length) for (const p of validateDefinition(def)) erros.push({ linha: 0, motivo: `${p.onde}: ${p.problema}` });
  const questoes = def.topicos.reduce((a, t) => a + t.questoes.length, 0);
  return { definicao: def.topicos.length ? def : null, topicos: def.topicos.length, questoes, erros };
}
