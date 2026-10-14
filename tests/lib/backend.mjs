// Os testes ponta a ponta rodam em dois modos:
//  - demonstração (padrão): o "servidor" é o núcleo no navegador, estado no IndexedDB;
//  - backend real (BACKEND=http://localhost:54321): API + Postgres local; o estado é lido pelos atalhos /__dev/.
export const BACKEND = process.env.BACKEND ?? "";

const lerKV = (page, key) => page.evaluate((k) => new Promise((res, rej) => {
  const r = indexedDB.open("inspeta", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("kv");
  r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => { r.result.close(); res(g.result); }; g.onerror = () => rej(g.error); };
}), key);
const gravarKV = (page, key, val) => page.evaluate(([k, v]) => new Promise((res) => {
  const r = indexedDB.open("inspeta", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("kv");
  r.onsuccess = () => { const t = r.result.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => { r.result.close(); res(); }; };
}), [key, val]);

export async function lerEstado(page) {
  if (BACKEND) return (await fetch(BACKEND + "/__dev/estado")).json();
  return lerKV(page, "srv:state");
}
export async function gravarEstado(page, s) {
  if (BACKEND) { await fetch(BACKEND + "/__dev/estado", { method: "PUT", body: JSON.stringify(s) }); return; }
  return gravarKV(page, "srv:state", s);
}
export async function lerAnexo(page, id) {
  if (BACKEND) return (await (await fetch(BACKEND + "/__dev/anexo?id=" + encodeURIComponent(id))).json()).data ?? undefined;
  return lerKV(page, "srv:anexo:" + id);
}
/** Só no modo demonstração: cada navegador tem o próprio "servidor"; copia o estado de uma aba para outra. */
export async function copiarServidor(de, para, idsAnexos) {
  if (BACKEND) return;
  await gravarKV(para, "srv:state", await lerKV(de, "srv:state"));
  for (const id of idsAnexos) await gravarKV(para, "srv:anexo:" + id, await lerKV(de, "srv:anexo:" + id));
}
