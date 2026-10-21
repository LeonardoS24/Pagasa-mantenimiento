// Ruta a la que se puede mandar al usuario después de iniciar sesión (el
// middleware guarda en ?from= la página que quiso abrir, p. ej. la de una
// unidad al escanear su código QR). Solo rutas internas del sistema: nada de
// otros sitios (//dominio.com, https://...), ni la API ni el propio login,
// porque ese parámetro viene del navegador y cualquiera puede escribirlo.
export function rutaInternaSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const ruta = valor.trim();
  if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(ruta)) return null;
  if (ruta === "/login" || ruta.startsWith("/login/") || ruta.startsWith("/login?")) return null;
  if (ruta === "/api" || ruta.startsWith("/api/")) return null;
  return ruta;
}
