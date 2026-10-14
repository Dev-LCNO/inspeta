// Trabalhos de fundo: envio da fila de e-mails (Resend) e materialização da agenda.
// Rodam pela função "jobs" do Supabase, chamada a cada minuto pelo pg_cron (ver supabase/cron.sql).
import { gerarRelatorioPdf } from "../app/src/pdf";
import { criarServidor } from "../app/src/data/nucleo";
import type { EmailSaida, Organizacao } from "../app/src/data/types";
import { provisionar } from "./provisionar";
import { ambientePg, anexosNoBanco, type Sql } from "./repo";

export interface Mensagem { para: string; assunto: string; texto: string; html: string; anexos?: { nome: string; base64: string }[] }
export type Enviador = (m: Mensagem) => Promise<{ ok: boolean; erro?: string }>;

/** Envia pelo Resend (https://resend.com/docs/api-reference/emails/send-email). */
export function enviadorResend(chave: string, remetente: string): Enviador {
  return async (m) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente, to: [m.para], subject: m.assunto, text: m.texto, html: m.html,
        attachments: m.anexos?.map((a) => ({ filename: a.nome, content: a.base64 })) }),
    });
    if (r.ok) return { ok: true };
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    return { ok: false, erro: j.message ?? `HTTP ${r.status}` };
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function html(e: EmailSaida, org: Organizacao): string {
  const corpo = esc(e.texto).replace(/\n/g, "<br>");
  const botao = e.link ? `<p style="margin:24px 0"><a href="${esc(e.link)}" style="background:#27466f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Abrir</a></p><p style="color:#535a50;font-size:12px">Se o botão não abrir, copie este endereço: ${esc(e.link)}</p>` : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#161a14">
<p style="color:#535a50;font-size:12px;text-transform:uppercase;letter-spacing:.06em">${esc(org.nome)}</p>
<h1 style="font-size:18px">${esc(e.assunto)}</h1><p style="line-height:1.5">${corpo}</p>${botao}
<p style="color:#535a50;font-size:12px;margin-top:32px">Enviado pelo Inspeta. Você recebeu porque seu e-mail está cadastrado nesta conta.</p></div>`;
}

const b64 = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Envia os e-mails "pendente" de todas as organizações. Idempotente: cada e-mail sai uma vez (trava por organização). */
export async function enviarEmailsPendentes(sql: Sql, op: { enviar: Enviador; urlApp?: string; limite?: number }): Promise<number> {
  const orgs = await sql<{ id: string; nome: string; fuso_horario: string }>`
    select distinct o.id, o.nome, o.fuso_horario from registros r join orgs o on o.id = r.org_id
    where r.colecao = 'emails' and r.dados->>'status' = 'pendente'`;
  let total = 0;
  for (const o of orgs) {
    const anexos = anexosNoBanco(sql);
    const amb = ambientePg(sql, o, { urlApp: op.urlApp ?? "", anexos });
    await amb.exclusivo(async () => {
      const s = (await amb.carregar())!;
      for (const e of s.emails.filter((x) => x.status === "pendente").slice(0, op.limite ?? 50)) {
        const m: Mensagem = { para: e.para, assunto: e.assunto, texto: e.texto + (e.link ? `\n\n${e.link}` : ""), html: html(e, o) };
        if (e.anexo?.tipo === "relatorio_pdf") {
          const i = s.inspecoes.find((x) => x.id === e.anexo!.inspecao_id);
          const v = i && s.versoes.find((x) => x.id === i.formulario_versao_id);
          if (i && v) {
            const fotos: Record<string, string> = {};
            for (const a of i.anexos) { const d = await anexos.get(o.id, a.client_uuid); if (d) fotos[a.client_uuid] = d; }
            const f = s.formularios.find((x) => x.id === i.formulario_id);
            const pub = s.versoes.find((x) => x.id === f?.versao_publicada_id);
            const layout = pub?.definicao.config.relatorio?.layout ?? v.definicao.config.relatorio?.layout ?? {};
            const logo = layout.logo_id ? (await anexos.get(o.id, layout.logo_id)) ?? null : null;
            const pdf = await gerarRelatorioPdf({ org: o, inspecao: i, definicao: { ...v.definicao, config: { ...v.definicao.config, relatorio: { ...v.definicao.config.relatorio, layout } } },
              formulario: f?.nome ?? "", versao: v.numero, avaliado: s.avaliados.find((a) => a.id === i.avaliado_id)!,
              responsavel: { id: i.responsavel_id, nome: s.membros.find((x) => x.id === i.responsavel_id)?.nome ?? "" } as never,
              anexos: fotos, notaAnterior: null, logo });
            m.anexos = [{ nome: `relatorio-${i.id.slice(0, 8)}.pdf`, base64: b64(pdf) }];
          }
        }
        const r = await op.enviar(m);
        e.status = r.ok ? "enviado" : "erro";
        e.enviado_em = r.ok ? new Date().toISOString() : null;
        if (!r.ok) e.erro = r.erro;
        // o link carrega o token do plano: depois de entregue, o banco não guarda mais o link inteiro
        if (r.ok && e.link?.includes("#/p/")) e.link = undefined;
        total += r.ok ? 1 : 0;
      }
      await amb.gravar(s);
    });
  }
  return total;
}

/** Gera as ocorrências dos próximos 14 dias de todas as organizações (o app também faz isso sob demanda). */
export async function rodarAgendas(sql: Sql): Promise<number> {
  const orgs = await sql<{ id: string; nome: string; fuso_horario: string }>`select id, nome, fuso_horario from orgs`;
  let n = 0;
  for (const o of orgs) n += await criarServidor(ambientePg(sql, o, { urlApp: "", anexos: anexosNoBanco(sql) })).rodarAgenda();
  return n;
}

export interface PedidoOrg { nome?: string; fuso_horario?: string; dono_nome?: string; dono_email?: string; demo?: boolean }
/** Cria uma organização e convida o dono pelo Supabase Auth (POST /auth/v1/invite com a service role). */
export async function criarOrganizacao(sql: Sql, p: PedidoOrg, op: { authUrl: string; serviceKey: string; urlApp: string; fetch?: typeof fetch }):
  Promise<{ status: number; corpo: Record<string, unknown> }> {
  const email = (p.dono_email ?? "").trim().toLowerCase();
  if (!p.nome?.trim() || !p.dono_nome?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, corpo: { erro: "Informe nome, dono_nome e dono_email válidos." } };
  const ja = await sql`select 1 from registros where colecao = 'membros' and lower(dados->>'email') = ${email} limit 1`;
  if (ja.length) return { status: 409, corpo: { erro: "Esse e-mail já pertence a uma organização." } };
  const org = await provisionar(sql, { nome: p.nome.trim(), fuso_horario: p.fuso_horario || "America/Sao_Paulo", dono: { nome: p.dono_nome.trim(), email }, demo: !!p.demo }, op.urlApp);
  const r = await (op.fetch ?? fetch)(`${op.authUrl}/invite${op.urlApp ? `?redirect_to=${encodeURIComponent(op.urlApp)}` : ""}`, {
    method: "POST",
    headers: { apikey: op.serviceKey, Authorization: `Bearer ${op.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, data: {} }),
  });
  return { status: 200, corpo: { org: org.id, convite: r.ok ? "enviado" : `falhou (${r.status}) — o dono pode usar "Esqueci minha senha" na tela de entrar` } };
}

