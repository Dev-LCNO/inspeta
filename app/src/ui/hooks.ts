import { useCallback, useEffect, useRef, useState } from "react";
import { onChange } from "../data/kv";

export type Async<T> =
  | { status: "loading"; data?: T; error?: undefined }
  | { status: "ok"; data: T; error?: undefined }
  | { status: "error"; data?: T; error: Error };

/** Carrega dados e recarrega quando a camada de dados avisa mudança nos tópicos dados. */
export function useData<T>(load: () => Promise<T>, deps: readonly unknown[], topics: string[] = []): Async<T> & { reload: () => void } {
  const [st, setSt] = useState<Async<T>>({ status: "loading" });
  const seq = useRef(0);
  const run = useCallback(() => {
    const my = ++seq.current;
    setSt((prev) => (prev.data !== undefined ? { status: "loading", data: prev.data } : { status: "loading" }));
    load().then(
      (data) => { if (my === seq.current) setSt({ status: "ok", data }); },
      (error: unknown) => { if (my === seq.current) setSt({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  useEffect(() => {
    if (!topics.length) return;
    return onChange((t) => { if (topics.includes(t) || t === "reset") run(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, topics.join(",")]);
  return { ...st, reload: run } as Async<T> & { reload: () => void };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-renderiza quando o tópico muda (ex.: "net"). */
export function useTick(topics: string[]): number {
  const [n, setN] = useState(0);
  useEffect(() => onChange((t) => { if (topics.includes(t)) setN((x) => x + 1); }), [topics.join(",")]);
  return n;
}
