// Arranque del sistema en el SERVIDOR (lo usan los .bat de scripts/). Hace lo
// mismo que `next start`, más dos cosas:
//
// 1. La IP de quien se conecta, bien puesta. `next start` respeta un
//    encabezado X-Forwarded-For que mande el navegador: cualquiera podría
//    inventarse la IP con la que queda en la bitácora de acceso y saltarse el
//    freno de intentos fallidos por equipo. Aquí no hay ningún proxy delante,
//    así que la IP real es la del socket y se escribe siempre esa.
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

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// uploads/, backups/ y la base se buscan desde la carpeta de trabajo: si se
// arrancara desde otro lado (una tarea programada sin "Iniciar en"), irían a
// parar a otra carpeta.
process.chdir(RAIZ);
const PUERTO = Number(process.env.PORT) || 3000;
const PUERTO_HTTPS = Number(process.env.HTTPS_PORT) || 3443;
const CRT = path.join(RAIZ, "certificados", "servidor.crt");
const KEY = path.join(RAIZ, "certificados", "servidor.key");
const conHttps = !process.argv.includes("--sin-https") && fs.existsSync(CRT) && fs.existsSync(KEY);

// Con HTTPS la cookie de sesión va marcada "secure" (solo viaja cifrada).
// Se fija antes de cargar Next: lib/session.ts lo lee al importarse.
if (conHttps) process.env.COOKIE_SECURE = "true";

function ipDe(req) {
  return (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

const app = next({ dev: false, dir: RAIZ, hostname: "0.0.0.0", port: conHttps ? PUERTO_HTTPS : PUERTO });
await app.prepare();
const manejar = app.getRequestHandler();

function atender(protocolo) {
  return (req, res) => {
    req.headers["x-forwarded-for"] = ipDe(req);
    req.headers["x-forwarded-proto"] = protocolo;
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
  https
    .createServer({ cert: fs.readFileSync(CRT), key: fs.readFileSync(KEY) }, atender("https"))
    .listen(PUERTO_HTTPS, "0.0.0.0");
  // El puerto viejo solo manda a HTTPS (307 conserva el método y el cuerpo).
  http
    .createServer((req, res) => {
      const host = (req.headers.host ?? "localhost").replace(/:\d+$/, "");
      res.writeHead(307, { Location: `https://${host}:${PUERTO_HTTPS}${req.url ?? "/"}` });
      res.end();
    })
    .listen(PUERTO, "0.0.0.0");
  console.log("Sistema Pagasa listo por HTTPS. Los demas entran a:");
  for (const d of direcciones) console.log(`   https://${d}:${PUERTO_HTTPS}`);
  console.log(`(http://...:${PUERTO} redirige solo a HTTPS)`);
} else {
  http.createServer(atender("http")).listen(PUERTO, "0.0.0.0");
  console.log("Sistema Pagasa listo. Los demas entran a:");
  for (const d of direcciones) console.log(`   http://${d}:${PUERTO}`);
}
