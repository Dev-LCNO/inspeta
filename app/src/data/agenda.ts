// Recorrência de agendamentos: datas, horários no fuso certo e a frase que descreve a regra.
// Puro (sem IndexedDB/DOM): roda igual no servidor (job materializar-ocorrencias) e na tela.
import type { Ocorrencia, OcorrenciaSituacao, RegraAgenda } from "./types";

const DIA_MS = 864e5;
export const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const HORA_DIA_INTEIRO = "08:00"; // horário do aviso quando é o dia inteiro

// ---------------------------------------------------------------------------
// datas (yyyy-mm-dd, sem fuso: é o dia do calendário local)
// ---------------------------------------------------------------------------

const toMs = (d: string) => Date.parse(d + "T00:00:00Z");
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const somarDias = (d: string, n: number) => fromMs(toMs(d) + n * DIA_MS);
export const diaDaSemana = (d: string) => new Date(toMs(d)).getUTCDay();
const ultimoDiaDoMes = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

function casa(r: RegraAgenda, d: string): boolean {
  switch (r.recorrencia) {
    case "nenhuma": return d === r.data_inicio;
    case "diaria": return true;
    case "semanal": {
      const dias = r.dias_semana?.length ? r.dias_semana : [diaDaSemana(r.data_inicio)];
      return dias.includes(diaDaSemana(d));
    }
    case "mensal": {
      // dia 31 em mês de 30 dias cai no último dia do mês
      const alvo = Number(r.data_inicio.slice(8, 10));
      const dt = new Date(toMs(d));
      return dt.getUTCDate() === Math.min(alvo, ultimoDiaDoMes(dt.getUTCFullYear(), dt.getUTCMonth()));
    }
  }
}

/** Dias em que a regra acontece dentro de [de, ate]. A contagem do término por quantidade começa no início. */
export function datasDaRegra(r: RegraAgenda, de: string, ate: string): string[] {
  const fim = r.termino === "data" && r.termino_data && r.termino_data < ate ? r.termino_data : ate;
  const out: string[] = [];
  let n = 0;
  for (let d = r.data_inicio; d <= fim; d = somarDias(d, 1)) {
    if (!casa(r, d)) continue;
    n++;
    if (r.termino === "quantidade" && r.termino_qtd && n > r.termino_qtd) break;
    if (d >= de) out.push(d);
    if (r.recorrencia === "nenhuma") break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// fuso horário (sem biblioteca: Intl dá o deslocamento de qualquer IANA)
// ---------------------------------------------------------------------------

function deslocamentoMin(fuso: string, utcMs: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - utcMs) / 6e4;
}

/** "2026-10-15" + "08:00" em America/Rio_Branco → instante UTC. Duas passadas cobrem a troca de horário de verão. */
export function localParaUTC(data: string, hora: string, fuso: string): string {
  const [y, m, d] = data.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hora.split(":").map(Number) as [number, number];
  const parede = Date.UTC(y, m - 1, d, hh, mm);
  let ts = parede - deslocamentoMin(fuso, parede) * 6e4;
  ts = parede - deslocamentoMin(fuso, ts) * 6e4;
  return new Date(ts).toISOString();
}
export function dataLocal(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
}
export function horaLocal(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** Instantes previstos em [de, ate] (dias locais), já em UTC e em ordem. */
export function instantesDaRegra(r: RegraAgenda, de: string, ate: string): string[] {
  const horas = r.dia_inteiro ? [HORA_DIA_INTEIRO] : [...new Set(r.horarios)].sort();
  return datasDaRegra(r, de, ate).flatMap((d) => horas.map((h) => localParaUTC(d, h, r.fuso_horario)));
}

/** Até quando a ocorrência pode ser feita sem contar como atrasada. */
export function limiteDaOcorrencia(previsto_em: string, r: Pick<RegraAgenda, "dia_inteiro" | "fuso_horario">): string {
  if (r.dia_inteiro) return localParaUTC(somarDias(dataLocal(previsto_em, r.fuso_horario), 1), "00:00", r.fuso_horario); // meia-noite local seguinte
  return new Date(Date.parse(previsto_em) + 2 * 3600e3).toISOString();
}

export function situacaoOcorrencia(o: Pick<Ocorrencia, "status" | "previsto_em">, r: Pick<RegraAgenda, "dia_inteiro" | "fuso_horario">, agora = Date.now()): OcorrenciaSituacao {
  if (o.status !== "pendente") return o.status;
  return agora > Date.parse(limiteDaOcorrencia(o.previsto_em, r)) ? "atrasada" : "pendente";
}

// ---------------------------------------------------------------------------
// validação e texto
// ---------------------------------------------------------------------------

export function validarRegra(r: RegraAgenda): string[] {
  const e: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_inicio)) e.push("Informe a data de início.");
  if (!r.dia_inteiro && !r.horarios.length) e.push("Informe pelo menos um horário ou marque o dia inteiro.");
  if (r.horarios.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) e.push("Há um horário inválido.");
  if (r.recorrencia === "semanal" && !r.dias_semana?.length) e.push("Escolha pelo menos um dia da semana.");
  if (r.termino === "data" && (!r.termino_data || r.termino_data < r.data_inicio)) e.push("A data de término precisa ser depois do início.");
  if (r.termino === "quantidade" && !(r.termino_qtd && r.termino_qtd > 0 && r.termino_qtd <= 999)) e.push("Informe quantas vezes (de 1 a 999).");
  return e;
}

const br = (d: string) => d.split("-").reverse().join("/");
function lista(xs: string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

/** "Toda segunda e quinta às 08:00 e 14:00, de 15/10/2026 até 30/11/2026" */
export function descreverRegra(r: RegraAgenda): string {
  const horas = r.dia_inteiro ? ", o dia inteiro" : ` às ${lista([...new Set(r.horarios)].sort())}`;
  let quando: string;
  switch (r.recorrencia) {
    case "nenhuma": return `Uma vez, em ${br(r.data_inicio)}${r.dia_inteiro ? horas : "," + horas}`;
    case "diaria": quando = "Todo dia"; break;
    case "semanal": {
      const dias = [...(r.dias_semana?.length ? r.dias_semana : [diaDaSemana(r.data_inicio)])].sort();
      quando = dias.length === 7 ? "Todo dia" : `${dias.every((d) => d === 0 || d === 6) ? "Todo" : "Toda"} ${lista(dias.map((d) => DIAS_SEMANA[d]!))}`;
      if (dias.length === 5 && !dias.includes(0) && !dias.includes(6)) quando = "De segunda a sexta";
      break;
    }
    case "mensal": quando = `Todo mês no dia ${Number(r.data_inicio.slice(8, 10))}`; break;
  }
  const fim = r.termino === "data" && r.termino_data ? ` até ${br(r.termino_data)}`
    : r.termino === "quantidade" && r.termino_qtd ? `, ${r.termino_qtd} ${r.termino_qtd === 1 ? "vez" : "vezes"}` : "";
  return `${quando}${horas}, a partir de ${br(r.data_inicio)}${fim}`;
}
