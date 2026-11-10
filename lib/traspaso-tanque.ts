import type { Prisma, VehicleTechnicalSheet } from "@prisma/client";
import { prisma } from "./prisma";
import { esTanqueDeCarga } from "./kino-sections";
import { isAggregateCitySlug } from "./aggregate-city";

// Pasar el tanque de una unidad dada de baja a otra unidad (pedido del usuario
// el 9-nov-2026): el camión se da de baja, pero su tanque se instala en otro
// vehículo y sigue trabajando. Acción en actions/traspaso-tanque-actions.ts.
//
// - Los DATOS del tanque (placa, válvulas, mangueras del tanque y las fechas
//   de las 5 pruebas) se copian a la unidad nueva para que sus alertas sigan,
//   y se quitan de la de baja para que el mismo tanque no aparezca en dos
//   lados. La foto de cómo estaban queda en TraspasoTanque.datos.
// - Los REGISTROS de pruebas y válvulas del tanque (con sus documentos y
//   vistos buenos) se van con el tanque: el usuario eligió eso. Nada se borra.
// - Se quedan en la unidad de baja: mantenimientos, extintor, póliza (el
//   usuario lo pidió así), chofer, automóvil y dictámenes de la unidad.

// Grupo de tanque: solo se pasa entre unidades del mismo tipo.
export type GrupoTanque = "carga" | "carburacion";

export function grupoDeTanque(sectionSlug: string): GrupoTanque | null {
  if (esTanqueDeCarga(sectionSlug)) return "carga";
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") return "carburacion";
  return null;
}

// Campos de la ficha que son del tanque.
export const CAMPOS_TANQUE = [
  // Placa del tanque
  "capacidadTanque",
  "marcaTanque",
  "anioFabricacionTanque",
  "fechaFabricacionTanque",
  "numeroSerieTanque",
  "placaPresionMaximaTrabajo",
  "placaTemperaturaDiseno",
  "placaCabezales",
  "placaDiametroExterior",
  "placaLongitudTotal",
  "placaEspesorMinPlacaCuerpo",
  "placaMaterialCuerpo",
  "placaEspesorMinPlacaCabeza",
  "placaMaterialCabeza",
  "placaNormaFabricacion",
  "placaDT",
  "placaNumeroSeriePropietario",
  "placaCapacidadPorcentaje",
  "placaCapacidadKg",
  "placaTara",
  "placaRayosXCuerpo",
  "placaRelevo",
  "placaRayosXCabeza",
  "placaPresionDiseno",
  "placaFechaPruebaOriginal",
  "placaPresionMaximaVapor",
  "placaContenido",
  // Certificado de fabricación del recipiente (semirremolques)
  "fabricadoPara",
  "ordenTrabajo",
  "factorSeguridad",
  "sobreespesorCorrosion",
  "soldadura",
  "relevadoEsfuerzos",
  "pruebasFabricacion",
  "presionPruebaHidrostatica",
  "resultadoPruebas",
  // Las 5 pruebas
  "numeroUltimoUltrasonido",
  "ultimoUltrasonido",
  "fechaProximoUltrasonido",
  "numeroUltimaInspeccionVisual",
  "ultimaInspeccionVisual",
  "fechaProximaInspeccionVisual",
  "numeroUltimaPruebaHermeticidad",
  "ultimaPruebaHermeticidad",
  "fechaProximaPruebaHermeticidad",
  "numeroUltimaInspeccionVisualInterna",
  "ultimaInspeccionVisualInterna",
  "fechaProximaInspeccionVisualInterna",
  "numeroUltimaPruebaHidrostatica",
  "ultimaPruebaHidrostatica",
  "fechaProximaPruebaHidrostatica",
  // Válvulas, manómetro, conector, acoplamiento y mangueras del tanque
  "fechaInstalacionValvulas",
  "fechaFabricacionValvulaLlenado",
  "fechaFabricacionValvulaNoRetroceso",
  "fechaFabricacionValvulaBypass",
  "fechaFabricacionValvulaRetornoVapores",
  "fechaFabricacionValvulaServicio",
  "fechaFabricacionValvulaMaximoLlenado",
  "tieneValvulaMaximoLlenado85",
  "fechaFabricacionValvulaMaximoLlenado85",
  "fechaFabricacionValvulaAlivio",
  "fechaFabricacionValvulaDescargaEmergencia",
  "fechaFabricacionValvulaExcesoFlujo",
  "fechaFabricacionValvulaCheckLock",
  "fechaFabricacionValvulaInterna",
  "codigoValvulaLlenado",
  "codigoValvulaNoRetroceso",
  "codigoValvulaBypass",
  "codigoValvulaRetornoVapores",
  "codigoValvulaServicio",
  "codigoValvulaMaximoLlenado",
  "codigoValvulaMaximoLlenado85",
  "codigoValvulaAlivio",
  "codigoValvulaDescargaEmergencia",
  "codigoValvulaExcesoFlujo",
  "codigoValvulaCheckLock",
  "codigoValvulaInterna",
  "fechaFabricacionManometro",
  "codigoManometro",
  "fechaFabricacionMangueraSurtir",
  "medidaMangueraSurtir",
  "fechaFabricacionConectorFlexible",
  "tieneConectorFlexible",
  "fechaFabricacionAcoplamientoSeco",
  "codigoAcoplamientoSeco",
  "tieneAcoplamientoSeco",
  "fechaInstalacionMangueras",
  "fechaFabricacionManguera",
] as const satisfies readonly (keyof VehicleTechnicalSheet)[];

type CampoTanque = (typeof CAMPOS_TANQUE)[number];
type DatosTanque = Partial<Pick<VehicleTechnicalSheet, CampoTanque>>;

// Bitácoras que son del tanque (se van con él). La entidad es la del visto
// bueno (lib/visto-bueno-tipos.ts).
export const BITACORAS_TANQUE = [
  { clave: "ultrasonido", nombre: "Ultrasonido" },
  { clave: "visualExterna", nombre: "Inspección visual externa" },
  { clave: "hermeticidad", nombre: "Prueba de hermeticidad" },
  { clave: "visualInterna", nombre: "Inspección visual interna" },
  { clave: "hidrostatica", nombre: "Prueba hidrostática" },
  { clave: "valvulas", nombre: "Cambio de válvulas" },
  { clave: "valvulasCorrectivo", nombre: "Correctivo de válvulas" },
  { clave: "mangueras", nombre: "Cambio de manguera" },
] as const;

export type ConteoRegistros = Record<(typeof BITACORAS_TANQUE)[number]["clave"], number>;

// Lo que toca a cada bitácora en Prisma (mismo orden que BITACORAS_TANQUE).
function delegados(tx: Prisma.TransactionClient) {
  return {
    ultrasonido: tx.ultrasoundLog,
    visualExterna: tx.visualInspectionLog,
    hermeticidad: tx.tightnessTestLog,
    visualInterna: tx.internalVisualInspectionLog,
    hidrostatica: tx.hydrostaticTestLog,
    valvulas: tx.valveChangeLog,
    valvulasCorrectivo: tx.valveCorrectiveMaintenanceLog,
    mangueras: tx.hoseChangeLog,
  } as const;
}

const RELACION_DOCUMENTO: Record<keyof ConteoRegistros, keyof Prisma.DocumentWhereInput> = {
  ultrasonido: "ultrasoundLogId",
  visualExterna: "visualInspectionLogId",
  hermeticidad: "tightnessTestLogId",
  visualInterna: "internalVisualInspectionLogId",
  hidrostatica: "hydrostaticTestLogId",
  valvulas: "valveChangeLogId",
  valvulasCorrectivo: "valveCorrectiveMaintenanceLogId",
  mangueras: "hoseChangeLogId",
};

// Lo que hay del tanque en una ficha (para saber si una unidad "tiene tanque").
export function datosDelTanque(sheet: Partial<VehicleTechnicalSheet> | null | undefined): DatosTanque {
  const datos: DatosTanque = {};
  if (!sheet) return datos;
  for (const campo of CAMPOS_TANQUE) {
    const valor = sheet[campo];
    if (valor === null || valor === undefined || valor === false || valor === "") continue;
    (datos as Record<string, unknown>)[campo] = valor;
  }
  return datos;
}

// Valores para dejar la ficha de la unidad de baja sin tanque.
function fichaSinTanque(): Record<CampoTanque, null | false> {
  const vacia = {} as Record<CampoTanque, null | false>;
  for (const campo of CAMPOS_TANQUE) vacia[campo] = campo.startsWith("tiene") ? false : null;
  return vacia;
}

async function contarRegistros(vehicleId: string): Promise<ConteoRegistros> {
  const d = delegados(prisma);
  const conteo = {} as ConteoRegistros;
  for (const b of BITACORAS_TANQUE) {
    conteo[b.clave] = await (d[b.clave] as { count: (a: object) => Promise<number> }).count({
      where: { vehicleRecordId: vehicleId },
    });
  }
  return conteo;
}

const totalDe = (c: ConteoRegistros) => Object.values(c).reduce((s, n) => s + n, 0);

type Unidad = Prisma.VehicleRecordGetPayload<{ include: { technicalSheet: true; section: { include: { city: true } } } }>;

async function cargar(id: string): Promise<Unidad | null> {
  return prisma.vehicleRecord.findUnique({
    where: { id },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });
}

// Por qué esta unidad no puede dar su tanque (null = sí puede).
function bloqueoDeOrigen(origen: Unidad, registros: number): string | null {
  if (!grupoDeTanque(origen.section.slug)) return "Este tipo de unidad no lleva tanque que se pueda pasar.";
  if (origen.activo) return "Primero da de baja la unidad; después su tanque se puede pasar a otra.";
  if (Object.keys(datosDelTanque(origen.technicalSheet)).length === 0 && registros === 0) {
    return "Esta unidad ya no tiene datos de tanque (puede que ya se haya pasado a otra).";
  }
  return null;
}

// Por qué el tanque no puede ir a esta unidad (null = sí puede).
async function bloqueoDeDestino(origen: Unidad, destino: Unidad): Promise<string | null> {
  if (destino.id === origen.id) return "Elige otra unidad.";
  if (!destino.activo) return `${destino.numeroEconomico} está dada de baja.`;
  if (isAggregateCitySlug(destino.section.city.slug)) return "Elige una unidad de una ciudad real.";
  if (grupoDeTanque(destino.section.slug) !== grupoDeTanque(origen.section.slug)) {
    return `${destino.numeroEconomico} es de otro tipo de unidad (${destino.section.name}).`;
  }
  const serie = destino.technicalSheet?.numeroSerieTanque;
  if (serie || destino.technicalSheet?.fechaFabricacionTanque) {
    return `${destino.numeroEconomico} ya tiene tanque capturado${serie ? ` (serie ${serie})` : ""}. Si de verdad es la unidad nueva, borra antes esos datos de su ficha.`;
  }
  if (totalDe(await contarRegistros(destino.id)) > 0) {
    return `${destino.numeroEconomico} ya tiene registros de pruebas o válvulas de su propio tanque.`;
  }
  return null;
}

export type OpcionesTraspasoTanque = {
  bloqueo: string | null;
  serie: string | null;
  registros: ConteoRegistros | null;
  destinos: { id: string; etiqueta: string }[];
};

// Para el formulario de la unidad de baja: a qué unidades puede ir su tanque
// (mismo tipo, activas, sin tanque propio, en las ciudades del usuario).
export async function getOpcionesTraspasoTanque(origenId: string, cityIds: string[]): Promise<OpcionesTraspasoTanque> {
  const origen = await cargar(origenId);
  if (!origen) return { bloqueo: "La unidad ya no existe.", serie: null, registros: null, destinos: [] };
  const registros = await contarRegistros(origen.id);
  const bloqueo = bloqueoDeOrigen(origen, totalDe(registros));
  const base = { serie: origen.technicalSheet?.numeroSerieTanque ?? null, registros };
  if (bloqueo) return { bloqueo, ...base, destinos: [] };

  const grupo = grupoDeTanque(origen.section.slug);
  const slugs = grupo === "carga" ? ["auto-tanques", "semirremolques"] : ["vehiculo-con-tanque-de-carburacion"];
  const candidatos = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      id: { not: origen.id },
      section: { slug: { in: slugs }, cityId: { in: cityIds } },
      OR: [{ technicalSheet: null }, { technicalSheet: { numeroSerieTanque: null, fechaFabricacionTanque: null } }],
    },
    include: { section: { include: { city: true } } },
    orderBy: [{ section: { city: { order: "asc" } } }, { numeroEconomico: "asc" }],
  });
  // Primero las de la misma ciudad (lo más común).
  candidatos.sort((a, b) => Number(b.section.cityId === origen.section.cityId) - Number(a.section.cityId === origen.section.cityId));
  const destinos: { id: string; etiqueta: string }[] = [];
  for (const c of candidatos) {
    if (isAggregateCitySlug(c.section.city.slug)) continue;
    if (totalDe(await contarRegistros(c.id)) > 0) continue;
    destinos.push({ id: c.id, etiqueta: `${c.numeroEconomico} · ${c.section.name} · ${c.section.city.name}` });
  }
  return {
    bloqueo: destinos.length === 0 ? "No hay ninguna unidad activa del mismo tipo sin tanque capturado. Da de alta primero la unidad nueva." : null,
    ...base,
    destinos,
  };
}

export type ResultadoTraspasoTanque =
  | { error: string }
  | {
      ok: true;
      origen: { numero: string; citySlug: string };
      destino: { id: string; numero: string; citySlug: string; cityName: string };
      serie: string | null;
      registros: ConteoRegistros;
    };

export async function pasarTanque(params: {
  origenId: string;
  destinoId: string;
  motivo: string | null;
  userId: string;
  username: string;
}): Promise<ResultadoTraspasoTanque> {
  const [origen, destino] = await Promise.all([cargar(params.origenId), cargar(params.destinoId)]);
  if (!origen) return { error: "La unidad ya no existe." };
  if (!destino) return { error: "La unidad a la que va el tanque ya no existe." };
  const registrosAntes = await contarRegistros(origen.id);
  const bloqueo = bloqueoDeOrigen(origen, totalDe(registrosAntes)) ?? (await bloqueoDeDestino(origen, destino));
  if (bloqueo) return { error: bloqueo };

  const datos = datosDelTanque(origen.technicalSheet);
  const registros = {} as ConteoRegistros;

  await prisma.$transaction(async (tx) => {
    // 1. Datos del tanque: a la unidad nueva, y fuera de la de baja.
    await tx.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: destino.id },
      update: datos,
      create: { vehicleRecordId: destino.id, ...datos },
    });
    if (origen.technicalSheet) {
      await tx.vehicleTechnicalSheet.update({ where: { vehicleRecordId: origen.id }, data: fichaSinTanque() as Prisma.VehicleTechnicalSheetUncheckedUpdateInput });
    }

    // 2. Registros del tanque, sus documentos y sus vistos buenos.
    const d = delegados(tx);
    for (const b of BITACORAS_TANQUE) {
      const delegado = d[b.clave] as unknown as {
        findMany: (a: object) => Promise<{ id: string }[]>;
        updateMany: (a: object) => Promise<{ count: number }>;
      };
      const ids = (await delegado.findMany({ where: { vehicleRecordId: origen.id }, select: { id: true } })).map((r) => r.id);
      registros[b.clave] = ids.length;
      if (ids.length === 0) continue;
      await delegado.updateMany({ where: { id: { in: ids } }, data: { vehicleRecordId: destino.id } });
      // "Documentos de pruebas" filtra por el apartado del documento; los
      // archivos en disco van por id de bitácora y no se tocan.
      await tx.document.updateMany({
        where: { [RELACION_DOCUMENTO[b.clave]]: { in: ids } },
        data: { sectionId: destino.sectionId },
      });
      await tx.vistoBueno.updateMany({
        where: { entidad: b.clave, registroId: { in: ids } },
        data: { vehicleRecordId: destino.id },
      });
    }

    // 3. Constancia en las dos unidades.
    await tx.traspasoTanque.create({
      data: {
        origenId: origen.id,
        destinoId: destino.id,
        origenNumero: origen.numeroEconomico,
        origenCiudadNombre: origen.section.city.name,
        destinoNumero: destino.numeroEconomico,
        destinoCiudadNombre: destino.section.city.name,
        numeroSerieTanque: origen.technicalSheet?.numeroSerieTanque ?? null,
        datos: JSON.stringify(datos),
        registros: JSON.stringify(registros),
        motivo: params.motivo,
        userId: params.userId,
        username: params.username,
      },
    });
  });

  return {
    ok: true,
    origen: { numero: origen.numeroEconomico, citySlug: origen.section.city.slug },
    destino: {
      id: destino.id,
      numero: destino.numeroEconomico,
      citySlug: destino.section.city.slug,
      cityName: destino.section.city.name,
    },
    serie: origen.technicalSheet?.numeroSerieTanque ?? null,
    registros,
  };
}

// Texto corto de cuántos registros se movieron: "3 ultrasonidos, 1 cambio de
// válvulas..." (solo los que tienen alguno).
export function resumenRegistros(registros: Partial<ConteoRegistros>): string {
  const partes = BITACORAS_TANQUE.filter((b) => (registros[b.clave] ?? 0) > 0).map(
    (b) => `${b.nombre.toLowerCase()}: ${registros[b.clave]}`
  );
  return partes.length > 0 ? partes.join(", ") : "sin registros de pruebas ni válvulas";
}
