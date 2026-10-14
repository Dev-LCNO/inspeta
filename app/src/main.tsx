import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { pode } from "./data/server";
import type { Acao, Membro } from "./data/types";
import { FieldApp } from "./field/FieldApp";
import { useSessao } from "./session";
import { EmptyState, ToastProvider } from "./ui/primitives";
import { Link, navigate, useRoute } from "./ui/router";
import { Avaliados } from "./web/Avaliados";
import { CaixaSaida } from "./web/CaixaSaida";
import { FormBuilder } from "./web/FormBuilder";
import { Funcoes } from "./web/Funcoes";
import { Formularios } from "./web/Formularios";
import { ImportarAvaliados } from "./web/ImportarAvaliados";
import { InspecaoDetalhe } from "./web/InspecaoDetalhe";
import { Inspecoes } from "./web/Inspecoes";
import { Login } from "./web/Login";
import { PlanoModeloEditor } from "./web/PlanoModeloEditor";
import { PlanoPublico } from "./web/PlanoPublico";
import { EquipeEditor, PessoaEditor, Permissoes } from "./web/Permissoes";
import { Planos } from "./web/Planos";
import { Shell } from "./web/Shell";
import { STUBS, Stub } from "./web/Stub";

const ehGestor = (m: Membro) => m.is_master || m.acoes.includes("gerenciar_formularios") || m.acoes.includes("ver_todas_inspecoes");

function Redirect({ to }: { to: string }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to]);
  return null;
}

function SemPermissao() {
  return <div className="card flat"><EmptyState icon="shield" title="Você não tem acesso a esta área" text="Peça ao administrador da conta para liberar." action={<Link to="/web/inspecoes" className="btn secondary">Ir para inspeções</Link>} /></div>;
}

function Guard({ me, acao, children }: { me: Membro; acao: Acao; children: JSX.Element }) {
  return pode(me, acao) ? children : <SemPermissao />;
}

function App() {
  const r = useRoute();
  const me = useSessao();
  const p = r.parts;

  if (p[0] === "p" && p[1]) return <PlanoPublico token={p[1]} />; // S26: sem login
  if (!me) return p[0] === "entrar" ? <Login /> : <Redirect to="/entrar" />;
  if (p[0] === "entrar" || !p.length) return <Redirect to={ehGestor(me) ? "/web/inspecoes" : "/campo"} />;
  if (p[0] === "campo") return <FieldApp me={me} />;
  if (p[0] !== "web") return <Redirect to="/" />;

  let page: JSX.Element;
  const sec = p[1];
  if (STUBS[r.path]) page = <Stub path={r.path} />;
  else if (sec === "inspecoes" && p[2]) page = <InspecaoDetalhe me={me} id={p[2]} />;
  else if (sec === "inspecoes") page = <Inspecoes me={me} />;
  else if (sec === "formularios" && p[2]) page = <Guard me={me} acao="gerenciar_formularios"><FormBuilder me={me} id={p[2]} /></Guard>;
  else if (sec === "formularios") page = <Guard me={me} acao="gerenciar_formularios"><Formularios /></Guard>;
  else if (sec === "planos" && p[2] === "modelos" && p[3]) page = <Guard me={me} acao="gerenciar_planos"><PlanoModeloEditor id={p[3]} /></Guard>;
  else if (sec === "planos") page = <Planos me={me} />;
  else if (sec === "emails") page = <Guard me={me} acao="gerenciar_planos"><CaixaSaida /></Guard>;
  else if (sec === "avaliados" && p[2] === "importar") page = <Guard me={me} acao="gerenciar_avaliados"><ImportarAvaliados /></Guard>;
  else if (sec === "permissoes" && p[2] === "pessoas" && p[3]) page = <Guard me={me} acao="gerenciar_permissoes"><PessoaEditor me={me} id={p[3]} /></Guard>;
  else if (sec === "permissoes" && p[2] === "equipes" && p[3]) page = <Guard me={me} acao="gerenciar_permissoes"><EquipeEditor me={me} id={p[3]} /></Guard>;
  else if (sec === "permissoes") page = <Guard me={me} acao="gerenciar_permissoes"><Permissoes me={me} /></Guard>;
  else if (sec === "funcoes") page = <Guard me={me} acao="gerenciar_permissoes"><Funcoes me={me} /></Guard>;
  else if (sec === "avaliados") page = <Guard me={me} acao="gerenciar_avaliados"><Avaliados /></Guard>;
  else page = <EmptyState icon="alert" title="Página não encontrada" action={<Link to="/web/inspecoes" className="btn secondary">Ir para inspeções</Link>} />;
  return <Shell me={me}>{page}</Shell>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><ToastProvider><App /></ToastProvider></StrictMode>,
);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
// Pede armazenamento persistente (o iOS limpa dados de PWA não instalado sem isso)
void navigator.storage?.persist?.().catch(() => undefined);
