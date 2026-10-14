// Configuração que não é segredo de usuário (endereço do app, origens) e o segredo interno do agendador
// ficam em interno.config — esquema fora da API pública, só as funções (conexão direta) leem.
import type { Sql } from "./repo";

export interface ConfigInterna { app_url: string; origens: string[]; cron_secret: string; url_jobs: string }

export function leitorConfig(sql: Sql, ttlMs = 60_000) {
  let cache: { em: number; v: ConfigInterna } | null = null;
  return async (): Promise<ConfigInterna> => {
    if (cache && Date.now() - cache.em < ttlMs) return cache.v;
    const rows = await sql<{ nome: string; valor: string }>`select nome, valor from interno.config`;
    const m = new Map(rows.map((r) => [r.nome, r.valor]));
    const v = {
      app_url: m.get("app_url") ?? "",
      origens: (m.get("origens") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      cron_secret: m.get("cron_secret") ?? "",
      url_jobs: m.get("url_jobs") ?? "",
    };
    cache = { em: Date.now(), v };
    return v;
  };
}

/** Comparação em tempo constante para o segredo do agendador. */
export function mesmoSegredo(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
