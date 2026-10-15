// Entrada da função "jobs" no Supabase (Deno). Protegida pelo cabeçalho x-cron-secret, que precisa bater com
// interno.config.cron_secret (gerado aleatoriamente pela migração; ninguém digita).
// - sem corpo (pg_cron, a cada minuto): envia a fila de e-mails e gera a agenda;
// - {"acao":"provisionar", ...}: cria a organização e convida o dono.
// @ts-nocheck — arquivo específico do Deno (fora do tsc do app)
import postgres from "npm:postgres@3.4.5";
import { leitorConfig, mesmoSegredo } from "./configInterna";
import { criarOrganizacao, enviadorResend, enviarEmailsPendentes, limparContadores, rodarAgendas } from "./jobs";

const env = (k: string) => Deno.env.get(k) ?? "";
const sql = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 2, idle_timeout: 20 });
const config = leitorConfig(sql, 10_000);

Deno.serve(async (req: Request) => {
  const c = await config();
  if (!mesmoSegredo(req.headers.get("x-cron-secret") ?? "", c.cron_secret)) return new Response("proibido", { status: 403 });
  const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (corpo?.acao === "provisionar") {
    const r = await criarOrganizacao(sql, corpo, { authUrl: `${env("SUPABASE_URL")}/auth/v1`, serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"), urlApp: c.app_url });
    return Response.json(r.corpo, { status: r.status });
  }
  const emails = env("RESEND_API_KEY")
    ? await enviarEmailsPendentes(sql, { enviar: enviadorResend(env("RESEND_API_KEY"), env("EMAIL_REMETENTE") || "Inspeta <onboarding@resend.dev>"), urlApp: c.app_url })
    : 0;
  const quarto = new Date().getUTCMinutes() % 15 === 0;
  const agenda = quarto ? await rodarAgendas(sql) : 0;
  if (quarto) await limparContadores(sql);
  return Response.json({ emails, agenda });
});
