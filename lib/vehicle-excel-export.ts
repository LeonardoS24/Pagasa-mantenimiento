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
import {
  STATION_VALVE_FIELDS,
  stationValveLabels,
  getStationValveVencimiento,
  cantidadValvulasSeguridad,
} from "./station-valves";
import { getAllRealCityIds } from "./aggregate-city";
import { getCustomFields } from "./custom-fields-runtime";
import type { CustomFieldDef } from "./custom-fields";
import { complianceItemsFor, compliancePercentage, complianceAmbitoDe, type ComplianceAmbito } from "./compliance-checklist";
import type {
  VehicleRecord,
  VehicleTechnicalSheet,
  StationTankTechnicalSheet,
  InsurancePolicyLog,
} from "@prisma/client";

// Qué parte de la flota exportar: "todo" arma un libro con las 6 hojas de
// siempre (4 sub-apartados de unidades + Estaciones + Planta); los otros 3
// valores acotan el libro a solo ese grupo, para descargas más chicas y
// enfocadas (ver ExcelDownloadForm.tsx).
export type ExcelAmbito = "todo" | "unidades" | "estaciones" | "planta";

type VehicleWithSheet = VehicleRecord & {
  technicalSheet: VehicleTechnicalSheet | null;
  section: { city: { name: string } };
  // Campos extra + cumplimiento normativo + póliza, ya armados como columnas
  // antes de entrar a rowsForSection (ver buildFleetWorkbook), para no
  // tener que pasar campos/ámbito hasta el fondo de cada función de fila.
  extraColumns?: Record<string, string>;
};

function d(value: Date | null): string {
  return value ? formatDate(value) : "";
}
function t(value: string | null | undefined): string {
  return value ?? "";
}
function n(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

// Los recuadros extra que un ADMIN agregó desde /admin/campos (ver
// lib/custom-fields.ts), incluidos los de tipo "Listado para selección":
// una columna por campo definido, con lo que se haya elegido/escrito en
// cada unidad. Siempre trae las mismas columnas (aunque estén vacías), para
// que los encabezados no cambien fila por fila.
function customFieldColumns(
  campos: CustomFieldDef[],
  valores: Record<string, string> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const campo of campos) {
    out[`Extra — ${campo.etiqueta}`] = valores?.[campo.id] ?? "";
  }
  return out;
}

// El checklist de cumplimiento de normatividad (ver lib/compliance-checklist.ts):
// el porcentaje y una columna "Sí"/"No" por cada documento de la lista fija
// de ese ámbito. Se usa el listado completo (con activo=false, que incluye
// el ítem extra de baja) para que las columnas salgan iguales en toda la
// hoja aunque unas unidades estén activas y otras no; en las que no aplica
// el ítem de baja, esa columna sale en blanco en vez de "No".
function complianceColumns(
  ambito: ComplianceAmbito,
  activo: boolean,
  filas: { clave: string; cumple: boolean }[]
): Record<string, string> {
  const itemsQueAplican = complianceItemsFor(ambito, activo);
  const porcentaje = compliancePercentage(itemsQueAplican, filas);
  const todosLosItems = complianceItemsFor(ambito, false);
  const out: Record<string, string> = { "Cumplimiento normativo — %": `${porcentaje}%` };
  for (const item of todosLosItems) {
    const aplica = itemsQueAplican.some((i) => i.clave === item.clave);
    out[`Cumple — ${item.nombre}`] = !aplica ? "" : filas.find((f) => f.clave === item.clave)?.cumple ? "Sí" : "No";
  }
  return out;
}

// Póliza de seguro vigente (ver lib/insurance-alerts.ts: la vigente es la de
// vencimiento más lejano, no la última capturada). Solo aplica a unidades
// reales, no a Estaciones ni Planta (instalaciones fijas sin seguro propio).
function polizaColumns(vigente?: Pick<InsurancePolicyLog, "aseguradora" | "numeroPoliza" | "fechaRealizacion" | "fechaVencimiento">): Record<string, string> {
  return {
    "Póliza — Aseguradora": t(vigente?.aseguradora ?? null),
    "Póliza — Número": t(vigente?.numeroPoliza ?? null),
    "Póliza — Fecha de realización": vigente ? d(vigente.fechaRealizacion) : "",
    "Póliza — Fecha de vencimiento": vigente ? d(vigente.fechaVencimiento) : "",
  };
}

// Trae de un solo jalón los valores de campos extra de un lote de
// registros, en vez de una consulta por cada uno.
async function customFieldValuesByVehicle(vehicleIds: string[]): Promise<Map<string, Record<string, string>>> {
  if (vehicleIds.length === 0) return new Map();
  const filas = await prisma.customFieldValue.findMany({
    where: { vehicleRecordId: { in: vehicleIds } },
  });
  const map = new Map<string, Record<string, string>>();
  for (const fila of filas) {
    const registro = map.get(fila.vehicleRecordId) ?? {};
    registro[fila.fieldId] = fila.valor;
    map.set(fila.vehicleRecordId, registro);
  }
  return map;
}

// Columnas comunes a las 4 hojas: identidad de la unidad, estatus y el
// bloque "Automóvil" + "Chofer y póliza" de la ficha técnica (ver
// TechnicalSheetView.tsx, mismo agrupamiento que se ve en pantalla).
// includeCityColumn solo se activa cuando el libro abarca más de una ciudad
// (ver buildAllCitiesFleetWorkbook) — en la descarga normal de una sola
// ciudad sería una columna repetida sin aportar nada.
function baseColumns(v: VehicleWithSheet, useDeliveryFormat: boolean, includeCityColumn: boolean) {
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
    ...(includeCityColumn ? { Ciudad: v.section.city.name } : {}),
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
function rowsForSection(
  sectionSlug: string,
  vehicles: VehicleWithSheet[],
  includeCityColumn: boolean
): Record<string, string>[] {
  switch (sectionSlug) {
    case "auto-tanques":
      return vehicles.map((v) => ({
        ...baseColumns(v, false, includeCityColumn),
        ...tanqueColumns(v, "Tanque"),
        ...valvulasColumns(v),
        ...inspeccionesColumns(v),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
        ...(v.extraColumns ?? {}),
      }));
    case "vehiculo-de-reparto":
      return vehicles.map((v) => ({
        ...baseColumns(v, true, includeCityColumn),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
        ...(v.extraColumns ?? {}),
      }));
    case "vehiculo-con-tanque-de-carburacion":
      return vehicles.map((v) => ({
        ...baseColumns(v, true, includeCityColumn),
        ...tanqueColumns(v, "Tanque de carburación"),
        ...valvulasColumns(v),
        ...manguerasColumns(v),
        ...inspeccionesColumns(v),
        ...(v.extraColumns ?? {}),
      }));
    case "unidades-utilitarias":
      return vehicles.map((v) => ({
        ...baseColumns(v, false, includeCityColumn),
        ...extintorColumns(v),
        ...mantenimientoColumns(v),
        ...(v.extraColumns ?? {}),
      }));
    default:
      return vehicles.map((v) => ({ ...baseColumns(v, false, includeCityColumn), ...(v.extraColumns ?? {}) }));
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
  section: { city: { name: "" } },
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
  stationTankTechnicalSheets: StationTankTechnicalSheet[];
  technicalSheet: VehicleTechnicalSheet | null;
  section: { city: { name: string } };
  // Campos extra + cumplimiento normativo (ver comentario en
  // VehicleWithSheet); una Estación/Planta no tiene póliza propia.
  extraColumns?: Record<string, string>;
};

const EMPTY_STATION: StationRecord = {
  ...EMPTY_VEHICLE,
  stationTankTechnicalSheets: [],
};

// Una fila por cada tanque de la estación (casi siempre uno solo, "Tanque
// 1"; algunas tienen dos — ver lib/station-valves.ts). tanque llega ya
// resuelto desde el llamador en vez de derivarse aquí, para poder generar
// una fila por cada uno sin repetir esta función.
function stationRow(r: StationRecord, tanque: StationTankTechnicalSheet | null, includeCityColumn: boolean) {
  const s = r.technicalSheet;
  const vencimientoValvulas = tanque ? getStationValveVencimiento(tanque) : null;
  // Con un solo tanque, las 5 pruebas periódicas viven en la ficha
  // compartida del registro; con varios, en este mismo tanque (mismo
  // criterio que isMultiTanque en la página de detalle del vehículo) — si
  // no se distingue, un registro multi-tanque como Planta Hermosillo sale
  // con estas columnas vacías aunque sí tenga datos capturados.
  const isMultiTanque = r.stationTankTechnicalSheets.length > 1;
  const ultimoUltrasonido = isMultiTanque ? tanque?.ultimoUltrasonido : s?.ultimoUltrasonido;
  const fechaProximoUltrasonido = isMultiTanque ? tanque?.fechaProximoUltrasonido : s?.fechaProximoUltrasonido;
  const ultimaInspeccionVisual = isMultiTanque ? tanque?.ultimaInspeccionVisual : s?.ultimaInspeccionVisual;
  const fechaProximaInspeccionVisual = isMultiTanque
    ? tanque?.fechaProximaInspeccionVisual
    : s?.fechaProximaInspeccionVisual;
  const ultimaPruebaHermeticidad = isMultiTanque ? tanque?.ultimaPruebaHermeticidad : s?.ultimaPruebaHermeticidad;
  const fechaProximaPruebaHermeticidad = isMultiTanque
    ? tanque?.fechaProximaPruebaHermeticidad
    : s?.fechaProximaPruebaHermeticidad;
  const ultimaInspeccionVisualInterna = isMultiTanque
    ? tanque?.ultimaInspeccionVisualInterna
    : s?.ultimaInspeccionVisualInterna;
  const fechaProximaInspeccionVisualInterna = isMultiTanque
    ? tanque?.fechaProximaInspeccionVisualInterna
    : s?.fechaProximaInspeccionVisualInterna;
  const ultimaPruebaHidrostatica = isMultiTanque ? tanque?.ultimaPruebaHidrostatica : s?.ultimaPruebaHidrostatica;
  const fechaProximaPruebaHidrostatica = isMultiTanque
    ? tanque?.fechaProximaPruebaHidrostatica
    : s?.fechaProximaPruebaHidrostatica;

  return {
    ...(includeCityColumn ? { Ciudad: r.section.city.name } : {}),
    Nombre: r.numeroEconomico,
    Tanque: tanque?.etiqueta ?? "Tanque 1",
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
    // Válvulas del tanque fijo. La de seguridad puede ser 1, 2 o 3 (ver
    // cantidadValvulasSeguridad en lib/station-valves.ts); las 3 columnas
    // siempre están presentes, vacías las que no apliquen.
    "Válvulas — Fecha de instalación del juego": d(tanque?.fechaInstalacionValvulas ?? null),
    ...Object.fromEntries(
      STATION_VALVE_FIELDS.filter((campo) => campo !== "fechaFabricacionValvulaSeguridad").map((campo) => [
        `Válvulas — ${stationValveLabels[campo]}`,
        d(tanque?.[campo] ?? null),
      ])
    ),
    "Válvulas — Cantidad de válvulas de seguridad": tanque ? String(cantidadValvulasSeguridad(tanque)) : "",
    "Válvulas — Válvula de seguridad 1": d(tanque?.fechaFabricacionValvulaSeguridad ?? null),
    "Válvulas — Válvula de seguridad 2": d(tanque?.fechaFabricacionValvulaSeguridad2 ?? null),
    "Válvulas — Válvula de seguridad 3": d(tanque?.fechaFabricacionValvulaSeguridad3 ?? null),
    "Válvulas — Próximo cambio": d(vencimientoValvulas),
    "Último ultrasonido": d(ultimoUltrasonido ?? null),
    "Próximo ultrasonido": d(fechaProximoUltrasonido ?? null),
    "Última inspección visual externa": d(ultimaInspeccionVisual ?? null),
    "Próxima inspección visual externa": d(fechaProximaInspeccionVisual ?? null),
    "Última prueba de hermeticidad": d(ultimaPruebaHermeticidad ?? null),
    "Próxima prueba de hermeticidad": d(fechaProximaPruebaHermeticidad ?? null),
    "Última inspección visual interna": d(ultimaInspeccionVisualInterna ?? null),
    "Próxima inspección visual interna": d(fechaProximaInspeccionVisualInterna ?? null),
    "Última prueba hidrostática": d(ultimaPruebaHidrostatica ?? null),
    "Próxima prueba hidrostática": d(fechaProximaPruebaHidrostatica ?? null),
    ...(r.extraColumns ?? {}),
  };
}

// Arma el libro para el conjunto de ciudades y el ámbito pedidos: "unidades"
// trae una hoja por cada sub-apartado de "Unidad de distribución" (Auto-
// Tanques, Vehículo de reparto, Vehículo con tanque de carburación, Unidades
// utilitarias); "estaciones" y "planta" traen su propia hoja; "todo" junta
// las 6. cityIds con más de un elemento (ver buildAllCitiesFleetWorkbook)
// agrega la columna "Ciudad" al frente de cada hoja para poder distinguir
// filas. Ciudades/apartados sin registros todavía simplemente traen la hoja
// vacía (solo encabezados), igual que antes.
async function buildFleetWorkbook(
  cityIds: string[],
  ambito: ExcelAmbito,
  includeCityColumn: boolean
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  if (ambito === "todo" || ambito === "unidades") {
    // Los recuadros extra son los mismos para las 4 hojas de unidades (todas
    // comparten el ámbito "VEHICULO" de /admin/campos): se traen una sola
    // vez en vez de repetir la consulta por hoja.
    const camposVehiculo = await getCustomFields("VEHICULO");
    const encabezadoVacioUnidad = {
      ...customFieldColumns(camposVehiculo, undefined),
      ...complianceColumns("UNIDAD", false, []),
      ...polizaColumns(undefined),
    };

    for (const { slug, nombreHoja } of SUBSECCIONES) {
      const vehicles = await prisma.vehicleRecord.findMany({
        where: { section: { slug, parent: { slug: "unidad-de-distribucion", cityId: { in: cityIds } } } },
        include: {
          technicalSheet: true,
          section: { include: { city: true } },
          complianceChecklistItems: { select: { clave: true, cumple: true } },
          insurancePolicyLogs: { orderBy: { fechaVencimiento: "desc" }, take: 1 },
        },
        orderBy: [{ activo: "desc" }, { numeroEconomico: "asc" }],
      });

      // Los campos extra viven en su propia tabla, sin relación directa en
      // este include: se traen aparte, de un jalón para todo el lote.
      const valoresPorVehiculo = await customFieldValuesByVehicle(vehicles.map((v) => v.id));
      const vehiclesConExtra: VehicleWithSheet[] = vehicles.map((v) => ({
        ...v,
        extraColumns: {
          ...customFieldColumns(camposVehiculo, valoresPorVehiculo.get(v.id)),
          ...complianceColumns("UNIDAD", v.activo, v.complianceChecklistItems),
          ...polizaColumns(v.insurancePolicyLogs[0]),
        },
      }));

      const rows = rowsForSection(slug, vehiclesConExtra, includeCityColumn);
      // Aunque no haya unidades todavía, la hoja trae sus encabezados (se
      // arman a partir de una unidad de mentira con ficha técnica vacía,
      // para no duplicar la lista de columnas en otro lugar) — incluye los
      // campos extra y el checklist aunque no haya ninguna fila real.
      const headerRow =
        rows[0] ??
        rowsForSection(slug, [{ ...EMPTY_VEHICLE, extraColumns: encabezadoVacioUnidad }], includeCityColumn)[0];
      const worksheet =
        rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([Object.keys(headerRow)]);
      // Ancho fijo razonable: encabezados largos ("Válvula de descarga de
      // emergencia — Fecha de fabricación") si no, se ven amontonados por
      // default en 8 caracteres.
      worksheet["!cols"] = Array.from({ length: Object.keys(headerRow).length }, () => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(nombreHoja));
    }
  }

  // Estaciones de carburación y Planta: no son vehículos, así que van en sus
  // propias hojas con el vocabulario de un recipiente fijo (ver
  // StationTankTechnicalSheet) más sus válvulas, en vez de las columnas de
  // motor/chofer/placas que no aplican.
  const apartadosEstacion = APARTADOS_ESTACION.filter(({ slug }) => {
    if (ambito === "todo") return true;
    if (ambito === "estaciones") return slug === "estaciones-de-carburacion";
    if (ambito === "planta") return slug === "planta-ficha-tecnica";
    return false;
  });
  if (apartadosEstacion.length > 0) {
    // Estaciones y Planta comparten el mismo ámbito "ESTACION" de
    // /admin/campos (ver CAMPO_AMBITOS en lib/custom-fields.ts).
    const camposEstacion = await getCustomFields("ESTACION");

    for (const { slug, nombreHoja } of apartadosEstacion) {
      const complianceAmbito = complianceAmbitoDe(slug);
      const encabezadoVacioEstacion = {
        ...customFieldColumns(camposEstacion, undefined),
        ...complianceColumns(complianceAmbito, false, []),
      };

      const registros = await prisma.vehicleRecord.findMany({
        where: { section: { slug, cityId: { in: cityIds } } },
        include: {
          stationTankTechnicalSheets: { orderBy: { etiqueta: "asc" } },
          technicalSheet: true,
          section: { include: { city: true } },
          complianceChecklistItems: { select: { clave: true, cumple: true } },
        },
        orderBy: [{ activo: "desc" }, { numeroEconomico: "asc" }],
      });

      const valoresPorRegistro = await customFieldValuesByVehicle(registros.map((r) => r.id));
      const registrosConExtra: StationRecord[] = registros.map((r) => ({
        ...r,
        extraColumns: {
          ...customFieldColumns(camposEstacion, valoresPorRegistro.get(r.id)),
          ...complianceColumns(complianceAmbito, r.activo, r.complianceChecklistItems),
        },
      }));

      const rows = registrosConExtra.flatMap((r) =>
        r.stationTankTechnicalSheets.length > 0
          ? r.stationTankTechnicalSheets.map((tanque) => stationRow(r, tanque, includeCityColumn))
          : [stationRow(r, null, includeCityColumn)]
      );
      const headerRow =
        rows[0] ?? stationRow({ ...EMPTY_STATION, extraColumns: encabezadoVacioEstacion }, null, includeCityColumn);
      const worksheet =
        rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([Object.keys(headerRow)]);
      worksheet["!cols"] = Array.from({ length: Object.keys(headerRow).length }, () => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(nombreHoja));
    }
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildCityFleetWorkbook(
  citySlug: string,
  ambito: ExcelAmbito = "todo"
): Promise<{ buffer: Buffer; cityName: string }> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error("Ciudad no encontrada");

  const buffer = await buildFleetWorkbook([city.id], ambito, false);
  return { buffer, cityName: city.name };
}

// Para Administración (ver lib/aggregate-city.ts): esa ciudad no tiene
// unidades ni estaciones propias, así que su descarga junta las de TODAS
// las ciudades reales en un solo libro, con la columna "Ciudad" al frente
// de cada hoja para poder distinguir de dónde viene cada fila.
export async function buildAllCitiesFleetWorkbook(
  ambito: ExcelAmbito = "todo"
): Promise<{ buffer: Buffer; cityName: string }> {
  const cityIds = await getAllRealCityIds();
  const buffer = await buildFleetWorkbook(cityIds, ambito, true);
  return { buffer, cityName: "Pagasa" };
}

// Nombre del archivo descargado: Planta y Estaciones usan su propio prefijo
// ("Datos planta"/"Datos de estaciones") en vez de "Flotilla", porque no son
// vehículos — cityName ya trae "Pagasa" cuando es la descarga combinada de
// todas las ciudades (ver buildAllCitiesFleetWorkbook).
export function excelFileName(cityName: string, ambito: ExcelAmbito): string {
  switch (ambito) {
    case "planta":
      return `Datos planta ${cityName}.xlsx`;
    case "estaciones":
      return `Datos de estaciones ${cityName}.xlsx`;
    case "unidades":
      return `Flotilla ${cityName} - Unidades.xlsx`;
    case "todo":
    default:
      return `Flotilla ${cityName}.xlsx`;
  }
}
