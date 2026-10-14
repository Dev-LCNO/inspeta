// M03 — Sincronismo
import { useState } from "react";
import { device } from "../data/device";
import { net } from "../data/net";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { useTick } from "../ui/hooks";
import { Icon } from "../ui/icons";
import { Button, Callout, SkeletonBlock, useToast } from "../ui/primitives";
import { AirplaneToggle, TopBar, useAparelho } from "./FieldApp";

export function Sincronismo({ me }: { me: Membro }) {
  const ap = useAparelho(me);
  useTick(["net"]);
  const toast = useToast();
  const [rodando, setRodando] = useState(false);
  const s = ap.data;
  const conta = (e: string) => s?.inspecoes.filter((i) => i.estado === e).length ?? 0;
  const fotosPend = s?.inspecoes.flatMap((i) => i.estado === "rascunho" ? [] : i.fotos).filter((f) => !f.enviada).length ?? 0;

  async function sync() {
    setRodando(true);
    const r = await device.sincronizar(me.id);
    setRodando(false);
    toast({ tone: r.erros ? "error" : "info", text: r.mensagem });
  }

  return (
    <>
      <TopBar me={me} title="Sincronismo" back="/campo" />
      <main className="f-body">
        {!s ? <SkeletonBlock h={240} /> : (
          <>
            {!net.online ? <Callout tone="warn" icon="cloudOff">Sem conexão. Pode continuar inspecionando: tudo fica guardado neste aparelho e sobe quando a internet voltar.</Callout> : null}
            {s.ultimo_erro ? <Callout tone="danger">Última tentativa falhou: {s.ultimo_erro}</Callout> : null}
            <section className="card stack">
              <dl className="meta-list">
                <dt>Última sincronização</dt><dd className="num">{s.sincronizado_em ? fmt.dataHoraCompleta(s.sincronizado_em) : "nunca"}</dd>
                <dt>Na fila para enviar</dt><dd className="num">{conta("na_fila") + conta("enviando")}</dd>
                <dt>Fotos pendentes</dt><dd className="num">{fotosPend}</dd>
                <dt>Com erro</dt><dd className="num" style={{ color: conta("erro") ? "var(--c-danger)" : undefined }}>{conta("erro")}</dd>
                <dt>Rascunhos</dt><dd className="num">{conta("rascunho")} <span className="muted">(não são enviados)</span></dd>
                <dt>Formulários no aparelho</dt><dd className="num">{s.pacote?.formularios.length ?? 0}</dd>
                <dt>Avaliados no aparelho</dt><dd className="num">{s.pacote?.avaliados.length ?? 0}</dd>
                <dt>Aparelho</dt><dd className="mono">{s.device_id}</dd>
              </dl>
              <Button size="xl" block icon="refresh" loading={rodando} disabled={!net.online} onClick={sync}>
                {rodando ? "Sincronizando…" : net.online ? "Sincronizar agora" : "Aguardando internet"}
              </Button>
            </section>
            {s.inspecoes.filter((i) => i.estado === "erro").map((i) => (
              <Callout key={i.client_uuid} tone="danger"><b>{i.nome_formulario}</b>: {i.erro}</Callout>
            ))}
            <AirplaneToggle />
            <p className="muted" style={{ fontSize: "var(--text-xs)", margin: 0 }}><Icon n="info" size="sm" /> O app também sincroniza sozinho ao abrir e quando a conexão volta.</p>
          </>
        )}
      </main>
    </>
  );
}
