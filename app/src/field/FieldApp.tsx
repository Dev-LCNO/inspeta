// App de campo (PWA): M02 Home · M03 Sincronismo · M04/M05 escolher · M06 aplicar · M08 histórico
import { useEffect, useState, type ReactNode } from "react";
import { autoSync, device, type EstadoAparelho } from "../data/device";
import { net } from "../data/net";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { useData, useTick } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Button, useToast } from "../ui/primitives";
import { Link, navigate, useRoute } from "../ui/router";
import { Agenda, agendarAvisos } from "./Agenda";
import { Aplicar } from "./Aplicar";
import { Escolher } from "./Escolher";
import { Historico } from "./Historico";
import { Home } from "./Home";
import { Sincronismo } from "./Sincronismo";

export function useAparelho(me: Membro) {
  return useData(() => device.estado(me.id), [me.id], ["device"]);
}

/** Sincroniza ao abrir o app (se houver rede) e sempre que a conexão volta. */
export function FieldApp({ me }: { me: Membro }) {
  const r = useRoute();
  const toast = useToast();
  useEffect(() => {
    const off = autoSync(me.id);
    if (net.online) void device.sincronizar(me.id).then((res) => { if (res.erros) toast({ tone: "error", text: res.mensagem }); });
    return off;
  }, [me.id]);
  const ap = useAparelho(me);
  useEffect(() => agendarAvisos(ap.data), [ap.data?.pacote?.cursor]);

  const [, , tela, arg] = ["", ...r.parts];
  let body: ReactNode;
  if (!tela) body = <Home me={me} />;
  else if (tela === "sincronismo") body = <Sincronismo me={me} />;
  else if (tela === "nova") body = <Escolher me={me} formularioId={arg} />;
  else if (tela === "aplicar" && arg) body = <Aplicar me={me} clientUuid={arg} />;
  else if (tela === "historico") body = <Historico me={me} />;
  else if (tela === "agenda") body = <Agenda me={me} />;
  else body = <Home me={me} />;
  return <div className="field-app">{body}</div>;
}

export function TopBar({ title, sub, back, me, right }: { title: string; sub?: string; back?: string; me: Membro; right?: ReactNode }) {
  return (
    <header className="f-top">
      {back ? <Button variant="ghost" icon="left" label="Voltar" onClick={() => (history.length > 1 ? history.back() : navigate(back))} /> : null}
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="truncate">{title}</h1>
        {sub ? <div className="sub truncate">{sub}</div> : null}
      </div>
      {right}
      <SyncPill me={me} />
    </header>
  );
}

export function SyncPill({ me, compact }: { me: Membro; compact?: boolean }) {
  const ap = useAparelho(me);
  useTick(["net"]);
  const [ocupado, setOcupado] = useState(false);
  const s: EstadoAparelho | undefined = ap.data;
  const fila = s?.inspecoes.filter((i) => i.estado === "na_fila" || i.estado === "erro" || i.estado === "enviando").length ?? 0;
  const erros = s?.inspecoes.filter((i) => i.estado === "erro").length ?? 0;
  const enviando = ocupado || !!s?.inspecoes.some((i) => i.estado === "enviando");
  let cls = "ok", icon: "check" | "cloudOff" | "refresh" | "alert" = "check", txt = s?.sincronizado_em ? `Sincronizado ${fmt.relativo(s.sincronizado_em)}` : "Nunca sincronizado";
  if (enviando) { cls = "busy"; icon = "refresh"; txt = "Enviando…"; }
  else if (erros) { cls = "err"; icon = "alert"; txt = `${erros} com erro`; }
  else if (fila) { cls = "queue"; icon = "cloudOff"; txt = `${fila} ${net.online ? "na fila" : "aguardando internet"}`; }
  else if (!net.online) { cls = "queue"; icon = "cloudOff"; txt = "Sem conexão"; }
  return (
    <Link to="/campo/sincronismo" className={"sync-pill " + cls} aria-live="polite" title="Abrir sincronismo"
      onClick={(e: { preventDefault(): void }) => {
        if (net.online && fila && !enviando) { e.preventDefault(); setOcupado(true); void device.sincronizar(me.id).finally(() => setOcupado(false)); }
      }}>
      {enviando ? <span className="spin" aria-hidden="true" style={{ width: 12, height: 12 }} /> : <Icon n={icon} size="sm" />}
      {compact ? <span className="sr-only">{txt}</span> : <span>{txt}</span>}
    </Link>
  );
}

export function AirplaneToggle() {
  useTick(["net"]);
  return (
    <label className="airplane">
      <Icon n="plane" size="sm" />Modo avião do app
      <input type="checkbox" role="switch" className="switch" checked={net.airplane} onChange={(e: { target: { checked: boolean } }) => { net.airplane = e.target.checked; }} />
    </label>
  );
}
