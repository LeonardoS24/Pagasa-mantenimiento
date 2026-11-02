// Registro del servidor en archivos (lo carga scripts/servidor.mjs antes que
// nada). Sin esto, todo lo que el sistema escribe (errores incluidos) solo
// salía en la ventana negra y se perdía al cerrarla.
//
//   logs/servidor-AAAA-MM-DD.log   todo lo que se escribe en la consola, con hora
//   logs/arranques.log             cada arranque y cada caída, con el motivo
//
// Se conservan 30 días (los más viejos se borran al arrancar y cada día).

import fs from "fs";
import path from "path";
import util from "util";

const DIAS_A_CONSERVAR = 30;

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}
function dia(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}
function hora(fecha = new Date()) {
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
}

export function iniciarRegistro(raiz) {
  const carpeta = path.join(raiz, "logs");
  fs.mkdirSync(carpeta, { recursive: true });

  const limpiarViejos = () => {
    const limite = Date.now() - DIAS_A_CONSERVAR * 24 * 60 * 60 * 1000;
    for (const nombre of fs.readdirSync(carpeta)) {
      if (!/^servidor-\d{4}-\d{2}-\d{2}\.log$/.test(nombre)) continue;
      try {
        if (fs.statSync(path.join(carpeta, nombre)).mtimeMs < limite) fs.rmSync(path.join(carpeta, nombre));
      } catch {
        // Si no se puede borrar hoy, se intenta mañana.
      }
    }
  };
  limpiarViejos();
  setInterval(limpiarViejos, 24 * 60 * 60 * 1000).unref();

  const escribir = (nivel, args) => {
    const texto = args.map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: 4 }))).join(" ");
    try {
      fs.appendFileSync(path.join(carpeta, `servidor-${dia()}.log`), `${hora()} ${nivel} ${texto}\n`);
    } catch {
      // Disco lleno o sin permiso: que no tumbe al servidor por el registro.
    }
  };

  for (const [metodo, nivel] of [["log", "INFO "], ["info", "INFO "], ["warn", "AVISO"], ["error", "ERROR"]]) {
    const original = console[metodo].bind(console);
    console[metodo] = (...args) => {
      original(...args);
      escribir(nivel, args);
    };
  }

  const arranques = (texto) => {
    try {
      fs.appendFileSync(path.join(carpeta, "arranques.log"), `${dia()} ${hora()} ${texto}\n`);
    } catch {
      // Igual que arriba.
    }
  };

  // Un error que nadie atrapó deja al proceso en un estado desconocido: se
  // anota y se sale con código 1, y servidor-iniciar.bat lo vuelve a levantar.
  process.on("uncaughtException", (error) => {
    console.error("Error no controlado:", error);
    arranques(`CAÍDA: ${error?.message ?? error}`);
    process.exit(1);
  });
  process.on("unhandledRejection", (motivo) => {
    // Una promesa rechazada sin catch no deja el proceso roto: se anota y sigue.
    console.error("Promesa rechazada sin atender:", motivo);
  });

  return { arranques };
}
