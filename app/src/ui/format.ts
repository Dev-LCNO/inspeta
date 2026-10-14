// Datas sempre exibidas no fuso da organização (armazenadas em UTC).
const TZ = "America/Rio_Branco";

const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dtFull = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dOnly = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const num1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numAny = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const fmt = {
  dataHora: (iso?: string | null) => (iso ? dt.format(new Date(iso)).replace(",", "") : "—"),
  dataHoraCompleta: (iso?: string | null) => (iso ? dtFull.format(new Date(iso)).replace(",", " às") : "—"),
  data: (iso?: string | null) => (iso ? dOnly.format(new Date(iso)) : "—"),
  pct: (v: number | null | undefined) => (v === null || v === undefined ? "—" : num1.format(v) + "%"),
  num: (v: number | null | undefined) => (v === null || v === undefined ? "—" : numAny.format(v)),
  relativo(iso?: string | null): string {
    if (!iso) return "nunca";
    const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    return `há ${Math.floor(s / 86400)} d`;
  },
  iniciais: (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join(""),
  bytes: (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`),
};

/** Converte texto digitado em pt-BR ("3,5" ou "-2") em número. */
export function parseNumero(txt: string): number | null {
  const t = txt.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function corClassificacao(cor: string | null | undefined): string {
  if (!cor) return "var(--c-na)";
  return cor.startsWith("#") ? cor : `var(--c-${cor})`;
}
