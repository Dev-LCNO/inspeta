// S03 — Shell do backoffice: menu lateral (drawer abaixo de 1024px)
import { useEffect, useState, type ReactNode } from "react";
import { server } from "../data/server";
import type { Membro } from "../data/types";
import { fmt } from "../ui/format";
import { Icon, type IconName } from "../ui/icons";
import { Button } from "../ui/primitives";
import { Link, navigate, useRoute } from "../ui/router";

const NAV: { to: string; label: string; icon: IconName; soon?: string }[] = [
  { to: "/web/inspecoes", label: "Inspeções", icon: "clipboard" },
  { to: "/web/formularios", label: "Formulários", icon: "file" },
  { to: "/web/avaliados", label: "Avaliados", icon: "store" },
  { to: "/web/planos", label: "Planos de ação", icon: "target", soon: "M2" },
  { to: "/web/painel", label: "Painel", icon: "chart", soon: "M3" },
  { to: "/web/aprovacoes", label: "Aprovações", icon: "stamp", soon: "M3" },
  { to: "/web/workflows", label: "Workflows", icon: "flow", soon: "M4" },
];
const NAV_ADMIN: { to: string; label: string; icon: IconName; soon?: string }[] = [
  { to: "/web/permissoes", label: "Permissões", icon: "shield", soon: "M2" },
  { to: "/web/funcoes", label: "Funções", icon: "key", soon: "M2" },
];

export function Shell({ me, children }: { me: Membro; children: ReactNode }) {
  const r = useRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [r.path]);
  const item = (n: (typeof NAV)[number]) => (
    <Link key={n.to} to={n.to} className="nav-item" current={r.path.startsWith(n.to)}>
      <Icon n={n.icon} />{n.label}{n.soon ? <span className="soon" title={`Previsto para o marco ${n.soon.slice(1)}`}>{n.soon}</span> : null}
    </Link>
  );
  return (
    <div className="shell">
      {open ? <div className="scrim" onClick={() => setOpen(false)} /> : null}
      <aside className={"sidebar" + (open ? " open" : "")} aria-label="Menu">
        <div className="brand"><span className="mark"><Icon n="checkSquare" size="sm" /></span>Inspeta</div>
        <nav aria-label="Principal" className="stack-sm" style={{ gap: 2 }}>
          {NAV.map(item)}
          {me.is_master || me.acoes.includes("gerenciar_permissoes") ? <><div className="nav-sep" />{NAV_ADMIN.map(item)}</> : null}
          <div className="nav-sep" />
          <Link to="/campo" className="nav-item"><Icon n="home" />Abrir app de campo</Link>
        </nav>
        <div className="me">
          <span className="avatar" aria-hidden="true">{fmt.iniciais(me.nome)}</span>
          <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{me.nome}</div><div className="muted truncate" style={{ fontSize: "var(--text-xs)" }}>{me.funcao} · {server.org().nome}</div></div>
          <Button variant="ghost" icon="logout" label="Sair" onClick={() => { server.sair(); navigate("/entrar", { replace: true }); }} />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon="menu" label="Abrir menu" onClick={() => setOpen(true)} />
          <div className="brand" style={{ padding: 0, fontSize: "var(--text-base)" }}><span className="mark"><Icon n="checkSquare" size="sm" /></span>Inspeta</div>
        </header>
        <main className="page" id="conteudo" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
