import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Classificacao } from "@app/form-engine";
import type { InspecaoStatus } from "../data/types";
import { corClassificacao, fmt } from "./format";
import { Icon, type IconName } from "./icons";
import { Link } from "./router";

// ---------------- Button ----------------
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({
  variant = "primary", size, block, icon, iconRight, loading, children, label, type = "button", ...rest
}: {
  variant?: BtnVariant; size?: "sm" | "lg" | "xl"; block?: boolean; icon?: IconName; iconRight?: IconName;
  loading?: boolean; children?: ReactNode; label?: string; type?: "button" | "submit";
  onClick?: (e: MouseEvent) => void; disabled?: boolean; [k: string]: unknown;
}) {
  const cls = ["btn", variant, size, block ? "block" : "", !children ? "icon" : ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} aria-busy={loading ? "true" : undefined} aria-label={label} title={!children ? label : undefined}
      {...rest} disabled={rest.disabled || loading}>
      {loading ? <span className="spin" aria-hidden="true" /> : icon ? <Icon n={icon} /> : null}
      {children}
      {iconRight && !loading ? <Icon n={iconRight} /> : null}
    </button>
  );
}

export function ButtonLink({ to, variant = "primary", size, icon, children }: {
  to: string; variant?: BtnVariant; size?: "sm" | "lg" | "xl"; icon?: IconName; children: ReactNode;
}) {
  return <Link to={to} className={["btn", variant, size].filter(Boolean).join(" ")}>{icon ? <Icon n={icon} /> : null}{children}</Link>;
}

// ---------------- Field ----------------
export function TextField({ label, help, error, value, onChange, type = "text", multiline, required, ...rest }: {
  label: string; help?: string; error?: string | null; value: string; onChange: (v: string) => void;
  type?: string; multiline?: boolean; required?: boolean; [k: string]: unknown;
}) {
  const id = useId();
  const hid = id + "-h";
  const common = {
    id, value, required, "aria-invalid": error ? "true" : undefined, "aria-describedby": help || error ? hid : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value), ...rest,
  };
  return (
    <div className={"field" + (error ? " err" : "")}>
      <label htmlFor={id}>{label}{required ? <span className="sr-only"> (obrigatório)</span> : null}</label>
      {multiline ? <textarea className="textarea" {...common} /> : <input className="input" type={type} {...common} />}
      {error ? <span className="help" id={hid}><Icon n="alert" size="sm" />{error}</span> : help ? <span className="help" id={hid}>{help}</span> : null}
    </div>
  );
}

export function Switch({ label, desc, checked, onChange, disabled }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label className="t" htmlFor={id}>{label}</label>
        {desc ? <div className="d" id={id + "-d"}>{desc}</div> : null}
      </div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled}
        aria-describedby={desc ? id + "-d" : undefined} onChange={(e: { target: { checked: boolean } }) => onChange(e.target.checked)} />
    </div>
  );
}

// ---------------- Badges ----------------
const STATUS: Record<InspecaoStatus, { cls: string; icon: IconName; txt: string }> = {
  rascunho: { cls: "b-na", icon: "minus", txt: "Rascunho" },
  completa: { cls: "b-ok", icon: "check", txt: "Completa" },
  em_aprovacao: { cls: "b-warn", icon: "clock", txt: "Em aprovação" },
  aprovada: { cls: "b-ok", icon: "stamp", txt: "Aprovada" },
  reprovada: { cls: "b-nc", icon: "x", txt: "Reprovada" },
};
export function StatusBadge({ status }: { status: InspecaoStatus }) {
  const s = STATUS[status];
  return <span className={"badge " + s.cls}><Icon n={s.icon} size="sm" />{s.txt}</span>;
}
export function Badge({ tone, icon, children }: { tone: "ok" | "nc" | "warn" | "na" | "acc"; icon?: IconName; children: ReactNode }) {
  return <span className={"badge b-" + tone}>{icon ? <Icon n={icon} size="sm" /> : null}{children}</span>;
}

export function ScoreInline({ pct, classificacao, cor }: { pct: number | null; classificacao?: string | null; cor?: string | null }) {
  if (pct === null) return <span className="muted">—</span>;
  return (
    <span className="score-inline" title={classificacao ?? undefined}>
      <span className="dot" style={{ background: corClassificacao(cor) }} aria-hidden="true" />
      {fmt.pct(pct)}
      {classificacao ? <span className="sr-only">, {classificacao}</span> : null}
    </span>
  );
}

export function ScoreHero({ pct, classificacao, faixas, anterior }: {
  pct: number | null; classificacao: Classificacao | null; faixas: Classificacao[]; anterior?: number | null;
}) {
  if (pct === null) return <div className="muted">Este formulário não calcula nota.</div>;
  const delta = anterior != null ? Math.round((pct - anterior) * 10) / 10 : null;
  const ordenadas = [...faixas].sort((a, b) => a.min - b.min);
  const leitura = `Nota ${fmt.pct(pct)}${classificacao ? `, classificação ${classificacao.nome}` : ""}${delta !== null ? `, ${delta >= 0 ? "subiu" : "caiu"} ${fmt.num(Math.abs(delta))} pontos` : ""}`;
  return (
    <div className="score-hero" role="group" aria-label={leitura}>
      <div>
        <div className="lbl">Nota final</div>
        <div className="big" aria-hidden="true">{fmt.pct(pct)}</div>
      </div>
      <div className="grow stack-sm" style={{ minWidth: 240 }} aria-hidden="true">
        <div className="row">
          {classificacao ? <span className="badge" style={{ background: "var(--c-surface)", color: "var(--c-text)" }}><span className="dot" style={{ background: corClassificacao(classificacao.cor) }} />{classificacao.nome}</span> : null}
          {delta !== null ? (
            Math.abs(delta) < 0.05 ? <span className="muted">igual à anterior ({fmt.pct(anterior!)})</span> : (
            <span className="muted row" style={{ gap: 4 }}>
              <span style={{ color: delta > 0 ? "var(--c-success)" : "var(--c-danger)" }}><Icon n={delta > 0 ? "arrowUp" : "arrowDown"} size="sm" /></span>
              {delta > 0 ? "+" : "−"}{fmt.num(Math.abs(delta))} p.p. vs. anterior ({fmt.pct(anterior!)})
            </span>)
          ) : null}
        </div>
        {ordenadas.length ? (
          <div className="bar">
            {ordenadas.map((f) => <i key={f.nome} style={{ width: `${Math.max(0, Math.min(100, f.max) - f.min)}%`, background: corClassificacao(f.cor) }} />)}
            <span className="marker" style={{ left: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------- Feedback ----------------
export function Callout({ tone = "info", icon, children }: { tone?: "info" | "warn" | "danger" | "ok"; icon?: IconName; children: ReactNode }) {
  const def: Record<string, IconName> = { info: "info", warn: "alert", danger: "alert", ok: "check" };
  return <div className={"callout " + tone} role={tone === "danger" ? "alert" : undefined}><Icon n={icon ?? def[tone]!} /><div className="grow">{children}</div></div>;
}

export function EmptyState({ icon = "clipboard", title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon n={icon} size="xl" />
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <EmptyState icon="alert" title="Não foi possível carregar" text={error.message}
      action={onRetry ? <Button variant="secondary" icon="refresh" onClick={onRetry}>Tentar de novo</Button> : undefined} />
  );
}

export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Carregando">
      <table className="table"><tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}><div className="sk" style={{ height: 12, width: `${50 + ((r * 7 + c * 13) % 45)}%` }} /></td>)}</tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function SkeletonBlock({ h = 120 }: { h?: number }) {
  return <div className="sk" style={{ height: h, borderRadius: "var(--radius-lg)" }} aria-busy="true" aria-label="Carregando" />;
}

// ---------------- Dialog (nativo: foco preso, Esc, foco volta ao gatilho) ----------------
export function Dialog({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby={id} onClose={onClose} onCancel={(e: Event) => { e.preventDefault(); onClose(); }}>
      {open ? (
        <>
          <div className="dlg-h"><h2 id={id}>{title}</h2><Button variant="ghost" icon="x" label="Fechar" onClick={onClose} /></div>
          <div className="dlg-b">{children}</div>
          {footer ? <div className="dlg-f">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

// ---------------- Toast ----------------
interface ToastItem { id: number; text: string; tone: "info" | "error"; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(t: Omit<ToastItem, "id">) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { ...t, id }]);
    if (t.tone !== "error") setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={"toast " + t.tone} role={t.tone === "error" ? "alert" : "status"}>
            <span className="grow">{t.text}</span>
            {t.action ? <button type="button" onClick={() => { t.action!.run(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>{t.action.label}</button> : null}
            {t.tone === "error" ? <button type="button" aria-label="Fechar aviso" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>✕</button> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- Layout bits ----------------
export function PageHeader({ title, desc, actions, crumbs }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode; crumbs?: { to: string; label: string }[] }) {
  return (
    <div>
      {crumbs?.length ? (
        <nav className="crumbs" aria-label="Você está em">
          {crumbs.map((c) => <span key={c.to} className="row" style={{ gap: 6 }}><Link to={c.to}>{c.label}</Link><Icon n="right" size="sm" /></span>)}
        </nav>
      ) : null}
      <div className="page-h">
        <div className="grow"><h1>{title}</h1>{desc ? <p>{desc}</p> : null}</div>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Tabs({ items }: { items: { to: string; label: string; current: boolean; icon?: IconName }[] }) {
  return (
    <nav className="tabs" aria-label="Seções">
      {items.map((t) => <Link key={t.to} to={t.to} current={t.current}>{t.icon ? <Icon n={t.icon} size="sm" /> : null}{t.label}</Link>)}
    </nav>
  );
}
