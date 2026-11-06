// Arranque del sistema en el SERVIDOR (lo usan los .bat de scripts/). Hace lo
// mismo que `next start`, más dos cosas:
//
// 1. La IP de quien se conecta, bien puesta. `next start` respeta un
//    encabezado X-Forwarded-For que mande el navegador: cualquiera podría
//    inventarse la IP con la que queda en la bitácora de acceso y saltarse el
//    freno de intentos fallidos por equipo. Aquí no hay ningún proxy delante,
//    así que la IP real es la del socket y se escribe siempre esa. Con el túnel
//    de Cloudflare (CONFIAR_TUNEL=cloudflare) la IP real y el esquema https se
//    leen de lo que entrega el túnel, y solo si la conexión viene de este
//    mismo equipo (ver scripts/ip-cliente.mjs).
//
// 2. HTTPS opcional. Si existen certificados/servidor.crt y servidor.key
//    (scripts/crear-certificado-https.mjs), sirve por HTTPS en HTTPS_PORT
//    (3443) y el puerto de siempre (3000) solo redirige a HTTPS, para que los
//    enlaces y códigos QR viejos sigan funcionando. Sin certificados, todo
//    queda como antes: HTTP en el 3000.
//
//   node scripts/servidor.mjs            (lo normal)
//   node scripts/servidor.mjs --sin-https (ignora los certificados)

import fs from "fs";
import http from "http";
import https from "https";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import next from "next";
import { iniciarRegistro } from "./registro-servidor.mjs";
import { confiaEnElTunel, datosDeConexion } from "./ip-cliente.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// uploads/, backups/ y la base se buscan desde la carpeta de trabajo: si se
// arrancara desde otro lado (una tarea programada sin "Iniciar en"), irían a
// parar a otra carpeta.
process.chdir(RAIZ);
const { arranques } = iniciarRegistro(RAIZ);
const PUERTO = Number(process.env.PORT) || 3000;
const PUERTO_HTTPS = Number(process.env.HTTPS_PORT) || 3443;
const CRT = path.join(RAIZ, "certificados", "servidor.crt");
const KEY = path.join(RAIZ, "certificados", "servidor.key");
const conHttps = !process.argv.includes("--sin-https") && fs.existsSync(CRT) && fs.existsSync(KEY);

// Con HTTPS la cookie de sesión va marcada "secure" (solo viaja cifrada).
// Se fija antes de cargar Next: lib/session.ts lo lee al importarse.
if (conHttps) process.env.COOKIE_SECURE = "true";

// Si el puerto ya está ocupado (otro servidor quedó abierto) no tiene caso
// reintentar: se sale con código 2 y servidor-iniciar.bat se detiene y avisa.
function alEscuchar(servidor, puerto) {
  servidor.on("error", (error) => {
    // EACCES: en Windows, Hyper-V o WSL a veces reservan el rango donde cae
    // el puerto. Reintentar tampoco arreglaría eso.
    if (error.code === "EADDRINUSE" || error.code === "EACCES") {
      const motivo = error.code === "EADDRINUSE" ? "ya está ocupado (¿hay otro servidor del sistema abierto?)" : "está reservado por Windows";
      console.error(`El puerto ${puerto} ${motivo}.`);
      arranques(`NO ARRANCÓ: puerto ${puerto} ${error.code === "EADDRINUSE" ? "ocupado" : "reservado"}`);
      process.exit(2);
    }
    throw error;
  });
  return servidor;
}

const app = next({ dev: false, dir: RAIZ, hostname: "0.0.0.0", port: conHttps ? PUERTO_HTTPS : PUERTO });
await app.prepare();
const manejar = app.getRequestHandler();

function atender(protocolo) {
  return (req, res) => {
    // process.env se lee en cada petición: Next carga el .env al preparar.
    const conexion = datosDeConexion(req, { confiarTunel: confiaEnElTunel(process.env.CONFIAR_TUNEL) });
    req.headers["x-forwarded-for"] = conexion.ip;
    // https = HTTPS propio de este servidor o petición que llegó por el túnel.
    req.headers["x-forwarded-proto"] = protocolo === "https" || conexion.https ? "https" : "http";
    manejar(req, res).catch((error) => {
      console.error(error);
      res.statusCode = 500;
      res.end("Error interno");
    });
  };
}

const direcciones = [];
for (const lista of Object.values(os.networkInterfaces())) {
  for (const i of lista ?? []) if (i.family === "IPv4" && !i.internal) direcciones.push(i.address);
}

if (conHttps) {
  alEscuchar(https.createServer({ cert: fs.readFileSync(CRT), key: fs.readFileSync(KEY) }, atender("https")), PUERTO_HTTPS).listen(
    PUERTO_HTTPS,
    "0.0.0.0",
    () => arranques(`ARRANQUE (HTTPS, Node ${process.version})`)
  );
  // El puerto viejo solo manda a HTTPS (307 conserva el método y el cuerpo).
  alEscuchar(
    http.createServer((req, res) => {
      const host = (req.headers.host ?? "localhost").replace(/:\d+$/, "");
      res.writeHead(307, { Location: `https://${host}:${PUERTO_HTTPS}${req.url ?? "/"}` });
      res.end();
    }),
    PUERTO
  ).listen(PUERTO, "0.0.0.0");
  console.log("Sistema Pagasa listo por HTTPS. Los demas entran a:");
  for (const d of direcciones) console.log(`   https://${d}:${PUERTO_HTTPS}`);
  console.log(`(http://...:${PUERTO} redirige solo a HTTPS)`);
} else {
  alEscuchar(http.createServer(atender("http")), PUERTO).listen(PUERTO, "0.0.0.0", () =>
    arranques(`ARRANQUE (HTTP, Node ${process.version})`)
  );
  console.log("Sistema Pagasa listo. Los demas entran a:");
  for (const d of direcciones) console.log(`   http://${d}:${PUERTO}`);
}
