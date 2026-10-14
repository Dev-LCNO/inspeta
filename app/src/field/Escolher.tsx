// M04 — escolher formulário · M05 — escolher avaliado (tudo do pacote local: funciona offline)
import { useMemo, useState } from "react";
import { device } from "../data/device";
import type { Membro } from "../data/types";
import { Icon } from "../ui/icons";
import { Button, EmptyState, SkeletonBlock, useToast } from "../ui/primitives";
import { Link, navigate } from "../ui/router";
import { TopBar, useAparelho } from "./FieldApp";

export function Escolher({ me, formularioId }: { me: Membro; formularioId?: string }) {
  const ap = useAparelho(me);
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState<string | null>(null);
  const s = ap.data;
  const form = formularioId ? s?.pacote?.formularios.find((f) => f.formulario_id === formularioId) : undefined;

  const itens = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!s?.pacote) return [];
    if (!formularioId) return s.pacote.formularios.filter((f) => !q || f.nome.toLowerCase().includes(q));
    const permitidos = form?.avaliados === "todos" ? null : new Set(form?.avaliados ?? []);
    return s.pacote.avaliados.filter((a) => (!permitidos || permitidos.has(a.id)) && (!q || [a.nome, a.codigo_externo, a.endereco].join(" ").toLowerCase().includes(q)));
  }, [s, formularioId, busca]);

  async function iniciar(avaliadoId: string) {
    setCriando(avaliadoId);
    try {
      const i = await device.novaInspecao(me.id, formularioId!, avaliadoId);
      navigate("/campo/aplicar/" + i.client_uuid, { replace: true });
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
      setCriando(null);
    }
  }

  return (
    <>
      <TopBar me={me} back={formularioId ? "/campo/nova" : "/campo"} title={formularioId ? "Onde é a inspeção?" : "Qual formulário?"} sub={form?.nome} />
      <main className="f-body">
        <div className="searchbox">
          <Icon n="search" />
          <input className="input" type="search" aria-label={formularioId ? "Buscar avaliado" : "Buscar formulário"} placeholder={formularioId ? "Buscar loja, setor, código…" : "Buscar formulário"}
            value={busca} onChange={(e: { target: { value: string } }) => setBusca(e.target.value)} />
        </div>
        {!s ? <SkeletonBlock h={240} /> : !s.pacote ? (
          <EmptyState icon="cloudOff" title="Nada neste aparelho ainda" text="Sincronize com internet para baixar seus formulários." action={<Link to="/campo/sincronismo" className="btn primary lg">Ir para sincronismo</Link>} />
        ) : !itens.length ? (
          <EmptyState icon="search" title={busca ? "Nada encontrado" : formularioId ? "Nenhum avaliado liberado para este formulário" : "Nenhum formulário liberado para você"}
            text={busca ? "Confira a grafia ou busque pelo código." : "Peça ao gestor para liberar e depois sincronize."} />
        ) : (
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {!formularioId
              ? (itens as NonNullable<typeof s.pacote>["formularios"]).map((f) => (
                <li key={f.formulario_id}>
                  <Link to={"/campo/nova/" + f.formulario_id} className="tile">
                    <span className="ic"><Icon n="file" /></span>
                    <span className="grow"><span className="t">{f.nome}</span><br />
                      <span className="d">{f.versao.definicao.topicos.reduce((n, t) => n + t.questoes.length, 0)} questões · versão {f.versao.numero}</span></span>
                    <Icon n="right" />
                  </Link>
                </li>
              ))
              : (itens as NonNullable<typeof s.pacote>["avaliados"]).map((a) => (
                <li key={a.id}>
                  <button type="button" className="tile" disabled={!!criando} onClick={() => iniciar(a.id)} aria-busy={criando === a.id ? "true" : undefined}>
                    <span className="ic"><Icon n="store" /></span>
                    <span className="grow"><span className="t">{a.nome}</span><br /><span className="d">{[a.codigo_externo, a.endereco].filter(Boolean).join(" · ")}</span></span>
                    {criando === a.id ? <span className="spin" aria-hidden="true" /> : <Icon n="right" />}
                  </button>
                </li>
              ))}
          </ul>
        )}
        {formularioId && form ? <Button variant="ghost" onClick={() => navigate("/campo/nova")}>Trocar formulário</Button> : null}
      </main>
    </>
  );
}
