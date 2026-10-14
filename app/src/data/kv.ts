// Chave-valor mínimo sobre IndexedDB (sem dependências). Usado pelo servidor
// falso e pelo armazenamento do aparelho. IndexedDB e não localStorage porque
// fotos não cabem nos 5 MB do localStorage.

const DB = "inspeta";
const STORE = "kv";
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const kv = {
  get<T>(key: string): Promise<T | undefined> {
    return tx<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  },
  set<T>(key: string, value: T): Promise<void> {
    return tx("readwrite", (s) => s.put(value, key)).then(() => undefined);
  },
  del(key: string): Promise<void> {
    return tx("readwrite", (s) => s.delete(key)).then(() => undefined);
  },
  keys(prefix: string): Promise<string[]> {
    return tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((ks) =>
      (ks as string[]).filter((k) => typeof k === "string" && k.startsWith(prefix)),
    );
  },
};

// Serializa operações de leitura-modificação-escrita (evita corrida entre abas da mesma janela).
let chain: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

// Avisos de mudança para as telas se atualizarem.
export function emitChange(topic: string): void {
  window.dispatchEvent(new CustomEvent("inspeta:change", { detail: topic }));
  try { new BroadcastChannel("inspeta").postMessage(topic); } catch { /* sem suporte */ }
}

export function onChange(fn: (topic: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener("inspeta:change", h);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel("inspeta");
    bc.onmessage = (e) => fn(String(e.data));
  } catch { /* sem suporte */ }
  return () => { window.removeEventListener("inspeta:change", h); bc?.close(); };
}
