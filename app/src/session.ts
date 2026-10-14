import { useEffect, useState } from "react";
import { onChange } from "./data/kv";
import { server } from "./data/server";
import type { Membro } from "./data/types";

export function useSessao(): Membro | null {
  const [m, setM] = useState<Membro | null>(() => server.sessao());
  useEffect(() => onChange((t) => { if (t === "sessao" || t === "reset") setM(server.sessao()); }), []);
  return m;
}
