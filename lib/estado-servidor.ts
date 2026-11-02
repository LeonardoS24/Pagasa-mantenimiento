import fs from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "./prisma";
import { PROJECT_ROOT } from "./rutas-datos";
import { getAlmacenamiento } from "./almacenamiento";
import { listBackups } from "./backup";
import { HORAS_PARA_AVISO, getEstadoExterno, getRutaExterna, horasDesde } from "./respaldo-externo";
import { versionInstalada } from "./version";
import { INACTIVIDAD_MS } from "./sesion-vigencia";

// Todo lo que dice si el servidor está bien, en un solo lugar (página
// /admin/estado). Cada punto trae su semáforo para leerlo de un vistazo.

export type Nivel = "ok" | "aviso" | "mal";
export type Punto = { nombre: string; nivel: Nivel; valor: string; detalle?: string };

const CARPETA_LOGS = path.join(PROJECT_ROOT, "logs");

function bytes(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function duracion(segundos: number): string {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function fechaHora(d: Date): string {
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

// Las últimas líneas de error de los registros de hoy y ayer.
export async function erroresRecientes(maximo = 40): Promise<string[]> {
  let archivos: string[] = [];
  try {
    archivos = (await fs.readdir(CARPETA_LOGS)).filter((n) => /^servidor-\d{4}-\d{2}-\d{2}\.log$/.test(n)).sort().slice(-2);
  } catch {
    return [];
  }
  const lineas: string[] = [];
  for (const nombre of archivos) {
    const texto = await fs.readFile(path.join(CARPETA_LOGS, nombre), "utf8").catch(() => "");
    const dia = nombre.slice(9, 19);
    for (const l of texto.split("\n")) if (/ ERROR /.test(l)) lineas.push(`${dia} ${l}`.slice(0, 400));
  }
  return lineas.slice(-maximo).reverse();
}

export async function arranquesRecientes(maximo = 15): Promise<string[]> {
  const texto = await fs.readFile(path.join(CARPETA_LOGS, "arranques.log"), "utf8").catch(() => "");
  return texto.trim().split("\n").filter(Boolean).slice(-maximo).reverse();
}

export async function getEstadoServidor(): Promise<{ puntos: Punto[]; version: Awaited<ReturnType<typeof versionInstalada>> }> {
  const puntos: Punto[] = [];
  const [version, almacenamiento, backups, ruta, externo, config, integridad, sesiones, errores] = await Promise.all([
    versionInstalada(),
    getAlmacenamiento(),
    listBackups(),
    getRutaExterna(),
    getEstadoExterno(),
    prisma.configuracionReportes.findUnique({ where: { id: "unico" } }),
    prisma.$queryRawUnsafe<{ quick_check: string }[]>("PRAGMA quick_check").then((f) => f.map((x) => x.quick_check).join("; ")).catch((e) => String(e)),
    prisma.sesionActiva.count({ where: { ultimaActividad: { gte: new Date(Date.now() - INACTIVIDAD_MS) } } }),
    erroresRecientes(200),
  ]);

  puntos.push({
    nombre: "Encendido",
    nivel: "ok",
    valor: `desde hace ${duracion(process.uptime())}`,
    detalle: `Node ${process.version} · ${os.platform()} · memoria ${bytes(process.memoryUsage().rss)} · ${os.hostname()}`,
  });

  puntos.push({
    nombre: "Base de datos",
    nivel: integridad === "ok" ? "ok" : "mal",
    valor: integridad === "ok" ? "íntegra" : "con problemas",
    detalle: integridad === "ok" ? `${bytes(almacenamiento.baseBytes)} · revisión rápida de integridad correcta` : integridad,
  });

  const libre = almacenamiento.discoLibreBytes;
  const total = almacenamiento.discoTotalBytes;
  const proporcion = libre !== null && total ? libre / total : null;
  puntos.push({
    nombre: "Espacio en disco",
    nivel: libre === null ? "aviso" : libre < 5 * 1024 ** 3 || (proporcion ?? 1) < 0.05 ? "mal" : libre < 15 * 1024 ** 3 || (proporcion ?? 1) < 0.1 ? "aviso" : "ok",
    valor: `${bytes(libre)} libres`,
    detalle: total ? `de ${bytes(total)} · archivos subidos ${bytes(almacenamiento.uploadsBytes)}` : undefined,
  });

  const horasExt = horasDesde(externo.ultimoExito?.fecha);
  puntos.push({
    nombre: "Copia de seguridad servidor (USB)",
    nivel: !ruta ? "mal" : horasExt < HORAS_PARA_AVISO ? "ok" : "mal",
    valor: !ruta ? "sin configurar" : externo.ultimoExito ? `última ${fechaHora(new Date(externo.ultimoExito.fecha))}` : "ninguna todavía",
    detalle: ruta ? `en ${ruta}` : "Elígela en Respaldos.",
  });

  const ultimoLocal = backups[0];
  const horasLocal = ultimoLocal ? (Date.now() - ultimoLocal.date.getTime()) / 3_600_000 : Infinity;
  puntos.push({
    nombre: "Respaldo en este equipo",
    nivel: horasLocal < 48 ? "ok" : "aviso",
    valor: ultimoLocal ? `último ${fechaHora(ultimoLocal.date)}` : "ninguno",
    detalle: `${backups.length} guardado(s)`,
  });

  puntos.push({
    nombre: "Reporte por correo",
    nivel: !config?.activo ? "aviso" : config.ultimoError ? "mal" : "ok",
    valor: !config?.activo ? "desactivado" : config.ultimoEnvio ? `último envío ${fechaHora(config.ultimoEnvio)}` : "activo, sin envíos todavía",
    detalle: config?.ultimoError ?? config?.avisoRojoUltimoResumen ?? undefined,
  });

  puntos.push({
    nombre: "Conexión cifrada (HTTPS)",
    nivel: process.env.COOKIE_SECURE === "true" ? "ok" : "aviso",
    valor: process.env.COOKIE_SECURE === "true" ? "activa" : "no (HTTP)",
    detalle: process.env.COOKIE_SECURE === "true" ? undefined : "Las contraseñas viajan sin cifrar por la red. Ver SERVIDOR.md, HTTPS.",
  });

  const h = new Date();
  const hoy = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  const erroresHoy = errores.filter((l) => l.startsWith(hoy)).length;
  puntos.push({
    nombre: "Errores registrados",
    nivel: errores.length === 0 ? "ok" : erroresHoy > 20 ? "mal" : "aviso",
    valor: `${errores.length} en hoy y ayer`,
    detalle: errores.length ? "Abajo están los más recientes." : undefined,
  });

  puntos.push({ nombre: "Sesiones activas", nivel: "ok", valor: String(sesiones) });

  return { puntos, version };
}
