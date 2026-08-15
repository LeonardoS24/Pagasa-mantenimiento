import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { formatDate } from "./dates";
import {
  calidadMantenimientoLabels,
  combustibleLabels,
  calidadExtintorLabels,
  vehicleEstatusLabels,
  type CalidadMantenimiento,
  type Combustible,
  type CalidadExtintor,
  type VehicleEstatus,
} from "./vehicle-enums";
import { STATION_VALVE_FIELDS, stationValveLabels, getStationValveVencimiento } from "./station-valves";
import type {
  VehicleRecord,
  VehicleTechnicalSheet,
  StationTankTechnicalSheet,
} from "@prisma/client";

type VehicleWithSheet = VehicleRecord & { technicalSheet: VehicleTechnicalSheet | null };

function d(value: Date | null): string {
  return value ? formatDate(value) : "";
}
function t(value: string | null | undefined): string {
  return value ?? "";
}
function n(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

// Columnas comunes a las 4 hojas: identidad de la unidad, estatus y el
// bloque "Automóvil" + "Chofer y póliza" de la ficha técnica (ver
// TechnicalSheetView.tsx, mismo agrupamiento que se ve en pantalla).
function baseColumns(v: VehicleWithSheet, useDeliveryFormat: boolean) {
  const s = v.technicalSheet;
  // Mismas 3 columnas de peso siempre presentes (no un shape distinto por
  // tipo de unidad): así todas las hojas comparten exactamente la misma
  // forma de fila, solo cambia cuál de las tres trae dato.
  const pesoColumns = {
    Peso: useDeliveryFormat ? "" : t(s?.peso),
    "Peso bruto vacío": useDeliveryFormat ? t(s?.pesoBrutoVacio) : "",
    "Peso bruto máximo": useDeliveryFormat ? t(s?.pesoBrutoMaximo) : "",
  };
  return {
    "Número económico": v.numeroEconomico,
    Estado: v.activo ? "Activo" : "Dado de baja",
    "Fecha de baja": d(v.fechaBaja),
    "Motivo de baja": t(v.motivoBaja),
    "Calidad de la unidad": v.calidad
      ? (calidadMantenimientoLabels[v.calidad as CalidadMantenimiento] ?? v.calidad)
      : "",
    // Estatus operativo (Operativa / En taller / Fuera de servicio), distinto
    // de "Estado" de arriba, que es si sigue dada de alta.
    Estatus: vehicleEstatusLabels[v.estatus as VehicleEstatus] ?? v.estatus,
    "Marca (datos generales)": v.sucursal,
    Año: t(v.anio),
    Placas: t(v.placas),
    Observaciones: t(v.observaciones),
    "Marca (ficha técnica)": t(s?.marca),
    Línea: t(s?.linea),
    Modelo: t(s?.modelo),
    ...pesoColumns,
    Serie: t(s?.serie),
    Combustible: s?.combustible ? (combustibleLabels[s.combustible as Combustible] ?? s.combustible) : "",
    "Características especiales": t(s?.caracteristicas),
    "Horas de uso diario": t(s?.horasUsoDiario),
    "Fecha de adquisición": d(s?.fechaAdquisicion ?? null),
    Chofer: t(s?.chofer),
    "Número de póliza": t(s?.numeroPoliza),
    Inciso: t(s?.inciso),
  };
}

function tanqueColumns(v: VehicleWithSheet, label: string) {
  const s = v.technicalSheet;
  return {
    [`${label} — Número de serie`]: t(s?.numeroSerieTanque),
    [`${label} — Capacidad`]: t(s?.capacidadTanque),
    [`${label} — Marca`]: t(s?.marcaTanque),
    [`${label} — Año de fabricación`]: t(s?.anioFabricacionTanque),
    [`${label} — Fecha de fabricación`]: d(s?.fechaFabricacionTanque ?? null),
  };
}

function extintorColumns(v: VehicleWithSheet) {
  const s = v.technicalSheet;
  return {
    "Extintor — Fecha de instalación": d(s?.fechaInstalacionExtintor ?? null),
    "Extintor — Fecha de vencimiento": d(s?.fechaVencimientoExtintor ?? null),
    "Extintor — Calidad": s?.calidadExtintor
      ? (calidadExtintorLabels[s.calidadExtintor as CalidadExtintor] ?? s.calidadExtintor)
      : "",
  };
}

function mantenimientoColumns(v: VehicleWithSheet) {
  const s = v.technicalSheet;
  return {
    "Mant. preventivo — Kilometraje último": n(s?.kilometrajeUltimoMantenimiento),
    "Mant. preventivo — Fecha último": d(s?.fechaUltimoMantenimiento ?? null),
    "Mant. preventivo — Kilometraje próximo": n(s?.kilometrajeProximoMantenimiento),
    "Mant. preventivo — Fecha próxima": d(s?.fechaProximoMantenimiento ?? null),
  };
}

// Juego completo de 9 válvulas (Auto-Tanques). Vehículo con tanque de
// carburación solo usa 4 de estas (llenado/máximo llenado/servicio/alivio,
// con otros nombres de campo, ver lib/valve-alerts.ts), pero se exportan con
// su nombre canónico para no tener dos esquemas de columnas distintos.
function valvulasColumns(v: VehicleWithSheet) {
  const s = v.technicalSheet;
  return {
    "Válvulas — Fecha de instalación del juego": d(s?.fechaInstalacionValvulas ?? null),
    "Válvula de llenado — Fecha de fabricación": d(s?.fechaFabricacionValvulaLlenado ?? null),
    "Válvula de no retroceso — Fecha de fabricación": d(s?.fechaFabricacionValvulaNoRetroceso ?? null),
    "Válvula de bypass — Fecha de fabricación": d(s?.fechaFabricacionValvulaBypass ?? null),
    "Válvula de retorno de vapores — Fecha de fabricación": d(s?.fechaFabricacionValvulaRetornoVapores ?? null),
    "Válvula de servicio — Fecha de fabricación": d(s?.fechaFabricacionValvulaServicio ?? null),
    "Válvula de máximo llenado 90% — Fecha de fabricación": d(s?.fechaFabricacionValvulaMaximoLlenado ?? null),
    "¿Tiene válvula de máximo llenado 85%?": s?.tieneValvulaMaximoLlenado85 ? "Sí" : "No",
    "Válvula de máximo llenado 85% — Fecha de fabricación": d(s?.fechaFabricacionValvulaMaximoLlenado85 ?? null),
    "Válvula de alivio (seguridad) — Fecha de fabricación": d(s?.fechaFabricacionValvulaAlivio ?? null),
    "Válvula de descarga de emergencia — Fecha de fabricación": d(s?.fechaFabricacionValvulaDescargaEmergencia ?? null),
  };
}

function manguerasColumns(v: VehicleWithSheet) {
  const s = v.technicalSheet;
  return {
    "Mangueras — Fecha de instalación": d(s?.fechaInstalacionMangueras ?? null),
    "Mangueras — Fecha de fabricación": d(s?.fechaFabricacionManguera ?? null),
  };
}

function inspeccionesColumns(v: VehicleWithSheet) {
  const s = v.technicalSheet;
  return {
    "Visual externa — Número": t(s?.numeroUltimaInspeccionVisual),
    "Visual externa — Última fecha": d(s?.ultimaInspeccionVisual ?? null),
    "Visual externa — Próxima fecha": d(s?.fechaProximaInspeccionVisual ?? null),
    "Hermeticidad — Número": t(s?.numeroUltimaPruebaHermeticidad),
    "Hermeticidad — Última fecha": d(s?.ultimaPruebaHermeticidad ?? null),
    "Hermeticidad — Próxima fecha": d(s?.fechaProximaPruebaHermeticidad ?? null),
    "Visual interna — Número": t(s?.numeroUltimaInspeccionVisualInterna),
    "Visual interna — Última fecha": d(s?.ultimaInspeccionVisualInterna ?? null),
    "Visual interna — Próxima fecha": d(s?.fechaProximaInspeccionVisualInterna ?? null),
    "Ultrasonido — Número": t(s?.numeroUltimoUltrasonido),
    "Ultrasonido — Última fecha": d(s?.ultimoUltrasonido ?? null),
    "Ultrasonido — Próxima fecha": d(s?.fechaProximoUltrasonido ?? null),
    "Hidrostática — Número": t(s?.numeroUltimaPruebaHidrostatica),
    "Hidrostática — Última fecha": d(s?.ultimaPruebaHidrostatica ?? null),
    "Hidrostática — Próxima fecha": d(s?.fechaProximaPruebaHidrostatica ?? null),
  };
}

// Una fila por unidad, con exactamente las columnas que esa unidad usa en
// pantalla (mismo criterio que TechnicalSheetView: qué secciones mostrar
// según el apartado), para no llenar cada hoja de columnas que nunca aplican
// ahí.
function rowsForSection(sectionSlug: string, vehicles: VehicleWithSheet[]): Record<string, string>[] {
  switch (sectionSlug) {
    case "auto-tanques":
      return vehicles.map((v) => ({
        ...baseColumns(v, false),
        ...tanqueColumns(v, "Tanque"),
        ...valvulasColumns(v),
        ...inspeccionesColumns(v),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
      }));
    case "vehiculo-de-reparto":
      return vehicles.map((v) => ({
        ...baseColumns(v, true),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
      }));
    case "vehiculo-con-tanque-de-carburacion":
      return vehicles.map((v) => ({
        ...baseColumns(v, true),
        ...tanqueColumns(v, "Tanque de carburación"),
        ...valvulasColumns(v),
        ...manguerasColumns(v),
        ...inspeccionesColumns(v),
      }));
    case "unidades-utilitarias":
      return vehicles.map((v) => ({
        ...baseColumns(v, false),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
      }));
    default:
      return vehicles.map((v) => baseColumns(v, false));
  }
}

const SUBSECCIONES: { slug: string; nombreHoja: string }[] = [
  { slug: "auto-tanques", nombreHoja: "Auto-Tanques" },
  { slug: "vehiculo-de-reparto", nombreHoja: "Vehículo de reparto" },
  { slug: "vehiculo-con-tanque-de-carburacion", nombreHoja: "Vehículo con tanque de carburación" },
  { slug: "unidades-utilitarias", nombreHoja: "Unidades utilitarias" },
];

// Unidad de mentira, solo para sacar los encabezados de columna de una hoja
// que no tiene ninguna unidad todavía (ciudad nueva o apartado vacío).
const EMPTY_VEHICLE: VehicleWithSheet = {
  id: "",
  order: 0,
  sectionId: "",
  numeroEconomico: "",
  sucursal: "",
  anio: null,
  placas: null,
  observaciones: null,
  permisionaria: null,
  permiso: null,
  activo: true,
  fechaBaja: null,
  motivoBaja: null,
  calidad: null,
  estatus: "OPERATIVA",
  createdById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  technicalSheet: null,
};

// Nombre de hoja válido para Excel: máximo 31 caracteres, sin : \ / ? * [ ].
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

// Estaciones de carburación y Planta: instalaciones fijas, con su propia
// ficha del tanque y su propio juego de válvulas (ver lib/station-valves.ts).
const APARTADOS_ESTACION: { slug: string; nombreHoja: string }[] = [
  { slug: "estaciones-de-carburacion", nombreHoja: "Estaciones de carburación" },
  { slug: "planta-ficha-tecnica", nombreHoja: "Planta" },
];

type StationRecord = VehicleRecord & {
  stationTankTechnicalSheet: StationTankTechnicalSheet | null;
  technicalSheet: VehicleTechnicalSheet | null;
};

const EMPTY_STATION: StationRecord = {
  ...EMPTY_VEHICLE,
  stationTankTechnicalSheet: null,
};

function stationRow(r: StationRecord) {
  const tanque = r.stationTankTechnicalSheet;
  const s = r.technicalSheet;
  const vencimientoValvulas = tanque ? getStationValveVencimiento(tanque) : null;

  return {
    Nombre: r.numeroEconomico,
    Estado: r.activo ? "Activo" : "Dado de baja",
    "Fecha de baja": d(r.fechaBaja),
    "Motivo de baja": t(r.motivoBaja),
    "Calidad de la unidad": r.calidad
      ? (calidadMantenimientoLabels[r.calidad as CalidadMantenimiento] ?? r.calidad)
      : "",
    Estatus: vehicleEstatusLabels[r.estatus as VehicleEstatus] ?? r.estatus,
    Permisionaria: t(r.permisionaria),
    Permiso: t(r.permiso),
    Dirección: r.sucursal,
    // Ficha técnica del tanque
    "Tanque — Número de serie": t(tanque?.numeroSerie),
    "Tanque — Marca": t(tanque?.marca),
    "Tanque — Modelo": t(tanque?.modelo),
    "Tanque — Tipo": t(tanque?.tipo),
    "Tanque — Año de fabricación": t(tanque?.anioFabricacion),
    "Tanque — Fecha de fabricación": d(tanque?.fechaFabricacion ?? null),
    "Tanque — Capacidad (lts)": t(tanque?.capacidad),
    "Tanque — Presión de diseño": t(tanque?.presionDiseno),
    "Tanque — Longitud total": t(tanque?.longitudTotal),
    "Tanque — Forma de la cabeza": t(tanque?.formaCabeza),
    "Tanque — Espesor nominal del cuerpo": t(tanque?.espesorNominalCuerpo),
    "Tanque — Espesor nominal de la cabeza": t(tanque?.espesorNominalCabeza),
    "Tanque — Material del cuerpo": t(tanque?.materialCuerpo),
    "Tanque — Material cabeza": t(tanque?.materialCabeza),
    "Tanque — Diámetro interior": t(tanque?.diametroInterior),
    "Tanque — Tara": t(tanque?.tara),
    // Válvulas del tanque fijo
    "Válvulas — Fecha de instalación del juego": d(tanque?.fechaInstalacionValvulas ?? null),
    ...Object.fromEntries(
      STATION_VALVE_FIELDS.map((campo) => [
        `Válvulas — ${stationValveLabels[campo]}`,
        d(tanque?.[campo] ?? null),
      ])
    ),
    "Válvulas — Próximo cambio": d(vencimientoValvulas),
    // Las 5 inspecciones periódicas siguen viviendo en la ficha del vehículo.
    "Último ultrasonido": d(s?.ultimoUltrasonido ?? null),
    "Próximo ultrasonido": d(s?.fechaProximoUltrasonido ?? null),
    "Última inspección visual externa": d(s?.ultimaInspeccionVisual ?? null),
    "Próxima inspección visual externa": d(s?.fechaProximaInspeccionVisual ?? null),
    "Última prueba de hermeticidad": d(s?.ultimaPruebaHermeticidad ?? null),
    "Próxima prueba de hermeticidad": d(s?.fechaProximaPruebaHermeticidad ?? null),
    "Última inspección visual interna": d(s?.ultimaInspeccionVisualInterna ?? null),
    "Próxima inspección visual interna": d(s?.fechaProximaInspeccionVisualInterna ?? null),
    "Última prueba hidrostática": d(s?.ultimaPruebaHidrostatica ?? null),
    "Próxima prueba hidrostática": d(s?.fechaProximaPruebaHidrostatica ?? null),
  };
}

// Arma el libro con una hoja por cada sub-apartado de "Unidad de
// distribución" de la ciudad (Auto-Tanques, Vehículo de reparto, Vehículo
// con tanque de carburación, Unidades utilitarias), cada unidad con toda su
// ficha técnica y su calidad/estado. Ciudades nuevas sin unidades en algún
// apartado simplemente traen esa hoja vacía (solo encabezados).
export async function buildCityFleetWorkbook(citySlug: string): Promise<{ buffer: Buffer; cityName: string }> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error("Ciudad no encontrada");

  const unidadDistribucion = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" },
  });

  const workbook = XLSX.utils.book_new();

  for (const { slug, nombreHoja } of SUBSECCIONES) {
    const vehicles = unidadDistribucion
      ? await prisma.vehicleRecord.findMany({
          where: { section: { slug, parentId: unidadDistribucion.id } },
          include: { technicalSheet: true },
          orderBy: [{ activo: "desc" }, { numeroEconomico: "asc" }],
        })
      : [];

    const rows = rowsForSection(slug, vehicles);
    // Aunque no haya unidades todavía, la hoja trae sus encabezados (se
    // arman a partir de una unidad de mentira con ficha técnica vacía, para
    // no duplicar la lista de columnas en otro lugar).
    const headerRow = rows[0] ?? rowsForSection(slug, [EMPTY_VEHICLE])[0];
    const worksheet =
      rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([Object.keys(headerRow)]);
    // Ancho fijo razonable: encabezados largos ("Válvula de descarga de
    // emergencia — Fecha de fabricación") si no, se ven amontonados por
    // default en 8 caracteres.
    worksheet["!cols"] = Array.from({ length: Object.keys(headerRow).length }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(nombreHoja));
  }

  // Estaciones de carburación y Planta: no son vehículos, así que van en sus
  // propias hojas con el vocabulario de un recipiente fijo (ver
  // StationTankTechnicalSheet) más sus válvulas, en vez de las columnas de
  // motor/chofer/placas que no aplican.
  for (const { slug, nombreHoja } of APARTADOS_ESTACION) {
    const registros = await prisma.vehicleRecord.findMany({
      where: { section: { slug, cityId: city.id } },
      include: { stationTankTechnicalSheet: true, technicalSheet: true },
      orderBy: [{ activo: "desc" }, { numeroEconomico: "asc" }],
    });

    const rows = registros.map((r) => stationRow(r));
    const headerRow = rows[0] ?? stationRow(EMPTY_STATION);
    const worksheet =
      rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([Object.keys(headerRow)]);
    worksheet["!cols"] = Array.from({ length: Object.keys(headerRow).length }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(nombreHoja));
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, cityName: city.name };
}
