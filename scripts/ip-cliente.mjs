// De dónde viene cada petición (IP y si llegó por HTTPS), para scripts/servidor.mjs.
//
// Sin túnel: la IP es la del socket y se ignora todo encabezado que mande el
// navegador (cualquiera podría inventarse la IP con la que queda en la
// bitácora de acceso y saltarse el freno de intentos fallidos por equipo).
//
// Con túnel de Cloudflare (CONFIAR_TUNEL=cloudflare en el .env): cloudflared
// corre en ESTA computadora y entrega cada petición por localhost, así que
// todas llegarían con la IP 127.0.0.1. Solo cuando la conexión viene del
// propio equipo (loopback) se cree en lo que dice Cloudflare: la IP real en
// CF-Connecting-IP y el esquema (https) en CF-Visitor. Una computadora de la
// red local nunca llega por loopback, así que no puede hacerse pasar por el
// túnel mandando esos encabezados.
import net from "node:net";

const LOOPBACK = new Set(["127.0.0.1", "::1"]);

export function sinPrefijoIPv4(direccion) {
  return String(direccion ?? "").replace(/^::ffff:/, "");
}

function primero(valor) {
  return String(Array.isArray(valor) ? valor[0] : (valor ?? "")).trim();
}

function esquemaHttps(encabezados) {
  try {
    const visitante = JSON.parse(primero(encabezados["cf-visitor"]) || "{}");
    if (visitante && typeof visitante.scheme === "string") return visitante.scheme === "https";
  } catch {
    // El encabezado no era JSON: se sigue con X-Forwarded-Proto.
  }
  return primero(encabezados["x-forwarded-proto"]).split(",")[0].trim().toLowerCase() === "https";
}

export function datosDeConexion(req, { confiarTunel = false } = {}) {
  const socket = sinPrefijoIPv4(req.socket?.remoteAddress);
  const porTunel = confiarTunel && LOOPBACK.has(socket);
  if (!porTunel) return { ip: socket, https: false, porTunel: false };
  const real = primero(req.headers["cf-connecting-ip"]);
  return { ip: net.isIP(real) ? sinPrefijoIPv4(real) : socket, https: esquemaHttps(req.headers), porTunel: true };
}

export function confiaEnElTunel(valorEnv) {
  return String(valorEnv ?? "").trim().toLowerCase() === "cloudflare";
}
