// Ambiente do núcleo no navegador: estado inteiro num registro do IndexedDB.
// É o modo demonstração (e o que os testes ponta a ponta usam sem backend).
import { emitChange, kv, serial } from "./kv";
import { net } from "./net";
import { estadoDemonstracao, type Ambiente, type State } from "./nucleo";
import { ORG } from "./seed";
import { OfflineError } from "./types";

const STATE_KEY = "srv:state";
const ANEXO = "srv:anexo:";

export const ambienteNavegador: Ambiente = {
  org: ORG,
  carregar: () => kv.get<State>(STATE_KEY),
  gravar: (s) => kv.set(STATE_KEY, s),
  exclusivo: serial,
  estadoInicial: () => estadoDemonstracao(ORG),
  anexo: (id) => kv.get<string>(ANEXO + id),
  guardarAnexo: (id, d) => kv.set(ANEXO + id, d),
  anexosPresentes: async (ids) => {
    const ks = new Set(await kv.keys(ANEXO));
    return new Set(ids.filter((i) => ks.has(ANEXO + i)));
  },
  urlApp: () => `${location.origin}${location.pathname}`,
  atraso: () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180)),
  aviso: emitChange,
  exigirRede: () => { if (!net.online) throw new OfflineError(); },
  local: {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
    limpar: async () => {
      for (const k of await kv.keys("")) await kv.del(k);
      try { localStorage.clear(); } catch { /* idem */ }
    },
  },
};
