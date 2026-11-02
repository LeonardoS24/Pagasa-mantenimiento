import { prisma } from "./prisma";
import { logActivity } from "./activity-log";
import type { UsuarioSesion } from "./session";
import {
  CIUDADES_ALMACEN,
  HOJA_INVENTARIO,
  HOJA_MOVIMIENTOS,
  diffInventario,
  diffMovimientos,
  etiquetasDeUnidades,
  huellaDeLectura,
  leerInventario,
  leerMovimientos,
  normalizar,
  parsearCsv,
  type DifArticulo,
  type DifMovimiento,
  type LecturaHoja,
} from "./almacen";

// Parte con base de datos y red del inventario de almacén (lo puro está en
// lib/almacen.ts). La hoja se lee SOLA, pero nada entra al inventario hasta
// que una persona aprueba los cambios con su contraseña (aplicarPendiente).

const MAX_BYTES = 5 * 1024 * 1024;

// Solo se acepta un enlace de Google Sheets y la dirección que se consulta se
// arma aquí con el id: el servidor nunca visita una URL que escriba un usuario.
export function idDeHoja(url: string): string | null {
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url.trim());
  return m ? m[1] : null;
}

async function csvDe(id: string, pestana: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(pestana)}`;
  const res = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  // 401/403 o una redirección a la página de inicio de sesión: la hoja es privada.
  if ((res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403) {
    throw new Error("La hoja no es pública. En Google Sheets: Compartir → «Cualquier persona con el enlace» → Lector.");
  }
  if (res.status === 404) throw new Error("No se encontró la hoja de Google: revisa que el enlace sea el de tu hoja de inventario.");
  if (!res.ok) throw new Error(`Google respondió ${res.status} al leer la pestaña «${pestana}».`);
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error(`La pestaña «${pestana}» pesa demasiado (más de 5 MB).`);
  const texto = new TextDecoder("utf-8").decode(buffer);
  if (/^\s*</.test(texto) || /^\s*\/\*O_o\*\//.test(texto)) {
    throw new Error(`No se pudo leer la pestaña «${pestana}»: revisa que exista con ese nombre y que la hoja sea pública.`);
  }
  return parsearCsv(texto);
}

export async function leerHojaDeGoogle(urlHoja: string): Promise<LecturaHoja> {
  const id = idDeHoja(urlHoja);
  if (!id) throw new Error("El enlace no es de una hoja de Google Sheets.");
  const [filasInventario, filasMovimientos] = await Promise.all([csvDe(id, HOJA_INVENTARIO), csvDe(id, HOJA_MOVIMIENTOS)]);
  const inv = leerInventario(filasInventario);
  const mov = leerMovimientos(filasMovimientos);
  return { articulos: inv.articulos, movimientos: mov.movimientos, avisos: [...inv.avisos, ...mov.avisos], leidaEl: new Date().toISOString() };
}

// ── Unidades, estaciones y plantas del sistema (lista desplegable) ────────

export async function unidadesDelSistema(): Promise<{ id: string; etiqueta: string }[]> {
  const registros = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { city: { slug: { not: "administracion" } } } },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { name: true, order: true, city: { select: { name: true, slug: true, order: true } } } },
    },
  });
  const orden = (slug: string) => (CIUDADES_ALMACEN.includes(slug) ? -1 : 0);
  registros.sort(
    (a, b) =>
      orden(a.section.city.slug) - orden(b.section.city.slug) ||
      a.section.city.order - b.section.city.order ||
      a.section.order - b.section.order ||
      a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true })
  );
  return etiquetasDeUnidades(
    registros.map((r) => ({ id: r.id, nombre: r.numeroEconomico, apartado: r.section.name, ciudad: r.section.city.name }))
  );
}

async function mapaDeUnidades(): Promise<Map<string, string>> {
  return new Map((await unidadesDelSistema()).map((u) => [normalizar(u.etiqueta), u.id]));
}

// ── Qué cambia respecto a lo guardado ────────────────────────────────────

export type DifAlmacen = {
  articulos: DifArticulo[];
  movimientos: DifMovimiento[];
  movimientosAusentes: number;
  unidadesSinVincular: string[];
};

export function hayCambios(d: DifAlmacen): boolean {
  return d.articulos.length > 0 || d.movimientos.length > 0;
}

async function calcularDif(cityId: string, lectura: LecturaHoja): Promise<DifAlmacen> {
  const [articulos, movimientos, mapa] = await Promise.all([
    prisma.almacenArticulo.findMany({ where: { cityId } }),
    prisma.almacenMovimiento.findMany({ where: { cityId } }),
    mapaDeUnidades(),
  ]);
  const difArticulos = diffInventario(
    articulos.map((a) => ({ ...a, codigo: a.codigo, categoria: a.categoria, marca: a.marca, unidad: a.unidad, ubicacion: a.ubicacion, prestadoA: a.prestadoA, notas: a.notas })),
    lectura.articulos
  );
  const difMovimientos = diffMovimientos(
    movimientos.map((m) => ({ huella: m.huella, repeticion: m.repeticion, paraQue: m.paraQue, notas: m.notas, articulo: m.articulo, fechaTexto: m.fechaTexto, fecha: m.fecha?.toISOString().slice(0, 10) ?? null })),
    lectura.movimientos
  );
  const sinVincular = Array.from(
    new Set(difMovimientos.cambios.filter((c) => c.tipo === "nuevo" && c.movimiento.unidad && !mapa.has(normalizar(c.movimiento.unidad))).map((c) => c.movimiento.unidad!))
  );
  return { articulos: difArticulos, movimientos: difMovimientos.cambios, movimientosAusentes: difMovimientos.ausentes, unidadesSinVincular: sinVincular };
}

// ── Leer la hoja y dejar los cambios por aprobar ─────────────────────────

export type ResultadoRevision = { ok: boolean; error?: string; hayCambios?: boolean };

export async function revisarHoja(cityId: string): Promise<ResultadoRevision> {
  const config = await prisma.almacenConfig.findUnique({ where: { cityId } });
  if (!config?.urlHoja) return { ok: false, error: "Falta el enlace de la hoja de Google." };
  let lectura: LecturaHoja;
  try {
    lectura = await leerHojaDeGoogle(config.urlHoja);
  } catch (e) {
    const error = e instanceof Error ? e.message : "No se pudo leer la hoja.";
    await prisma.almacenConfig.update({ where: { cityId }, data: { ultimaLectura: new Date(), ultimoError: error } });
    return { ok: false, error };
  }
  const huella = huellaDeLectura(lectura);
  const dif = await calcularDif(cityId, lectura);
  if (!hayCambios(dif)) {
    await prisma.almacenConfig.update({
      where: { cityId },
      data: { ultimaLectura: new Date(), ultimoError: null, pendiente: null, pendienteHuella: null, pendienteEl: null },
    });
    return { ok: true, hayCambios: false };
  }
  // Misma lectura que ya se avisó (o que se descartó): no se vuelve a abrir.
  if (huella === config.pendienteHuella) {
    await prisma.almacenConfig.update({ where: { cityId }, data: { ultimaLectura: new Date(), ultimoError: null } });
    return { ok: true, hayCambios: config.pendiente !== null };
  }
  await prisma.almacenConfig.update({
    where: { cityId },
    data: { ultimaLectura: new Date(), ultimoError: null, pendiente: JSON.stringify(lectura), pendienteHuella: huella, pendienteEl: new Date() },
  });
  return { ok: true, hayCambios: true };
}

export async function descartarPendiente(cityId: string): Promise<void> {
  // La huella se conserva a propósito: la misma lectura no vuelve a salir hasta
  // que la hoja cambie.
  await prisma.almacenConfig.update({ where: { cityId }, data: { pendiente: null, pendienteEl: null } });
}

function leerPendiente(json: string | null): LecturaHoja | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as LecturaHoja;
    if (!Array.isArray(d.articulos) || !Array.isArray(d.movimientos)) return null;
    return d;
  } catch {
    return null;
  }
}

export async function pendienteDeCiudad(cityId: string): Promise<{ lectura: LecturaHoja; dif: DifAlmacen } | null> {
  const config = await prisma.almacenConfig.findUnique({ where: { cityId } });
  const lectura = leerPendiente(config?.pendiente ?? null);
  if (!lectura) return null;
  const dif = await calcularDif(cityId, lectura);
  // Si entre tanto alguien dejó el sistema igual a la lectura, ya no hay nada.
  return hayCambios(dif) ? { lectura, dif } : null;
}

// ── Aprobar: guardar lo leído ────────────────────────────────────────────

export type ResultadoAplicar = { ok: boolean; error?: string; articulos?: number; movimientos?: number };

export async function aplicarPendiente(cityId: string, citySlug: string, user: UsuarioSesion): Promise<ResultadoAplicar> {
  const pendiente = await pendienteDeCiudad(cityId);
  if (!pendiente) return { ok: false, error: "No hay cambios por aprobar (puede que ya se hayan aplicado)." };
  const { lectura, dif } = pendiente;
  const mapa = await mapaDeUnidades();
  const articuloDe = new Map(lectura.articulos.map((a) => [a.clave, a]));

  // NADA se borra: lo que ya no aparece se marca inactivo, los movimientos
  // solo se agregan o corrigen su «para qué» y sus notas.
  await prisma.$transaction(async (tx) => {
    for (const d of dif.articulos) {
      if (d.tipo === "ausente") {
        await tx.almacenArticulo.update({ where: { cityId_clave: { cityId, clave: d.clave } }, data: { activo: false } });
        continue;
      }
      const a = articuloDe.get(d.clave);
      if (!a) continue;
      const datos = {
        codigo: a.codigo,
        articulo: a.articulo,
        categoria: a.categoria,
        marca: a.marca,
        unidad: a.unidad,
        ubicacion: a.ubicacion,
        cantidad: a.cantidad,
        disponibles: a.disponibles,
        prestadoA: a.prestadoA,
        notas: a.notas,
        activo: true,
      };
      if (d.tipo === "nuevo") await tx.almacenArticulo.create({ data: { cityId, clave: d.clave, ...datos } });
      else await tx.almacenArticulo.update({ where: { cityId_clave: { cityId, clave: d.clave } }, data: datos });
    }
    for (const d of dif.movimientos) {
      const m = d.movimiento;
      if (d.tipo === "nuevo") {
        await tx.almacenMovimiento.create({
          data: {
            cityId,
            huella: m.huella,
            repeticion: m.repeticion,
            fecha: m.fecha ? new Date(m.fecha) : null,
            fechaTexto: m.fechaTexto,
            movimiento: m.movimiento,
            articulo: m.articulo,
            cantidad: m.cantidad,
            trabajador: m.trabajador,
            paraQue: m.paraQue,
            notas: m.notas,
            unidad: m.unidad,
            vehicleRecordId: m.unidad ? (mapa.get(normalizar(m.unidad)) ?? null) : null,
          },
        });
      } else {
        await tx.almacenMovimiento.update({
          where: { cityId_huella_repeticion: { cityId, huella: m.huella, repeticion: m.repeticion } },
          data: { paraQue: m.paraQue, notas: m.notas },
        });
      }
    }
    await tx.almacenConfig.update({ where: { cityId }, data: { pendiente: null, pendienteEl: null } });
  });

  const nuevos = dif.articulos.filter((d) => d.tipo === "nuevo").length;
  const cambios = dif.articulos.filter((d) => d.tipo === "cambio" || d.tipo === "reactivar").length;
  const ausentes = dif.articulos.filter((d) => d.tipo === "ausente").length;
  const movNuevos = dif.movimientos.filter((d) => d.tipo === "nuevo").length;
  await logActivity({
    user,
    accion: "EDITAR",
    entidad: "Inventario de almacén (hoja de Google)",
    resumen: `${dif.articulos.length} artículo(s), ${dif.movimientos.length} movimiento(s)`,
    detalle: `Artículos: ${nuevos} nuevos, ${cambios} con cambios, ${ausentes} que ya no aparecen (marcados inactivos). Movimientos: ${movNuevos} nuevos, ${dif.movimientos.length - movNuevos} corregidos.`,
    citySlug,
  });
  return { ok: true, articulos: dif.articulos.length, movimientos: dif.movimientos.length };
}

// ── Lectura automática ───────────────────────────────────────────────────

const REVISAR_CADA_MS = 30 * 60 * 1000;

async function revisarTodas(): Promise<void> {
  try {
    const configs = await prisma.almacenConfig.findMany({
      where: { urlHoja: { not: null }, city: { slug: { in: CIUDADES_ALMACEN } } },
      select: { cityId: true },
    });
    for (const c of configs) await revisarHoja(c.cityId);
  } catch (error) {
    console.error("No se pudo revisar la hoja del almacén:", error);
  }
}

// Se llama una sola vez al arrancar el servidor (ver instrumentation.ts).
export function scheduleAlmacen(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.__pagasaAlmacenAgendado) return;
  g.__pagasaAlmacenAgendado = true;
  setTimeout(() => void revisarTodas(), 90_000);
  setInterval(() => void revisarTodas(), REVISAR_CADA_MS);
}
