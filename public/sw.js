// Service worker del sistema. Hace UNA sola cosa: si el celular pierde la
// conexión con el servidor, muestra una página de "sin conexión" en lugar del
// error del navegador. NO guarda datos del sistema en el teléfono a propósito:
// la información de mantenimiento siempre se lee fresca del servidor y nada
// queda guardado en un celular que se puede perder.
const CACHE = "pagasa-sin-conexion-v1";
const PAGINA = "/sin-conexion.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([PAGINA, "/logos/icono-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Solo las navegaciones (abrir una página); todo lo demás pasa directo.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(PAGINA)));
});
