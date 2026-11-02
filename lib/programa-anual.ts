import { prisma } from "./prisma";
import { getVencimientos, nombreTipoVencimiento, type TipoVencimiento } from "./vencimientos";
import { DICTAMENES } from "./dictamen-alerts";

// Programa anual de mantenimiento e inspecciones (página
// /ciudades/[ciudad]/programa-anual): por unidad y actividad, en qué mes del
// año toca (P = programado, pendiente) y en qué mes se hizo (R = realizado).
//
// P sale de los vencimientos (las mismas fechas que las alertas). Cuando algo
// se registra, su vencimiento se mueve al siguiente ciclo y la P desaparece
// de ese año: en su lugar queda la R del mes en que se hizo.

export type Marca = "P" | "R";

export type FilaPrograma = {
  clave: string;
  vehicleId: string;
  numeroEconomico: string;
  cityName: string;
  citySlug: string;
  sectionName: string;
  actividad: string;
  detalle?: string;
  meses: Marca[][]; // 12 meses, cada uno con sus marcas
};

export type Atrasado = {
  vehicleId: string;
  numeroEconomico: string;
  cityName: string;
  citySlug: string;
  actividad: string;
  detalle?: string;
  vencio: Date;
};

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Qué distingue dos renglones del mismo tipo en una unidad (dos dictámenes
// distintos, la manguera y el conector, los tanques de una estación, los
// instrumentos de planta). El nombre de la válvula más antigua NO distingue:
// es la misma actividad "cambio de válvulas".
function detalleDeFila(tipo: TipoVencimiento, detalle: string | undefined, slug: string): string {
  if (!detalle) return "";
  if (tipo === "dictamen") return detalle;
  if (tipo === "mangueras") return /conector/i.test(detalle) ? "Conector flexible" : "";
  if (tipo === "valvulas") return slug === "planta-ficha-tecnica" ? detalle : /^Tanque \d/.test(detalle) ? detalle.split(" · ")[0] : "";
  return /^Tanque \d/.test(detalle) ? detalle : "";
}

export async function getProgramaAnual(cityIds: string[], anio: number, apartado?: string) {
  const inicio = new Date(Date.UTC(anio, 0, 1));
  const fin = new Date(Date.UTC(anio + 1, 0, 1));
  const unidades = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds }, ...(apartado ? { slug: apartado } : {}) } },
    include: { section: { include: { city: true } }, technicalSheet: true },
    orderBy: [{ section: { city: { order: "asc" } } }, { section: { order: "asc" } }, { numeroEconomico: "asc" }],
  });
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const filas = new Map<string, FilaPrograma>();
  const atrasados: Atrasado[] = [];

  const marcar = (vehicleId: string, tipo: TipoVencimiento, detalle: string, mes: number, marca: Marca, actividad?: string) => {
    const u = porId.get(vehicleId);
    if (!u) return;
    const clave = `${vehicleId}|${tipo}|${detalle}`;
    let fila = filas.get(clave);
    if (!fila) {
      fila = {
        clave,
        vehicleId,
        numeroEconomico: u.numeroEconomico,
        cityName: u.section.city.name,
        citySlug: u.section.city.slug,
        sectionName: u.section.name,
        actividad: actividad ?? (tipo === "dictamen" && detalle ? detalle : nombreTipoVencimiento(tipo)),
        detalle: tipo === "dictamen" ? undefined : detalle || undefined,
        meses: Array.from({ length: 12 }, () => []),
      };
      filas.set(clave, fila);
    }
    if (!fila.meses[mes].includes(marca)) fila.meses[mes].push(marca);
  };

  // P: lo que vence en el año.
  const hoy = new Date();
  for (const v of await getVencimientos(cityIds)) {
    if (!porId.has(v.vehicleId)) continue;
    const detalle = detalleDeFila(v.tipo, v.detalle, v.sectionSlug);
    if (v.fecha >= inicio && v.fecha < fin) {
      marcar(v.vehicleId, v.tipo, detalle, v.fecha.getUTCMonth(), "P");
    } else if (v.fecha < inicio && anio === hoy.getFullYear()) {
      const u = porId.get(v.vehicleId)!;
      atrasados.push({
        vehicleId: v.vehicleId,
        numeroEconomico: u.numeroEconomico,
        cityName: u.section.city.name,
        citySlug: u.section.city.slug,
        actividad: v.tipo === "dictamen" && v.detalle ? v.detalle : nombreTipoVencimiento(v.tipo),
        detalle: v.tipo === "dictamen" ? undefined : detalle || undefined,
        vencio: v.fecha,
      });
    }
  }

  // R: lo que se registró como hecho en el año.
  const ids = unidades.map((u) => u.id);
  const enAnio = { gte: inicio, lt: fin };
  const donde = (campo: string) => ({ vehicleRecordId: { in: ids }, [campo]: enAnio });
  const [us, ve, he, vi, hi, va, ma, po, mt] = await Promise.all([
    prisma.ultrasoundLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.visualInspectionLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.tightnessTestLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.internalVisualInspectionLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.hydrostaticTestLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.valveChangeLog.findMany({ where: donde("fechaInstalacion"), select: { vehicleRecordId: true, fechaInstalacion: true } }),
    prisma.hoseChangeLog.findMany({ where: donde("fechaInstalacion"), select: { vehicleRecordId: true, fechaInstalacion: true } }),
    prisma.insurancePolicyLog.findMany({ where: donde("fechaRealizacion"), select: { vehicleRecordId: true, fechaRealizacion: true } }),
    prisma.maintenanceLog.findMany({ where: donde("fecha"), select: { vehicleRecordId: true, fecha: true } }),
  ]);
  const r = (lista: { vehicleRecordId: string; f: Date | null }[], tipo: TipoVencimiento) => {
    for (const x of lista) if (x.f) marcar(x.vehicleRecordId, tipo, "", x.f.getUTCMonth(), "R");
  };
  r(us.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "ultrasonido");
  r(ve.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "visualExterna");
  r(he.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "hermeticidad");
  r(vi.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "visualInterna");
  r(hi.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "hidrostatica");
  r(va.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaInstalacion })), "valvulas");
  r(ma.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaInstalacion })), "mangueras");
  r(po.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fechaRealizacion })), "poliza");
  r(mt.map((x) => ({ vehicleRecordId: x.vehicleRecordId, f: x.fecha })), "mantenimiento");
  // Dictámenes: la fecha de emisión capturada en la ficha.
  for (const u of unidades) {
    for (const d of DICTAMENES) {
      const emision = u.technicalSheet?.[d.campo] ?? null;
      if (d.apartados.includes(u.section.slug) && emision && emision >= inicio && emision < fin) {
        marcar(u.id, "dictamen", d.nombre, emision.getUTCMonth(), "R");
      }
    }
  }

  const orden = new Map(unidades.map((u, i) => [u.id, i]));
  const lista = [...filas.values()].sort(
    (a, b) => (orden.get(a.vehicleId) ?? 0) - (orden.get(b.vehicleId) ?? 0) || a.actividad.localeCompare(b.actividad, "es")
  );
  atrasados.sort((a, b) => a.vencio.getTime() - b.vencio.getTime());
  const totales = MESES.map((_, m) => ({
    programados: lista.filter((f) => f.meses[m].includes("P")).length,
    realizados: lista.filter((f) => f.meses[m].includes("R")).length,
  }));
  return { filas: lista, atrasados, totales };
}
