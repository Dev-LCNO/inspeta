// Entrada da função "api" no Supabase (Deno). Gerada em supabase/functions/api/index.js por scripts/build-funcoes.sh.
// Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_URL já existem em toda função;
// APP_URL, ORIGENS e RESEND_API_KEY você define em Edge Functions → Secrets.
// @ts-nocheck — arquivo específico do Deno (fora do tsc do app)
import postgres from "npm:postgres@3.4.5";
import { criarApi } from "./api";
import { anexosNoBanco } from "./repo";

const env = (k: string) => Deno.env.get(k) ?? "";
const sql = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 3, idle_timeout: 20 });
const handler = criarApi({
  sql,
  authUrl: `${env("SUPABASE_URL")}/auth/v1`,
  anonKey: env("SUPABASE_ANON_KEY"),
  serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  urlApp: env("APP_URL"),
  origens: env("ORIGENS").split(",").map((x) => x.trim()).filter(Boolean),
  anexos: anexosNoBanco(sql),
  enviaEmails: !!env("RESEND_API_KEY"),
});
Deno.serve(handler);
