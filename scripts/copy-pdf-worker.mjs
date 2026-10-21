// Copia el worker de pdfjs-dist a /public para que se sirva como archivo
// estático (ver components/city/PdfViewer.tsx). Corre solo en postinstall:
// si se reinstalan o actualizan las dependencias, la copia se refresca sola
// y no queda una versión vieja del worker contra una librería nueva.
//
// Se hace así porque dejar que el empaquetador resuelva el worker con
// new URL(..., import.meta.url) rompe el build de producción: el minificador
// trata ese archivo (un módulo ESM) como código suelto y falla.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destino = join(raiz, "public", "pdf.worker.min.mjs");

if (!existsSync(origen)) {
  // No es un error: puede correr antes de que pdfjs-dist esté instalado.
  console.log("[copy-pdf-worker] pdfjs-dist todavía no está instalado, se omite.");
  process.exit(0);
}

// Al worker se le antepone lib/pdfjs-compat.js: el worker es otro contexto de
// JavaScript y en navegadores viejos le faltan métodos que pdfjs 6 necesita.
const compat = readFileSync(join(raiz, "lib", "pdfjs-compat.js"), "utf8");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${compat}\n${readFileSync(origen, "utf8")}`);
console.log("[copy-pdf-worker] worker copiado a public/pdf.worker.min.mjs (con compatibilidad)");
