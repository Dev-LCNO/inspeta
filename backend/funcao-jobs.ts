// Entrada da função "jobs" no Supabase (Deno). Protegida pelo cabeçalho x-cron-secret.
// - sem corpo (pg_cron, a cada minuto — supabase/cron.sql): envia a fila de e-mails e gera a agenda;
// - {"acao":"configurar"} (deploy): grava endereço e segredo para o pg_cron;
// - {"acao":"provisionar", ...} (workflow "Criar organização" no GitHub): cria a organização e convida o dono.
// @ts-nocheck — arquivo específico do Deno (fora do tsc do app)
import postgres from "npm:postgres@3.4.5";
import { configurarAgendador, criarOrganizacao, enviadorResend, enviarEmailsPendentes, rodarAgendas } from "./jobs";

const env = (k: string) => Deno.env.get(k) ?? "";
const sql = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 2, idle_timeout: 20 });

Deno.serve(async (req: Request) => {
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("proibido", { status: 403 });
  const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (corpo?.acao === "configurar") {
    await configurarAgendador(sql, `${env("SUPABASE_URL")}/functions/v1/jobs`, env("CRON_SECRET"));
    return Response.json({ ok: true });
  }
  if (corpo?.acao === "provisionar") {
    const r = await criarOrganizacao(sql, corpo, { authUrl: `${env("SUPABASE_URL")}/auth/v1`, serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"), urlApp: env("APP_URL") });
    return Response.json(r.corpo, { status: r.status });
  }
  const emails = env("RESEND_API_KEY")
    ? await enviarEmailsPendentes(sql, { enviar: enviadorResend(env("RESEND_API_KEY"), env("EMAIL_REMETENTE") || "Inspeta <onboarding@resend.dev>"), urlApp: env("APP_URL") })
    : 0;
  const agenda = new Date().getUTCMinutes() % 15 === 0 ? await rodarAgendas(sql) : 0; // agenda a cada 15 min basta
  return Response.json({ emails, agenda });
});
