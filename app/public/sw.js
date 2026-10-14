// Service worker: guarda o "casco" do app para abrir sem internet.
// Os dados ficam no IndexedDB (camada de dados), não aqui.
const VERSAO = "__V__";
const CACHE = "inspeta-" + VERSAO;
const CASCO = ["./", "./index.html", "./main.js?v=" + VERSAO, "./app.css?v=" + VERSAO, "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("inspeta-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // navegação: rede primeiro (pega versão nova), cai no cache sem internet
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  // arquivos versionados: cache primeiro
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
