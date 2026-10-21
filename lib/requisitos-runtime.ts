import { prisma } from "./prisma";
import { PLAZOS_BASE, fijarPlazos, plazosActivos, type Plazos } from "./plazos";
import { REQUISITOS_BASE, plazoBaseDe, type RequisitoVigente } from "./requisitos-normativos";

// El catálogo de requisitos normativos es el del código
// (lib/requisitos-normativos.ts) MÁS lo que el ADMIN ajustó desde /admin/normas
// (tabla requisitos_normativos_ajustes). Un campo sin ajuste usa el valor base.
//
// Los formularios y paneles deben leerlo con estas funciones, no importando
// REQUISITOS_BASE directo, o los cambios del ADMIN no se verían.
export async function getRequisitos(): Promise<RequisitoVigente[]> {
  const ajustes = new Map((await prisma.requisitoNormativoAjuste.findMany()).map((a) => [a.clave, a]));
  return REQUISITOS_BASE.map((base) => {
    const a = ajustes.get(base.clave);
    const plazoBase = plazoBaseDe(base);
    return {
      ...base,
      norma: a?.norma ?? base.norma,
      numeral: a?.numeral ?? base.numeral,
      cita: a?.cita ?? base.cita,
      verificado: a?.verificado ?? base.verificado,
      plazoBase,
      plazoAnios: base.plazoClave ? (a?.plazoAnios ?? plazoBase) : null,
      ajustado: Boolean(a),
      actualizadoPor: a?.actualizadoPor ?? null,
      actualizadoEl: a?.updatedAt ?? null,
    };
  });
}

export async function getRequisito(clave: string): Promise<RequisitoVigente | null> {
  return (await getRequisitos()).find((r) => r.clave === clave) ?? null;
}

// Los plazos que usan las alertas, ya con los ajustes del ADMIN.
export async function cargarPlazos(): Promise<Plazos> {
  const plazos: Plazos = { ...PLAZOS_BASE };
  for (const r of await getRequisitos()) {
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
