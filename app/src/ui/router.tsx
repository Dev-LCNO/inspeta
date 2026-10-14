// Roteador por hash (#/web/inspecoes?aba=x). No Next.js isto vira o App Router;
// as telas só usam useRoute() / navigate() / <Link>, então a troca é local.
import { useEffect, useState, type ReactNode } from "react";

export interface Route { path: string; parts: string[]; query: URLSearchParams }

function read(): Route {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path = "/", qs = ""] = raw.split("?");
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(read);
  useEffect(() => {
    const h = () => { setR(read()); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return r;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = "#" + to;
  if (opts.replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo(0, 0);
}

export function withQuery(path: string, q: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export function Link({ to, children, className, current, ...rest }: {
  to: string; children?: ReactNode; className?: string; current?: boolean; [k: string]: unknown;
}) {
  return (
    <a href={"#" + to} className={className} aria-current={current ? "page" : undefined} {...rest}>
      {children}
    </a>
  );
}
