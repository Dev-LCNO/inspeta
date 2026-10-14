// Entrada da função "api" no Supabase (Deno). Gerada em supabase/functions/api/index.js por scripts/build-funcoes.sh.
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_URL o Supabase injeta;
// endereço do app e origens vêm de interno.config; RESEND_API_KEY (opcional) você cadastra em Edge Functions → Secrets.
// @ts-nocheck — arquivo específico do Deno (fora do tsc do app)
import postgres from "npm:postgres@3.4.5";
import { criarApi } from "./api";
import { leitorConfig } from "./configInterna";
import { anexosNoBanco } from "./repo";

const env = (k: string) => Deno.env.get(k) ?? "";
const sql = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 3, idle_timeout: 20 });
const config = leitorConfig(sql);
const anexos = anexosNoBanco(sql);
let atual: { chave: string; h: (r: Request) => Promise<Response> } | null = null;

Deno.serve(async (req: Request) => {
  const c = await config();
  const chave = c.app_url + "|" + c.origens.join(",");
  if (atual?.chave !== chave) {
    atual = { chave, h: criarApi({
      sql,
      authUrl: `${env("SUPABASE_URL")}/auth/v1`,
      anonKey: env("SUPABASE_ANON_KEY"),
      serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      urlApp: c.app_url,
      origens: c.origens,
      anexos,
      enviaEmails: !!env("RESEND_API_KEY"),
    }) };
  }
  return atual.h(req);
});
