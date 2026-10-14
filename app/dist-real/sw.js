// Service worker: guarda o "casco" do app para abrir sem internet.
// Os dados ficam no IndexedDB (camada de dados), não aqui.
const VERSAO = "177c7ec-1791986103";
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

// Toque no aviso de agendamento: foca uma janela aberta do app ou abre a agenda.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "./#/campo/agenda", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.navigate(url).then((w) => (w ?? c).focus()) : self.clients.openWindow(url);
  }));
});
