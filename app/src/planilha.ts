// Leitura de planilhas sem dependências: CSV (vírgula ou ponto e vírgula, UTF-8 ou
// Windows-1252) e XLSX (zip + XML, descompactado com DecompressionStream do navegador).
// Devolve a primeira aba como matriz de textos; a linha 0 é o cabeçalho.

export type Tabela = string[][];

export async function lerPlanilha(arquivo: File): Promise<Tabela> {
  const buf = new Uint8Array(await arquivo.arrayBuffer());
  const ehZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
  if (ehZip || /\.xlsx$/i.test(arquivo.name)) return limpar(await lerXlsx(buf));
  if (/\.xls$/i.test(arquivo.name)) throw new Error("Arquivo .xls antigo não é suportado. No Excel, salve como .xlsx ou .csv.");
  return limpar(lerCsv(decodificar(buf)));
}

function limpar(t: Tabela): Tabela {
  const linhas = t.map((r) => r.map((c) => (c ?? "").replace(/ /g, " ").trim()));
  while (linhas.length && linhas[linhas.length - 1]!.every((c) => !c)) linhas.pop();
  const largura = Math.max(0, ...linhas.map((r) => r.length));
  return linhas.filter((r) => r.some((c) => c)).map((r) => Array.from({ length: largura }, (_, i) => r[i] ?? ""));
}

// ---------------- CSV ----------------
function decodificar(b: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(b);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("windows-1252").decode(b); // Excel brasileiro antigo
}

export function lerCsv(txt: string): Tabela {
  const primeira = txt.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : (primeira.includes("\t") && !primeira.includes(",") ? "\t" : ",");
  const out: Tabela = [];
  let row: string[] = [], cel = "", aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]!;
    if (aspas) {
      if (ch === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else aspas = false; }
      else cel += ch;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === sep) { row.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      row.push(cel); out.push(row); row = []; cel = "";
    } else cel += ch;
  }
  if (cel || row.length) { row.push(cel); out.push(row); }
  return out;
}

// ---------------- XLSX ----------------
interface EntradaZip { nome: string; metodo: number; tamComp: number; offset: number }

function lerZip(b: Uint8Array): Map<string, EntradaZip> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Arquivo não parece ser uma planilha .xlsx válida.");
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, EntradaZip>();
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Planilha corrompida (diretório do zip).");
    const metodo = dv.getUint16(p + 10, true);
    const tamComp = dv.getUint32(p + 20, true);
    const lenNome = dv.getUint16(p + 28, true), lenExtra = dv.getUint16(p + 30, true), lenCom = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + lenNome));
    out.set(nome, { nome, metodo, tamComp, offset });
    p += 46 + lenNome + lenExtra + lenCom;
  }
  return out;
}

async function extrair(b: Uint8Array, e: EntradaZip): Promise<string> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ini = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const dados = b.slice(ini, ini + e.tamComp);
  if (e.metodo === 0) return new TextDecoder().decode(dados);
  if (e.metodo !== 8) throw new Error("Compressão da planilha não suportada.");
  const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(s).text();
}

const xml = (t: string) => new DOMParser().parseFromString(t, "application/xml");
const tags = (d: Document | Element, nome: string) => Array.from(d.getElementsByTagNameNS("*", nome));

function colunaIndice(ref: string): number {
  const letras = ref.replace(/\d+/g, "");
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

async function lerXlsx(b: Uint8Array): Promise<Tabela> {
  const zip = lerZip(b);
  const pegar = async (nome: string) => { const e = zip.get(nome); return e ? extrair(b, e) : null; };

  // primeira aba, seguindo workbook.xml → relationships
  let caminho = "xl/worksheets/sheet1.xml";
  const wb = await pegar("xl/workbook.xml");
  const rels = await pegar("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const sheet = tags(xml(wb), "sheet")[0];
    const rid = sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? sheet?.getAttribute("r:id");
    const alvo = tags(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (alvo) caminho = alvo.startsWith("/") ? alvo.slice(1) : "xl/" + alvo.replace(/^\.\//, "");
  }
  const sheetXml = await pegar(caminho);
  if (!sheetXml) throw new Error("Não encontrei a primeira aba da planilha.");

  const compartilhadas: string[] = [];
  const ss = await pegar("xl/sharedStrings.xml");
  if (ss) for (const si of tags(xml(ss), "si")) compartilhadas.push(tags(si, "t").map((t) => t.textContent ?? "").join(""));

  const tabela: Tabela = [];
  for (const row of tags(xml(sheetXml), "row")) {
    const r = Number(row.getAttribute("r") ?? tabela.length + 1) - 1;
    const linha: string[] = (tabela[r] ??= []);
    tags(row, "c").forEach((c, k) => {
      const ref = c.getAttribute("r");
      const col = ref ? colunaIndice(ref) : k;
      const tipo = c.getAttribute("t");
      const v = tags(c, "v")[0]?.textContent ?? "";
      let txt = v;
      if (tipo === "s") txt = compartilhadas[Number(v)] ?? "";
      else if (tipo === "inlineStr") txt = tags(c, "t").map((t) => t.textContent ?? "").join("");
      else if (tipo === "b") txt = v === "1" ? "VERDADEIRO" : "FALSO";
      linha[col] = txt;
    });
  }
  return Array.from(tabela, (r) => Array.from(r ?? [], (c) => c ?? ""));
}

/** Gera CSV (separado por ";", com BOM, que o Excel brasileiro abre direto). */
export function gerarCsv(linhas: (string | number | null | undefined)[][]): Uint8Array {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return new TextEncoder().encode("﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n"));
}
