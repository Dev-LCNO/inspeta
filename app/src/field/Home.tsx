// M02 — Início do app de campo
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { Icon } from "../ui/icons";
import { Button, Callout, SkeletonBlock } from "../ui/primitives";
import { Link, navigate } from "../ui/router";
import { AirplaneToggle, TopBar, useAparelho } from "./FieldApp";

export function Home({ me }: { me: Membro }) {
  const ap = useAparelho(me);
  const s = ap.data;
  const rascunhos = s?.inspecoes.filter((i) => i.estado === "rascunho") ?? [];
  const nomeAv = new Map((s?.pacote?.avaliados ?? []).map((a) => [a.id, a.nome]));
  return (
    <>
      <TopBar me={me} title={`Olá, ${me.nome.split(" ")[0]}`} sub={server.org().nome} />
      <main className="f-body">
        {!s ? <SkeletonBlock h={200} /> : !s.pacote ? (
          <Callout tone="warn">Este aparelho ainda não tem formulários. Conecte à internet e toque em <b>Sincronizar</b>.</Callout>
        ) : null}

        <Link to="/campo/nova" className="tile primary">
          <span className="ic"><Icon n="plus" size="lg" /></span>
          <span className="grow"><span className="t">Nova inspeção</span><br /><span className="d">{s?.pacote ? `${s.pacote.formularios.length} ${s.pacote.formularios.length === 1 ? "formulário disponível" : "formulários disponíveis"}, mesmo sem internet` : "Sincronize primeiro"}</span></span>
          <Icon n="right" />
        </Link>

        {rascunhos.length ? (
          <section className="stack-sm" aria-labelledby="h-cont">
            <h2 id="h-cont" style={{ fontSize: "var(--text-base)" }}>Continuar de onde parou</h2>
            {rascunhos.slice(0, 3).map((i) => (
              <Link key={i.client_uuid} to={"/campo/aplicar/" + i.client_uuid} className="tile">
                <span className="ic"><Icon n="edit" /></span>
                <span className="grow"><span className="t">{nomeAv.get(i.avaliado_id) ?? "Avaliado"}</span><br />
                  <span className="d">{i.nome_formulario} · começou {fmt.relativo(i.iniciada_em)}</span></span>
                <Icon n="right" />
              </Link>
            ))}
          </section>
        ) : null}

        <div className="stack-sm">
          <Link to="/campo/historico" className="tile">
            <span className="ic"><Icon n="history" /></span>
            <span className="grow"><span className="t">Minhas inspeções</span><br /><span className="d">Rascunhos, fila de envio e enviadas</span></span>
            <Icon n="right" />
          </Link>
          <Link to="/campo/sincronismo" className="tile">
            <span className="ic"><Icon n="refresh" /></span>
            <span className="grow"><span className="t">Sincronismo</span><br /><span className="d">Última vez: {fmt.relativo(s?.sincronizado_em)}</span></span>
            <Icon n="right" />
          </Link>
        </div>

        <div className="row-between" style={{ marginTop: "var(--space-4)" }}>
          <AirplaneToggle />
          <div className="row">
            {me.is_master || me.acoes.includes("gerenciar_formularios") ? <Button variant="ghost" size="sm" icon="chart" onClick={() => navigate("/web/inspecoes")}>Painel web</Button> : null}
            <Button variant="ghost" size="sm" icon="logout" onClick={() => { server.sair(); navigate("/entrar", { replace: true }); }}>Sair</Button>
          </div>
        </div>
      </main>
    </>
  );
}
