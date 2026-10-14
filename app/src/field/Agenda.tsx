// M09 — Agenda do aplicador (offline: vem no pacote) + aviso no horário enquanto o app está aberto.
import { useState } from "react";
import { device, type EstadoAparelho } from "../data/device";
import type { Membro, OcorrenciaPacote } from "../data/types";
import { useTick } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Badge, Button, Callout, EmptyState, SkeletonBlock, useToast } from "../ui/primitives";
import { Link, navigate } from "../ui/router";
import { TopBar, useAparelho } from "./FieldApp";

export interface ItemAgenda extends OcorrenciaPacote { atrasada: boolean; hoje: boolean; rascunho?: string }

/** Agenda local menos o que já foi feito neste aparelho. */
export function agendaLocal(s: EstadoAparelho | undefined, agora = Date.now()): ItemAgenda[] {
  const fuso = s?.pacote?.org.fuso_horario ?? "America/Sao_Paulo";
  const dia = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
  const hoje = dia(new Date(agora).toISOString());
  return (s?.pacote?.agenda ?? []).flatMap((o) => {
    const local = s!.inspecoes.find((i) => i.ocorrencia_id === o.id);
    if (local && local.estado !== "rascunho") return [];
    return [{ ...o, atrasada: agora > Date.parse(o.limite), hoje: dia(o.previsto_em) === hoje, rascunho: local?.client_uuid }];
  });
}

export function Agenda({ me }: { me: Membro }) {
  const ap = useAparelho(me);
  const toast = useToast();
  useTick(["device"]);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const s = ap.data;
  const itens = agendaLocal(s);
  const nomeAv = new Map((s?.pacote?.avaliados ?? []).map((a) => [a.id, a.nome]));
  const nomeF = new Map((s?.pacote?.formularios ?? []).map((f) => [f.formulario_id, f.nome]));
  const grupos: [string, ItemAgenda[]][] = [
    ["Atrasadas", itens.filter((i) => i.atrasada)],
    ["Hoje", itens.filter((i) => !i.atrasada && i.hoje)],
    ["Próximos dias", itens.filter((i) => !i.atrasada && !i.hoje)],
  ];

  async function abrir(o: ItemAgenda) {
    if (o.rascunho) { navigate("/campo/aplicar/" + o.rascunho); return; }
    setAbrindo(o.id);
    try {
      const i = await device.novaInspecao(me.id, o.formulario_id, o.avaliado_id, o.id);
      navigate("/campo/aplicar/" + i.client_uuid);
    } catch (e) { toast({ tone: "error", text: (e as Error).message }); setAbrindo(null); }
  }

  return (
    <>
      <TopBar me={me} back="/campo" title="Agenda" sub="Inspeções programadas para você" />
      <main className="f-body">
        {!s ? <SkeletonBlock h={200} /> : !s.pacote ? <Callout tone="warn">Sincronize para receber a sua agenda.</Callout>
          : !itens.length ? <EmptyState icon="calendar" title="Nada agendado" text="Quando alguém programar uma inspeção para você, ela aparece aqui, mesmo sem internet." />
          : grupos.map(([titulo, lista]) => lista.length ? (
            <section key={titulo} className="stack-sm" aria-labelledby={"ag-" + titulo}>
              <h2 id={"ag-" + titulo} style={{ fontSize: "var(--text-base)" }}>{titulo} <span className="muted num">({lista.length})</span></h2>
              {lista.map((o) => (
                <button key={o.id} type="button" className="tile" disabled={!!abrindo} aria-busy={abrindo === o.id ? "true" : undefined} onClick={() => void abrir(o)}>
                  <span className="ic"><Icon n={o.rascunho ? "edit" : "calendar"} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="t">{nomeAv.get(o.avaliado_id) ?? "Avaliado"}</span><br />
                    <span className="d">{nomeF.get(o.formulario_id)} · {quando(o, s.pacote!.org.fuso_horario)}</span>
                    {o.atrasada || o.rascunho ? <><br /><span style={{ display: "inline-flex", gap: 6, marginTop: 4 }}>
                      {o.atrasada ? <Badge tone="nc" icon="clock">Atrasada</Badge> : null}{o.rascunho ? <Badge tone="warn" icon="edit">Em andamento</Badge> : null}</span></> : null}
                  </span>
                  <Icon n="right" />
                </button>
              ))}
            </section>
          ) : null)}
        {s?.pacote ? <AvisoNoHorario /> : null}
      </main>
    </>
  );
}

function quando(o: OcorrenciaPacote, fuso: string): string {
  const d = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(o.previsto_em));
  if (o.dia_inteiro) return `${d}, o dia inteiro`;
  return `${d} às ${new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" }).format(new Date(o.previsto_em))}`;
}

// ---------------------------------------------------------------------------
// Avisos. O push de verdade (servidor → celular com o app fechado) depende do backend
// (Web Push/VAPID). Aqui o aviso sai pelo service worker enquanto o app está aberto.
// ---------------------------------------------------------------------------

const AVISADOS = "inspeta:avisados";

function AvisoNoHorario() {
  const suporta = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(suporta ? Notification.permission : "denied");
  if (!suporta) return null;
  if (perm === "granted") return <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)", textAlign: "center" }}><Icon n="check" size="sm" /> Avisos ligados neste aparelho.</p>;
  if (perm === "denied") return <Callout tone="info" icon="info">Os avisos estão bloqueados no navegador. Libere nas configurações do site para ser lembrado no horário.</Callout>;
  return (
    <Button variant="secondary" icon="clock" onClick={() => void Notification.requestPermission().then(setPerm)}>Avisar no horário</Button>
  );
}

/** Agenda os avisos das próximas 12 h. Chamado pelo FieldApp; devolve a função que cancela. */
export function agendarAvisos(s: EstadoAparelho | undefined): () => void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return () => undefined;
  let feitos: string[] = [];
  try { feitos = JSON.parse(localStorage.getItem(AVISADOS) ?? "[]") as string[]; } catch { /* sem armazenamento: avisa de novo */ }
  const nomeAv = new Map((s?.pacote?.avaliados ?? []).map((a) => [a.id, a.nome]));
  const timers = agendaLocal(s).filter((o) => !feitos.includes(o.id) && !o.atrasada && Date.parse(o.previsto_em) - Date.now() < 12 * 3600e3).map((o) =>
    setTimeout(() => {
      const titulo = `Inspeção agora: ${nomeAv.get(o.avaliado_id) ?? "avaliado"}`;
      const opts = { body: o.descricao, tag: o.id, data: { url: location.pathname + "#/campo/agenda" } };
      void navigator.serviceWorker?.ready.then((reg) => reg.showNotification(titulo, opts)).catch(() => new Notification(titulo, opts));
      try { localStorage.setItem(AVISADOS, JSON.stringify([...feitos, o.id].slice(-200))); } catch { /* ignora */ }
    }, Math.max(0, Date.parse(o.previsto_em) - Date.now())));
  return () => timers.forEach(clearTimeout);
}

/** Usado na Home: quantas para hoje (incluindo atrasadas). */
export function useResumoAgenda(s: EstadoAparelho | undefined) {
  useTick(["device"]);
  const it = agendaLocal(s);
  return { hoje: it.filter((o) => o.hoje || o.atrasada).length, atrasadas: it.filter((o) => o.atrasada).length, total: it.length };
}

export function AgendaTile({ s }: { s: EstadoAparelho | undefined }) {
  const r = useResumoAgenda(s);
  return (
    <Link to="/campo/agenda" className="tile">
      <span className="ic"><Icon n="calendar" /></span>
      <span className="grow"><span className="t">Agenda</span><br />
        <span className="d">{!s?.pacote ? "Sincronize para receber" : r.total ? `${r.hoje} para hoje${r.atrasadas ? `, ${r.atrasadas} ${r.atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""} · ${r.total} no total` : "Nada agendado"}</span></span>
      {r.atrasadas ? <Badge tone="nc">{r.atrasadas}</Badge> : r.hoje ? <Badge tone="acc">{r.hoje}</Badge> : null}
      <Icon n="right" />
    </Link>
  );
}
