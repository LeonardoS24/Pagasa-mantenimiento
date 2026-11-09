import { prisma } from "./prisma";
import { PLAZOS_BASE, fijarPlazos, plazosActivos, type Plazos } from "./plazos";
import { z } from "zod";
import {
  NORMAS_VIGENTES,
  REQUISITOS_BASE,
  plazoBaseDe,
  type NormaVigente,
  type RequisitoVigente,
} from "./requisitos-normativos";

// El catálogo de requisitos normativos es el del código
// (lib/requisitos-normativos.ts) MÁS lo que el ADMIN ajustó desde /admin/normas
// (tabla requisitos_normativos_ajustes). Un campo sin ajuste usa el valor base.
//
// Los formularios y paneles deben leerlo con estas funciones, no importando
// REQUISITOS_BASE directo, o los cambios del ADMIN no se verían.
//
// Además: los que el ADMIN agregó (tabla requisitos_propios, clave "p-<id>") y
// los de fábrica que quitó (`oculto`), que no salen salvo con
// `incluirQuitados` (el panel los lista aparte para poder reponerlos).
export async function getRequisitos(opciones: { incluirQuitados?: boolean } = {}): Promise<RequisitoVigente[]> {
  const ajustes = new Map((await prisma.requisitoNormativoAjuste.findMany()).map((a) => [a.clave, a]));
  const deFabrica: RequisitoVigente[] = REQUISITOS_BASE.map((base) => {
    const a = ajustes.get(base.clave);
    const plazoBase = plazoBaseDe(base);
    return {
      ...base,
      nombre: a?.nombre ?? base.nombre,
      aplicaA: a?.aplicaA ?? base.aplicaA,
      cuentaDesde: a?.cuentaDesde ?? base.cuentaDesde,
      nota: a?.nota ?? base.nota,
      norma: a?.norma ?? base.norma,
      numeral: a?.numeral ?? base.numeral,
      cita: a?.cita ?? base.cita,
      verificado: a?.verificado ?? base.verificado,
      propio: false,
      oculto: a?.oculto ?? false,
      plazoBase,
      plazoAnios: base.plazoClave ? (a?.plazoAnios ?? plazoBase) : null,
      ajustado: Boolean(a) && !(a?.oculto && soloOculto(a)),
      actualizadoPor: a?.actualizadoPor ?? null,
      actualizadoEl: a?.updatedAt ?? null,
    };
  });
  const propios: RequisitoVigente[] = (await prisma.requisitoPropio.findMany({ orderBy: { createdAt: "asc" } })).map((p) => ({
    clave: `p-${p.id}`,
    nombre: p.nombre,
    aplicaA: p.aplicaA,
    norma: p.norma,
    numeral: p.numeral,
    cita: p.cita,
    cuentaDesde: p.cuentaDesde,
    nota: p.nota ?? undefined,
    verificado: p.verificado,
    propio: true,
    oculto: false,
    plazoBase: null,
    plazoAnios: p.plazoAnios,
    ajustado: false,
    actualizadoPor: p.actualizadoPor ?? p.creadoPor,
    actualizadoEl: p.updatedAt,
  }));
  const todos = [...deFabrica, ...propios];
  return opciones.incluirQuitados ? todos : todos.filter((r) => !r.oculto);
}

// Un ajuste que solo marca «quitado» (sin otros cambios) no cuenta como
// «Ajustado» al reponerlo.
function soloOculto(a: { plazoAnios: number | null; norma: string | null; numeral: string | null; cita: string | null; verificado: boolean | null; nombre: string | null; aplicaA: string | null; cuentaDesde: string | null; nota: string | null }) {
  return [a.plazoAnios, a.norma, a.numeral, a.cita, a.verificado, a.nombre, a.aplicaA, a.cuentaDesde, a.nota].every((v) => v === null);
}

// ── Normas que rigen cada área ───────────────────────────────────────────
// El ADMIN las edita, agrega y quita en /admin/normas (por ejemplo, cuando
// sale la norma definitiva que sustituye a una de emergencia). Mientras nadie
// las toca se usan las del código (NORMAS_VIGENTES); en cuanto se guarda un
// cambio, la lista completa queda en AjusteSistema («normasVigentes», JSON).
export const CLAVE_NORMAS_VIGENTES = "normasVigentes";

const normaVigenteSchema = z.object({
  clave: z.string().min(1).max(60),
  area: z.string().min(1).max(200),
  norma: z.string().min(1).max(150),
  detalle: z.string().max(2000),
  vigenteHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function leerNormasVigentes(texto: string | null | undefined): NormaVigente[] | null {
  if (!texto) return null;
  try {
    const parsed = z.array(normaVigenteSchema).safeParse(JSON.parse(texto));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getNormasVigentes(): Promise<NormaVigente[]> {
  const fila = await prisma.ajusteSistema.findUnique({ where: { clave: CLAVE_NORMAS_VIGENTES } });
  return leerNormasVigentes(fila?.valor) ?? NORMAS_VIGENTES;
}

export async function getRequisito(clave: string): Promise<RequisitoVigente | null> {
  return (await getRequisitos()).find((r) => r.clave === clave) ?? null;
}

// Los plazos que usan las alertas, ya con los ajustes del ADMIN.
export async function cargarPlazos(): Promise<Plazos> {
  const plazos: Plazos = { ...PLAZOS_BASE };
  // Con los quitados: quitar un requisito del catálogo no cambia su plazo.
  for (const r of await getRequisitos({ incluirQuitados: true })) {
    if (r.plazoClave && r.plazoAnios) plazos[r.plazoClave] = r.plazoAnios;
  }
  fijarPlazos(plazos);
  (globalThis as Record<string, unknown>).__pagasaPlazosCargadosEl = Date.now();
  return plazos;
}

const VIGENCIA_MS = 60 * 1000;

// Para llamar al inicio de lo que calcula alertas en el servidor: recarga los
// plazos si hace más de un minuto que no se leen. Cuando el ADMIN guarda un
// cambio se recargan al instante (ver guardarRequisito); esto solo cubre el
// arranque del servidor y cualquier cambio hecho por otro medio.
export async function asegurarPlazos(): Promise<Plazos> {
  const cargadosEl = (globalThis as Record<string, unknown>).__pagasaPlazosCargadosEl as number | undefined;
  if (cargadosEl && Date.now() - cargadosEl < VIGENCIA_MS) return plazosActivos();
  try {
    return await cargarPlazos();
  } catch (error) {
    // Si la base no responde, las alertas siguen con los últimos plazos que
    // se conocían (o los base) en vez de romper la página.
    console.error("No se pudieron cargar los plazos normativos:", error);
    return plazosActivos();
  }
}
