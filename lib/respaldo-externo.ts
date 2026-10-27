import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { prisma } from "./prisma";
import { BACKUP_DIR, PROJECT_ROOT, UPLOADS_DIR } from "./rutas-datos";
import { conteosDeLaBaseViva, fotografiarBase, verificarCopia, type ConteosBase } from "./copia-base";

// "Copia de seguridad servidor": la copia de los datos reales en una memoria
// USB o disco conectado al servidor.
//
// Los respaldos de backups/ viven en el MISMO disco que el sistema: si ese
// disco falla se pierden los dos juntos. Esta copia va a otra unidad que el
// ADMIN elige en /admin/respaldos.
//
// Qué deja en la unidad, dentro de la carpeta "Copia de seguridad servidor":
// - base/pagasa-AAAA-MM-DD_HHMM.db — una foto consistente de la base por día
//   (VACUUM INTO, ver lib/copia-base.ts), verificada antes de darla por buena.
//   Se conservan las últimas BASES_A_CONSERVAR (pesan poco).
// - uploads/ — espejo de los archivos subidos. Solo se copia lo nuevo o lo que
//   cambió, así que después de la primera vez tarda segundos. NUNCA se borra
//   nada de aquí: en este sistema el historial no se borra, y si alguien
//   elimina un documento por error, la copia lo conserva.
// - LEEME.txt (cómo restaurar) y estado.json (resultado de la última copia).

export const NOMBRE_CARPETA_EXTERNA = "Copia de seguridad servidor";
const CLAVE_RUTA = "respaldoExternoRuta";
const CLAVE_ESTADO = "respaldoExternoEstado";
const BASES_A_CONSERVAR = 30;
// Cada cuánto se revisa si toca copiar, y cuánto debe pasar desde la última
// copia buena para repetirla. Si la memoria estaba desconectada a la hora de
// la copia, en cuanto se conecte (a la siguiente revisión) se hace.
const REVISAR_CADA_MS = 60 * 60 * 1000;
const HORAS_ENTRE_COPIAS = 20;
// A partir de cuántas horas sin copia buena se avisa en rojo.
export const HORAS_PARA_AVISO = 48;

// ---------------------------------------------------------------------------
// Configuración y estado

export type ResultadoCopiaExterna = {
  fecha: string;
  ok: boolean;
  mensaje: string;
  destino: string;
  duracionSeg: number;
  base?: { archivo: string; bytes: number; integridad: string; conteos: ConteosBase };
  archivos?: { copiados: number; yaEstaban: number; bytesCopiados: number; totalOrigen: number; faltantes: number };
};

export type EstadoGuardado = {
  ultimo: ResultadoCopiaExterna | null;
  // La última que salió bien (puede ser más vieja que "ultimo" si la última
  // falló, por ejemplo porque la memoria estaba desconectada).
  ultimoExito: ResultadoCopiaExterna | null;
};

export async function getRutaExterna(): Promise<string | null> {
  const fila = await prisma.ajusteSistema.findUnique({ where: { clave: CLAVE_RUTA } });
  return fila?.valor || null;
}

export async function setRutaExterna(ruta: string | null): Promise<void> {
  if (!ruta) {
    await prisma.ajusteSistema.deleteMany({ where: { clave: CLAVE_RUTA } });
    return;
  }
  await prisma.ajusteSistema.upsert({ where: { clave: CLAVE_RUTA }, update: { valor: ruta }, create: { clave: CLAVE_RUTA, valor: ruta } });
}

export async function getEstadoExterno(): Promise<EstadoGuardado> {
  const fila = await prisma.ajusteSistema.findUnique({ where: { clave: CLAVE_ESTADO } });
  if (!fila) return { ultimo: null, ultimoExito: null };
  try {
    return JSON.parse(fila.valor) as EstadoGuardado;
  } catch {
    return { ultimo: null, ultimoExito: null };
  }
}

async function guardarResultado(resultado: ResultadoCopiaExterna): Promise<void> {
  const anterior = await getEstadoExterno();
  const estado: EstadoGuardado = { ultimo: resultado, ultimoExito: resultado.ok ? resultado : anterior.ultimoExito };
  const valor = JSON.stringify(estado);
  await prisma.ajusteSistema.upsert({ where: { clave: CLAVE_ESTADO }, update: { valor }, create: { clave: CLAVE_ESTADO, valor } });
}

// Revisa que la ruta tenga forma de unidad o carpeta y no sea el propio
// sistema (copiar uploads/ dentro de sí mismo no acabaría nunca).
export function validarRutaExterna(valor: string): string | null {
  const ruta = valor.trim();
  if (!ruta) return "Escribe o elige una unidad.";
  if (!path.isAbsolute(ruta)) return "La ruta debe ser completa, por ejemplo E:\\ o /media/usb.";
  const relativa = path.relative(PROJECT_ROOT, path.resolve(ruta));
  if (relativa === "" || (!relativa.startsWith("..") && !path.isAbsolute(relativa))) {
    return "No puede ser la carpeta del sistema ni algo dentro de ella.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unidades conectadas

export type UnidadDisponible = {
  ruta: string;
  etiqueta: string | null;
  tipo: "removible" | "local" | "red" | "desconocido";
  libreBytes: number | null;
  totalBytes: number | null;
  // La unidad donde está instalado el sistema: copiar ahí no protege de
  // que falle el disco.
  esDelSistema: boolean;
};

function mismaUnidad(a: string, b: string): boolean {
  return path.parse(path.resolve(a)).root.toLowerCase() === path.parse(path.resolve(b)).root.toLowerCase();
}

async function espacio(ruta: string): Promise<{ libre: number | null; total: number | null }> {
  try {
    const s = await fs.statfs(ruta);
    return { libre: Number(s.bavail) * Number(s.bsize), total: Number(s.blocks) * Number(s.bsize) };
  } catch {
    return { libre: null, total: null };
  }
}

function powershell(comando: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", comando],
      { timeout: 8000, windowsHide: true },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    );
  });
}

async function unidadesWindows(): Promise<UnidadDisponible[]> {
  // DriveType: 2 = removible (memoria USB), 3 = disco local (también los
  // discos USB grandes), 4 = red.
  try {
    const salida = await powershell(
      "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,FreeSpace,Size | ConvertTo-Json -Compress"
    );
    const datos = JSON.parse(salida) as
      | { DeviceID: string; DriveType: number; VolumeName: string | null; FreeSpace: number | null; Size: number | null }
      | { DeviceID: string; DriveType: number; VolumeName: string | null; FreeSpace: number | null; Size: number | null }[];
    const lista = Array.isArray(datos) ? datos : [datos];
    return lista
      .filter((d) => d.Size) // lectores vacíos (sin disco) no sirven
      .map((d) => {
        const ruta = `${d.DeviceID}\\`;
        return {
          ruta,
          etiqueta: d.VolumeName || null,
          tipo: d.DriveType === 2 ? "removible" : d.DriveType === 3 ? "local" : d.DriveType === 4 ? "red" : "desconocido",
          libreBytes: d.FreeSpace ?? null,
          totalBytes: d.Size ?? null,
          esDelSistema: mismaUnidad(ruta, PROJECT_ROOT),
        } satisfies UnidadDisponible;
      });
  } catch {
    // Sin PowerShell: se prueban las letras una por una (sin etiqueta).
    const encontradas: UnidadDisponible[] = [];
    for (const letra of "DEFGHIJKLMNOPQRSTUVWXYZ") {
      const ruta = `${letra}:\\`;
      const { libre, total } = await espacio(ruta);
      if (total) encontradas.push({ ruta, etiqueta: null, tipo: "desconocido", libreBytes: libre, totalBytes: total, esDelSistema: mismaUnidad(ruta, PROJECT_ROOT) });
    }
    return encontradas;
  }
}

async function unidadesUnix(): Promise<UnidadDisponible[]> {
  // Linux monta las memorias en /media/<usuario>/<nombre> o /media/<nombre>;
  // macOS en /Volumes/<nombre>.
  const candidatas: string[] = [];
  for (const base of ["/media", "/mnt", "/Volumes", "/run/media"]) {
    let entradas: string[] = [];
    try {
      entradas = await fs.readdir(base);
    } catch {
      continue;
    }
    for (const e of entradas) {
      const ruta = path.join(base, e);
      try {
        if (!(await fs.stat(ruta)).isDirectory()) continue;
      } catch {
        continue;
      }
      // /media/<usuario>/ contiene las memorias, no es una.
      const dentro = await fs.readdir(ruta).catch(() => [] as string[]);
      if (base !== "/Volumes" && dentro.length > 0 && !(await esPuntoDeMontaje(ruta))) {
        for (const d of dentro) candidatas.push(path.join(ruta, d));
      } else {
        candidatas.push(ruta);
      }
    }
  }
  const unidades: UnidadDisponible[] = [];
  for (const ruta of candidatas) {
    const { libre, total } = await espacio(ruta);
    unidades.push({ ruta, etiqueta: path.basename(ruta), tipo: "removible", libreBytes: libre, totalBytes: total, esDelSistema: false });
  }
  return unidades;
}

async function esPuntoDeMontaje(ruta: string): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([fs.stat(ruta), fs.stat(path.dirname(ruta))]);
    return a.dev !== b.dev;
  } catch {
    return false;
  }
}

export async function listarUnidades(): Promise<UnidadDisponible[]> {
  return process.platform === "win32" ? unidadesWindows() : unidadesUnix();
}

// ---------------------------------------------------------------------------
// La copia

export type Progreso = {
  enCurso: boolean;
  fase: string;
  archivosHechos: number;
  archivosTotales: number;
  iniciadoEl: number | null;
};

// En globalThis: Next puede cargar este módulo más de una vez (la acción del
// botón y la tarea programada) y las dos deben ver la misma copia en curso.
const g = globalThis as unknown as { __respaldoExterno?: Progreso; __respaldoExternoAgendado?: boolean };
function progreso(): Progreso {
  g.__respaldoExterno ??= { enCurso: false, fase: "", archivosHechos: 0, archivosTotales: 0, iniciadoEl: null };
  return g.__respaldoExterno;
}

export function getProgresoExterno(): Progreso {
  return { ...progreso() };
}

async function listarArchivos(dir: string, base = dir): Promise<{ rel: string; size: number; mtimeMs: number }[]> {
  let entradas;
  try {
    entradas = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const lista: { rel: string; size: number; mtimeMs: number }[] = [];
  for (const e of entradas) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) lista.push(...(await listarArchivos(ruta, base)));
    else if (e.isFile()) {
      try {
        const st = await fs.stat(ruta);
        lista.push({ rel: path.relative(base, ruta), size: st.size, mtimeMs: st.mtimeMs });
      } catch {
        // Se borró mientras se listaba.
      }
    }
  }
  return lista;
}

async function hashArchivo(ruta: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(ruta));
  return hash.digest("hex");
}

function marcaDeTiempo(fecha: Date): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}_${d(fecha.getHours())}${d(fecha.getMinutes())}`;
}

const LEEME = `COPIA DE SEGURIDAD DEL SISTEMA INTEGRAL DE MANTENIMIENTO - GRUPO PAGASA
=========================================================================

Esta carpeta la llena sola el servidor del sistema (Panel de administracion >
Respaldos > Copia de seguridad servidor). No borres ni cambies nada aqui.

Que hay:
  base\\pagasa-AAAA-MM-DD_HHMM.db   Una copia de la base de datos por dia
                                    (las ultimas ${BASES_A_CONSERVAR}). Cada una se reviso
                                    al copiarla (integridad y conteo de registros).
  uploads\\                         Todos los PDF, fotos y escaneos subidos.
                                    Aqui no se borra nada nunca.
  estado.json                       Resultado de la ultima copia.

COMO RESTAURAR (solo si se perdio la base o el disco del servidor):
  1. En el servidor, doble clic en scripts\\servidor-restaurar.bat
  2. Arrastra a la ventana el archivo .db mas reciente de la carpeta base\\
     y escribe SI para confirmar. El script detiene el sistema, guarda la
     base actual en backups\\antes-de-restaurar\\, pone la copia y recupera
     los archivos de uploads\\ que falten.
  3. Si el disco del servidor se perdio completo: instala el sistema de nuevo
     (DESPLIEGUE.md) y luego haz el paso 1.

LO QUE ESTA COPIA NO LLEVA (a proposito, son llaves):
  - El archivo .env del servidor (SESSION_SECRET). Sin el mismo, la
    contrasena del correo guardada en el sistema hay que volver a escribirla
    y todos vuelven a iniciar sesion. Guarda una copia de .env aparte, en un
    lugar seguro (no en esta memoria).
  - La carpeta certificados\\ (HTTPS). Si se pierde, se vuelve a crear con
    servidor-activar-https.bat y hay que reinstalar pagasa-ca.crt en los
    equipos.
`;

// Hace la copia completa a la unidad configurada. Nunca lanza: el resultado
// (bueno o malo) queda guardado y es lo que muestra el panel.
export async function copiarAExterno(): Promise<ResultadoCopiaExterna> {
  const p = progreso();
  if (p.enCurso) {
    return { fecha: new Date().toISOString(), ok: false, mensaje: "Ya hay una copia en curso.", destino: "", duracionSeg: 0 };
  }
  p.enCurso = true;
  p.fase = "Preparando";
  p.archivosHechos = 0;
  p.archivosTotales = 0;
  p.iniciadoEl = Date.now();
  const inicio = Date.now();
  const fin = async (r: Omit<ResultadoCopiaExterna, "fecha" | "duracionSeg">): Promise<ResultadoCopiaExterna> => {
    const resultado = { ...r, fecha: new Date().toISOString(), duracionSeg: Math.round((Date.now() - inicio) / 1000) };
    try {
      await guardarResultado(resultado);
    } catch (error) {
      console.error("[respaldo externo] No se pudo guardar el resultado:", error);
    }
    p.enCurso = false;
    p.fase = "";
    return resultado;
  };

  // Todo dentro del try: si algo lanzara fuera, enCurso se quedaría en true y
  // no habría más copias hasta reiniciar el servidor.
  let destino = "";
  try {
    const ruta = await getRutaExterna();
    if (!ruta) return fin({ ok: false, mensaje: "No hay una unidad elegida para la copia.", destino: "" });
    destino = path.join(ruta, NOMBRE_CARPETA_EXTERNA);
    try {
      await fs.access(ruta);
    } catch {
      return fin({ ok: false, mensaje: `No se encontró la unidad ${ruta}. ¿Está conectada la memoria?`, destino });
    }
    await fs.mkdir(path.join(destino, "base"), { recursive: true });
    await fs.mkdir(path.join(destino, "uploads"), { recursive: true });
    await fs.writeFile(path.join(destino, "LEEME.txt"), LEEME.replace(/\n/g, "\r\n"));

    // 1. Base: foto local, verificación, y entonces sí a la memoria.
    p.fase = "Copiando la base de datos";
    const nombreBase = `pagasa-${marcaDeTiempo(new Date())}.db`;
    const local = path.join(BACKUP_DIR, ".verificacion", `externa-${Date.now()}.db`);
    await fotografiarBase(local);
    let base: ResultadoCopiaExterna["base"];
    try {
      const verificacion = await verificarCopia(local);
      if (verificacion.integridad !== "ok") {
        return fin({ ok: false, mensaje: `La copia de la base salió dañada (${verificacion.integridad}). No se guardó.`, destino });
      }
      const final = path.join(destino, "base", nombreBase);
      const temporal = `${final}.tmp`;
      await fs.copyFile(local, temporal);
      if ((await hashArchivo(temporal)) !== (await hashArchivo(local))) {
        await fs.rm(temporal, { force: true });
        return fin({ ok: false, mensaje: "La base no se copió completa a la memoria (no coincide al compararla). Revisa la memoria.", destino });
      }
      await fs.rename(temporal, final);
      base = { archivo: nombreBase, bytes: (await fs.stat(final)).size, integridad: verificacion.integridad, conteos: verificacion.conteos };
    } finally {
      // En Windows el archivo puede seguir ocupado un instante: que no tumbe
      // una copia que salió bien (lo que quede se limpia en la siguiente).
      await fs.rm(local, { force: true }).catch(() => undefined);
    }

    // Se conservan las últimas BASES_A_CONSERVAR.
    const bases = (await fs.readdir(path.join(destino, "base"))).filter((n) => /^pagasa-.*\.db$/.test(n)).sort().reverse();
    for (const vieja of bases.slice(BASES_A_CONSERVAR)) await fs.rm(path.join(destino, "base", vieja), { force: true });
    // Restos de una copia interrumpida (memoria desconectada a la mitad).
    for (const n of await fs.readdir(path.join(destino, "base"))) {
      if (n.endsWith(".tmp")) await fs.rm(path.join(destino, "base", n), { force: true });
    }

    // 2. Archivos: solo lo nuevo o lo que cambió.
    p.fase = "Copiando archivos";
    const origen = await listarArchivos(UPLOADS_DIR);
    p.archivosTotales = origen.length;
    let copiados = 0;
    let yaEstaban = 0;
    let bytesCopiados = 0;
    for (const archivo of origen) {
      const desde = path.join(UPLOADS_DIR, archivo.rel);
      const hacia = path.join(destino, "uploads", archivo.rel);
      let igual = false;
      try {
        const st = await fs.stat(hacia);
        igual = st.size === archivo.size && Math.abs(st.mtimeMs - archivo.mtimeMs) < 2000;
      } catch {
        // No existe todavía.
      }
      if (igual) {
        yaEstaban++;
      } else {
        await fs.mkdir(path.dirname(hacia), { recursive: true });
        const temporal = `${hacia}.tmp`;
        await fs.copyFile(desde, temporal);
        await fs.rename(temporal, hacia);
        const fecha = new Date(archivo.mtimeMs);
        await fs.utimes(hacia, fecha, fecha);
        copiados++;
        bytesCopiados += archivo.size;
      }
      p.archivosHechos++;
    }

    // 3. Comprobación: cada archivo del sistema está en la memoria con su tamaño.
    p.fase = "Comprobando";
    let faltantes = 0;
    for (const archivo of origen) {
      try {
        if ((await fs.stat(path.join(destino, "uploads", archivo.rel))).size !== archivo.size) faltantes++;
      } catch {
        faltantes++;
      }
    }

    const archivos = { copiados, yaEstaban, bytesCopiados, totalOrigen: origen.length, faltantes };
    const ok = faltantes === 0;
    const resultado = await fin({
      ok,
      mensaje: ok
        ? "Copia completa y verificada."
        : `Faltaron ${faltantes} archivo(s) por copiar. Revisa el espacio de la memoria y vuelve a intentar.`,
      destino,
      base,
      archivos,
    });
    await fs.writeFile(path.join(destino, "estado.json"), JSON.stringify(resultado, null, 2)).catch(() => undefined);
    return resultado;
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    const sinEspacio = /ENOSPC/i.test(detalle);
    return fin({
      ok: false,
      mensaje: sinEspacio ? "La memoria se llenó. Usa una con más espacio." : `La copia falló: ${detalle}`,
      destino,
    });
  }
}

// ---------------------------------------------------------------------------
// Prueba de restauración: lo que confirma que la copia sirve.

export type ResultadoPrueba = {
  ok: boolean;
  mensaje: string;
  archivoBase?: string;
  integridad?: string;
  conteosCopia?: ConteosBase;
  conteosVivos?: ConteosBase;
  muestraArchivos?: { revisados: number; iguales: number; distintos: string[] };
};

export async function probarRestauracion(): Promise<ResultadoPrueba> {
  const ruta = await getRutaExterna();
  if (!ruta) return { ok: false, mensaje: "No hay una unidad elegida para la copia." };
  const destino = path.join(ruta, NOMBRE_CARPETA_EXTERNA);
  let bases: string[];
  try {
    bases = (await fs.readdir(path.join(destino, "base"))).filter((n) => /^pagasa-.*\.db$/.test(n)).sort().reverse();
  } catch {
    return { ok: false, mensaje: `No se encontró la copia en ${destino}. ¿Está conectada la memoria?` };
  }
  if (bases.length === 0) return { ok: false, mensaje: "Todavía no hay ninguna copia de la base en la memoria." };

  const archivoBase = bases[0];
  const verificacion = await verificarCopia(path.join(destino, "base", archivoBase));
  const conteosVivos = await conteosDeLaBaseViva();

  // Muestra de archivos: se comparan byte por byte (sha256) 25 al azar.
  const origen = await listarArchivos(UPLOADS_DIR);
  const muestra = [...origen].sort(() => Math.random() - 0.5).slice(0, 25);
  const distintos: string[] = [];
  for (const archivo of muestra) {
    try {
      const [a, b] = await Promise.all([
        hashArchivo(path.join(UPLOADS_DIR, archivo.rel)),
        hashArchivo(path.join(destino, "uploads", archivo.rel)),
      ]);
      if (a !== b) distintos.push(archivo.rel);
    } catch {
      distintos.push(archivo.rel);
    }
  }

  // La copia puede tener MENOS registros que la base viva (se capturó algo
  // después), nunca más: eso indicaría que se borró algo.
  const conMas = (Object.keys(conteosVivos) as (keyof ConteosBase)[]).filter(
    (k) => verificacion.conteos[k] > conteosVivos[k]
  );
  const ok = verificacion.integridad === "ok" && distintos.length === 0;
  let mensaje = ok
    ? `La copia ${archivoBase} abre bien y está completa: se puede restaurar.`
    : verificacion.integridad !== "ok"
      ? `La copia ${archivoBase} está dañada (${verificacion.integridad}).`
      : `${distintos.length} archivo(s) de la muestra no coinciden con el sistema. Haz una copia nueva.`;
  if (ok && conMas.length > 0) {
    mensaje += ` Ojo: la copia tiene más registros que el sistema en: ${conMas.join(", ")} (se borró algo después de la copia).`;
  }
  return {
    ok,
    mensaje,
    archivoBase,
    integridad: verificacion.integridad,
    conteosCopia: verificacion.conteos,
    conteosVivos,
    muestraArchivos: { revisados: muestra.length, iguales: muestra.length - distintos.length, distintos: distintos.slice(0, 10) },
  };
}

// ---------------------------------------------------------------------------
// Programación

export function horasDesde(fechaIso: string | null | undefined): number {
  if (!fechaIso) return Infinity;
  return (Date.now() - new Date(fechaIso).getTime()) / (60 * 60 * 1000);
}

async function tocaCopiar(): Promise<boolean> {
  if (!(await getRutaExterna())) return false;
  const estado = await getEstadoExterno();
  return horasDesde(estado.ultimoExito?.fecha) >= HORAS_ENTRE_COPIAS;
}

// Se llama una vez al arrancar (instrumentation.ts). Revisa cada hora: si hay
// unidad elegida y la última copia buena tiene más de HORAS_ENTRE_COPIAS,
// copia. Así, si la memoria estaba desconectada, se copia en cuanto vuelva.
export function scheduleRespaldoExterno(): void {
  if (g.__respaldoExternoAgendado) return;
  g.__respaldoExternoAgendado = true;
  const revisar = async () => {
    try {
      if (await tocaCopiar()) {
        const r = await copiarAExterno();
        if (!r.ok) console.error("[respaldo externo]", r.mensaje);
      }
    } catch (error) {
      console.error("[respaldo externo] Falló la revisión:", error);
    }
  };
  // La primera a los 2 minutos, para no competir con el arranque ni con el
  // respaldo local.
  setTimeout(revisar, 2 * 60 * 1000);
  setInterval(revisar, REVISAR_CADA_MS);
}
