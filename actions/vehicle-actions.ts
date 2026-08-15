"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import {
  combustibleSchema,
  calidadExtintorSchema,
  vehicleEstatusSchema,
  canTransitionVehicleEstatus,
  vehicleEstatusLabels,
  type VehicleEstatus,
} from "@/lib/vehicle-enums";
import { STATION_VALVE_FIELDS, stationValveLabels } from "@/lib/station-valves";
import { collapseSpaces } from "@/lib/text-normalize";
import { verifySessionPassword } from "@/lib/reauth";
import { deleteVehicleDocumentFiles } from "@/lib/document-cleanup";
import { getVehicleDeleteImpact } from "@/lib/delete-impact";
import type { ActionState } from "./user-actions";

// "Estaciones de carburación" (ver scripts/add-estaciones-de-carburacion.mjs)
// reutiliza numeroEconomico/sucursal como "Nombre"/"Dirección" y no pide
// año/placas — no aplican a una estación fija. Para cualquier otra sección
// (un vehículo de verdad) siguen siendo obligatorios, validado aparte más
// abajo porque cuál aplica depende de a qué sección pertenece el registro.
const ESTACION_SECTION_SLUG = "estaciones-de-carburacion";
// "Planta" (ver scripts/restructure-planta-section.mjs) se comporta igual
// que una Estación (ficha técnica de tanque, registros de inspección,
// permisos) salvo por sus equipos, que viven en el apartado hermano
// "Equipos de planta" en vez de por-registro.
const PLANTA_FICHA_TECNICA_SECTION_SLUG = "planta-ficha-tecnica";
const STATION_LIKE_SECTION_SLUGS = [ESTACION_SECTION_SLUG, PLANTA_FICHA_TECNICA_SECTION_SLUG];

// Combustibles que implican que el motor tiene sistema de gas LP y por lo
// tanto la unidad debe existir también como registro en Vehículo con tanque
// de carburación: Gas LP puro o combinado con gasolina, ambos casos.
const PAIRING_COMBUSTIBLES = ["GAS_LP", "GAS_LP_GASOLINA"];

const vehicleSchema = z.object({
  numeroEconomico: z.string().min(1, "El nombre/número económico es requerido").max(50),
  // Para un vehículo normal esto es "Marca" en pantalla (así es como el
  // equipo lo usa de siempre, ver components/admin/VehicleForm.tsx) y es
  // requerida; para una Estación de carburación o Planta es "Dirección", ahí
  // es opcional (puede llenarse después) — el requerido real se exige aparte
  // más abajo, igual que año/placas. En ambos casos se captura y edita aquí,
  // junto con el resto de los datos generales — nunca por separado en otro
  // formulario.
  sucursal: z.string().max(2000).optional(),
  anio: z.string().max(20).optional(),
  placas: z.string().max(50).optional(),
  observaciones: z.string().max(1000).optional(),
  // Solo para Estaciones de carburación (datos generales del listado, ver
  // components/admin/VehicleForm.tsx).
  permisionaria: z.string().max(150).optional(),
  permiso: z.string().max(100).optional(),
});

function parseVehicleForm(formData: FormData) {
  // collapseSpaces y no solo trim: un doble espacio en medio del número
  // económico ("KG  138") lo vuelve inencontrable en el buscador.
  const clean = (value: FormDataEntryValue | null) => {
    const text = collapseSpaces(String(value ?? ""));
    return text.length > 0 ? text : undefined;
  };
  // sucursal ("Dirección" en Estaciones/Planta) es una dirección de varias
  // líneas: a diferencia de los demás campos, no se colapsan los saltos de
  // línea que la persona haya escrito.
  const cleanKeepLines = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : undefined;
  };

  return vehicleSchema.safeParse({
    numeroEconomico: clean(formData.get("numeroEconomico")),
    sucursal: cleanKeepLines(formData.get("sucursal")),
    anio: clean(formData.get("anio")),
    placas: clean(formData.get("placas")),
    observaciones: clean(formData.get("observaciones")),
    permisionaria: clean(formData.get("permisionaria")),
    permiso: clean(formData.get("permiso")),
  });
}

export async function createVehicleRecord(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { city: true },
  });
  if (!section) {
    return { error: "El apartado no existe." };
  }
  const isStationLike = STATION_LIKE_SECTION_SLUGS.includes(section.slug);
  if (!isStationLike) {
    if (!parsed.data.sucursal) {
      return { error: "La marca es requerida." };
    }
    if (!parsed.data.anio || !parsed.data.placas) {
      return { error: "El año y las placas son requeridos." };
    }
  } else if (section.slug === PLANTA_FICHA_TECNICA_SECTION_SLUG && !parsed.data.sucursal) {
    return { error: "La dirección es requerida." };
  }

  const maxOrder = await prisma.vehicleRecord.aggregate({
    where: { sectionId },
    _max: { order: true },
  });

  await prisma.vehicleRecord.create({
    data: {
      sectionId,
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: editor.userId,
      ...parsed.data,
      sucursal: parsed.data.sucursal ?? "",
    },
  });

  const chain = await getSectionChain(sectionId);
  revalidatePath(sectionBasePath(section.city.slug, chain));
  return { success: "Número económico agregado." };
}

// Editar los datos generales de una unidad ya existente (número económico,
// sucursal, año, placas) es solo de ADMIN. USUARIO conserva permiso para
// registrar unidades nuevas (createVehicleRecord) y para todo lo demás
// (bitácoras, documentos); esto solo endurece la corrección de datos ya
// capturados.
export async function updateVehicleRecord(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }
  if (!STATION_LIKE_SECTION_SLUGS.includes(vehicle.section.slug)) {
    if (!parsed.data.sucursal) {
      return { error: "La marca es requerida." };
    }
    if (!parsed.data.anio || !parsed.data.placas) {
      return { error: "El año y las placas son requeridos." };
    }
  } else if (vehicle.section.slug === PLANTA_FICHA_TECNICA_SECTION_SLUG && !parsed.data.sucursal) {
    return { error: "La dirección es requerida." };
  }

  // VehicleForm siempre incluye el campo (Marca o Dirección, según el tipo
  // de apartado), así que a diferencia de otros campos opcionales, un valor
  // vacío aquí sí debe limpiar sucursal (no dejar el valor anterior).
  await prisma.vehicleRecord.update({
    where: { id: vehicleId },
    data: { ...parsed.data, sucursal: parsed.data.sucursal ?? "" },
  });

  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Registro actualizado." };
}

// Solo para pintar la confirmación: no borra nada.
export async function previewVehicleDeleteImpact(vehicleId: string) {
  await requireElevatedEditor();
  return { impacto: await getVehicleDeleteImpact(vehicleId), pideContrasena: true };
}

// Borrar una unidad se lleva su ficha técnica, sus 10 tipos de bitácora y sus
// documentos. Pide la contraseña de quien está en sesión, igual que borrar una
// ciudad, y limpia los PDF del disco antes de que la cascada borre los
// registros que los apuntaban.
export async function deleteVehicleRecord(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "La unidad ya no existe." };
  }

  await deleteVehicleDocumentFiles(vehicleId);
  await prisma.vehicleRecord.delete({ where: { id: vehicleId } });

  const chain = await getSectionChain(vehicle.sectionId);
  const basePath = sectionBasePath(vehicle.section.city.slug, chain);
  revalidatePath(basePath);
  redirect(basePath);
}

// Auto-Tanques y Vehículo con tanque de carburación pueden repetir el mismo
// número económico como el mismo camión físico en dos apartados distintos,
// cada uno con su propia ficha técnica (ver hasTanqueCarburacionMatch en la
// página de detalle de vehículo). Dar de baja o reactivar debe reflejarse en
// los dos registros a la vez: es la misma unidad física.
const PAIRED_VEHICLE_SECTION_SLUGS: Record<string, string> = {
  "auto-tanques": "vehiculo-con-tanque-de-carburacion",
  "vehiculo-con-tanque-de-carburacion": "auto-tanques",
};

// Dar de baja NO elimina la unidad: solo cambia su estatus a inactiva. Sigue
// visible en la tabla y conserva ficha técnica, bitácora y documentos.
// motivo (opcional, solo tiene efecto al dar de baja, no al reactivar) queda
// documentado en motivoBaja — ver dónde se muestra: VehicleTable,
// AggregateVehicleTable, la página de la unidad, /imprimir y el feed de
// Bitácora de unidades (lib/city-unit-log-feed.ts).
export async function setVehicleActive(vehicleId: string, activo: boolean, formData?: FormData) {
  await requireElevatedEditor();

  const motivo = activo ? null : optionalText(500).parse(formData?.get("motivo"));

  const vehicle = await prisma.vehicleRecord.update({
    where: { id: vehicleId },
    data: { activo, fechaBaja: activo ? null : new Date(), motivoBaja: motivo },
    include: { section: { include: { city: true } } },
  });

  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);

  const pairedSlug = PAIRED_VEHICLE_SECTION_SLUGS[vehicle.section.slug];
  if (pairedSlug) {
    const paired = await prisma.vehicleRecord.findFirst({
      where: {
        numeroEconomico: vehicle.numeroEconomico,
        id: { not: vehicle.id },
        section: { cityId: vehicle.section.cityId, slug: pairedSlug },
      },
    });
    if (paired) {
      await prisma.vehicleRecord.update({
        where: { id: paired.id },
        data: { activo, fechaBaja: activo ? null : new Date(), motivoBaja: motivo },
      });
      const pairedChain = await getSectionChain(paired.sectionId);
      revalidatePath(sectionBasePath(vehicle.section.city.slug, pairedChain));
      revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${paired.id}`);
    }
  }

  revalidatePath("/dashboard");
}

// Devuelve null (no undefined) cuando el campo viene vacío: Prisma ignora las
// claves con valor undefined en un update (no las toca), así que un valor
// undefined nunca podría borrar un dato ya guardado. null sí lo borra.
const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const optionalDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : null;
}, z.date().nullable());

// Suma 10 años a una fecha (UTC, sin desfase de zona horaria).
function addTenYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 10, date.getUTCMonth(), date.getUTCDate()));
}

// fechaCalidadMalaExtintor marca la primera vez que se detectó "MALA" (ancla
// la alerta amarilla/roja, ver lib/extinguisher-alerts.ts). Si ya estaba en
// MALA se conserva la fecha original; si deja de estar en MALA se limpia.
// Compartida entre upsertTechnicalSheet y el cambio rápido
// (updateCalidadExtintor) para no duplicar la transición.
function nextFechaCalidadMalaExtintor(
  nuevaCalidad: string | null,
  calidadAnterior: string | null,
  fechaAnterior: Date | null
): Date | null {
  if (nuevaCalidad !== "MALA") return null;
  return calidadAnterior === "MALA" ? fechaAnterior : new Date();
}

// Historial de transición de calidad del extintor (ver
// ExtinguisherQualityChangeLog en el schema): aplica a todas las unidades,
// no solo a Estaciones de carburación. Solo deja renglón cuando la calidad
// de verdad cambió, para no llenar el historial con guardados que no la
// tocaron.
async function recordExtinguisherQualityChange(params: {
  vehicleRecordId: string;
  calidadAnterior: string | null;
  calidadNueva: string | null;
  observacion: string | null;
  userId: string | null;
}): Promise<void> {
  if (!params.calidadNueva || params.calidadAnterior === params.calidadNueva) return;
  await prisma.extinguisherQualityChangeLog.create({
    data: {
      vehicleRecordId: params.vehicleRecordId,
      calidadAnterior: params.calidadAnterior,
      calidadNueva: params.calidadNueva,
      observacion: params.observacion,
      createdById: params.userId,
    },
  });
}

// Nombre visible de cada válvula, para poder decir en el mensaje de error
// cuál de todas tiene la fecha imposible (ver el superRefine de abajo y el
// equivalente en actions/valve-actions.ts).
const VALVULA_ETIQUETAS = [
  ["fechaFabricacionValvulaLlenado", "válvula de llenado"],
  ["fechaFabricacionValvulaNoRetroceso", "válvula de no retroceso (check)"],
  ["fechaFabricacionValvulaBypass", "válvula de retroceso (bypass)"],
  ["fechaFabricacionValvulaRetornoVapores", "válvula de retorno de vapores"],
  ["fechaFabricacionValvulaServicio", "válvula de servicio de vapor"],
  ["fechaFabricacionValvulaMaximoLlenado", "válvula de máximo llenado 90%"],
  ["fechaFabricacionValvulaMaximoLlenado85", "válvula de máximo llenado 85%"],
  ["fechaFabricacionValvulaAlivio", "válvula de seguridad"],
  ["fechaFabricacionValvulaDescargaEmergencia", "válvula de descarga de emergencia"],
] as const;

function formatoCortoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).split("-").reverse().join("/");
}

const technicalSheetSchema = z.object({
  marca: optionalText(100),
  linea: optionalText(100),
  modelo: optionalText(100),
  peso: optionalText(50),
  pesoBrutoVacio: optionalText(50),
  pesoBrutoMaximo: optionalText(50),
  serie: optionalText(100),
  combustible: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, combustibleSchema.nullable()),
  caracteristicas: optionalText(1000),
  horasUsoDiario: optionalText(50),
  fechaAdquisicion: optionalDate,
  chofer: optionalText(150),
  numeroPoliza: optionalText(100),
  inciso: optionalText(50),
  capacidadTanque: optionalText(50),
  marcaTanque: optionalText(100),
  anioFabricacionTanque: optionalText(20),
  fechaFabricacionTanque: optionalDate,
  numeroSerieTanque: optionalText(100),
  numeroUltimoUltrasonido: optionalText(100),
  ultimoUltrasonido: optionalDate,
  fechaProximoUltrasonido: optionalDate,
  numeroUltimaInspeccionVisual: optionalText(100),
  ultimaInspeccionVisual: optionalDate,
  fechaProximaInspeccionVisual: optionalDate,
  numeroUltimaPruebaHermeticidad: optionalText(100),
  ultimaPruebaHermeticidad: optionalDate,
  fechaProximaPruebaHermeticidad: optionalDate,
  numeroUltimaInspeccionVisualInterna: optionalText(100),
  ultimaInspeccionVisualInterna: optionalDate,
  fechaProximaInspeccionVisualInterna: optionalDate,
  numeroUltimaPruebaHidrostatica: optionalText(100),
  ultimaPruebaHidrostatica: optionalDate,
  fechaProximaPruebaHidrostatica: optionalDate,
  fechaInstalacionExtintor: optionalDate,
  fechaVencimientoExtintor: optionalDate,
  calidadExtintor: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, calidadExtintorSchema.nullable()),
  // No editable desde el formulario: se recalcula más abajo a partir de la
  // transición de calidadExtintor (ver fechaCalidadMalaTransition).
  fechaCalidadMalaExtintor: optionalDate,
  fechaInstalacionValvulas: optionalDate,
  fechaFabricacionValvulaLlenado: optionalDate,
  fechaFabricacionValvulaNoRetroceso: optionalDate,
  fechaFabricacionValvulaBypass: optionalDate,
  fechaFabricacionValvulaRetornoVapores: optionalDate,
  fechaFabricacionValvulaServicio: optionalDate,
  fechaFabricacionValvulaMaximoLlenado: optionalDate,
  tieneValvulaMaximoLlenado85: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  fechaFabricacionValvulaMaximoLlenado85: optionalDate,
  fechaFabricacionValvulaAlivio: optionalDate,
  fechaFabricacionValvulaDescargaEmergencia: optionalDate,
  fechaInstalacionMangueras: optionalDate,
  fechaFabricacionManguera: optionalDate,
}).superRefine((data, ctx) => {
  // Una válvula no se puede instalar antes de existir. Si la fecha de
  // instalación queda antes que la de fabricación de cualquiera de ellas es
  // un error de captura, y además descuadra el cálculo del vencimiento (así
  // quedó capturado LL100 en su momento: instalación 8 meses antes de la
  // fabricación).
  if (!data.fechaInstalacionValvulas) return;
  for (const [campo, etiqueta] of VALVULA_ETIQUETAS) {
    const fabricacion = data[campo];
    if (!fabricacion) continue;
    if (data.fechaInstalacionValvulas.getTime() >= fabricacion.getTime()) continue;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Error en las fechas: la instalación de las válvulas (${formatoCortoFecha(data.fechaInstalacionValvulas)}) es anterior a la fabricación de la ${etiqueta} (${formatoCortoFecha(fabricacion)}). Una válvula no puede instalarse antes de fabricarse.`,
      path: ["fechaInstalacionValvulas"],
    });
    return;
  }
});

export async function upsertTechnicalSheet(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Solo ADMIN puede editar la ficha técnica: USUARIO puede registrar
  // bitácoras/cambios y descargar/subir documentos, pero no modificar los
  // valores de la ficha técnica directamente.
  const editor = await requireElevatedEditor();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } }, technicalSheet: true },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // La ficha técnica se puede guardar parcial, sin importar el tipo de
  // unidad: nada aquí es obligatorio, para no bloquear el guardado mientras
  // todavía no se tienen todos los datos (ver components/admin/TechnicalSheetForm.tsx).
  const parsed = technicalSheetSchema.safeParse({
    marca: formData.get("marca"),
    linea: formData.get("linea"),
    modelo: formData.get("modelo"),
    peso: formData.get("peso"),
    pesoBrutoVacio: formData.get("pesoBrutoVacio"),
    pesoBrutoMaximo: formData.get("pesoBrutoMaximo"),
    serie: formData.get("serie"),
    combustible: formData.get("combustible"),
    caracteristicas: formData.get("caracteristicas"),
    horasUsoDiario: formData.get("horasUsoDiario"),
    fechaAdquisicion: formData.get("fechaAdquisicion"),
    chofer: formData.get("chofer"),
    numeroPoliza: formData.get("numeroPoliza"),
    inciso: formData.get("inciso"),
    capacidadTanque: formData.get("capacidadTanque"),
    marcaTanque: formData.get("marcaTanque"),
    anioFabricacionTanque: formData.get("anioFabricacionTanque"),
    fechaFabricacionTanque: formData.get("fechaFabricacionTanque"),
    numeroSerieTanque: formData.get("numeroSerieTanque"),
    numeroUltimoUltrasonido: formData.get("numeroUltimoUltrasonido"),
    ultimoUltrasonido: formData.get("ultimoUltrasonido"),
    fechaProximoUltrasonido: formData.get("fechaProximoUltrasonido"),
    numeroUltimaInspeccionVisual: formData.get("numeroUltimaInspeccionVisual"),
    ultimaInspeccionVisual: formData.get("ultimaInspeccionVisual"),
    fechaProximaInspeccionVisual: formData.get("fechaProximaInspeccionVisual"),
    numeroUltimaPruebaHermeticidad: formData.get("numeroUltimaPruebaHermeticidad"),
    ultimaPruebaHermeticidad: formData.get("ultimaPruebaHermeticidad"),
    fechaProximaPruebaHermeticidad: formData.get("fechaProximaPruebaHermeticidad"),
    numeroUltimaInspeccionVisualInterna: formData.get("numeroUltimaInspeccionVisualInterna"),
    ultimaInspeccionVisualInterna: formData.get("ultimaInspeccionVisualInterna"),
    fechaProximaInspeccionVisualInterna: formData.get("fechaProximaInspeccionVisualInterna"),
    numeroUltimaPruebaHidrostatica: formData.get("numeroUltimaPruebaHidrostatica"),
    ultimaPruebaHidrostatica: formData.get("ultimaPruebaHidrostatica"),
    fechaProximaPruebaHidrostatica: formData.get("fechaProximaPruebaHidrostatica"),
    fechaInstalacionExtintor: formData.get("fechaInstalacionExtintor"),
    fechaVencimientoExtintor: formData.get("fechaVencimientoExtintor"),
    calidadExtintor: formData.get("calidadExtintor"),
    fechaInstalacionValvulas: formData.get("fechaInstalacionValvulas"),
    fechaFabricacionValvulaLlenado: formData.get("fechaFabricacionValvulaLlenado"),
    fechaFabricacionValvulaNoRetroceso: formData.get("fechaFabricacionValvulaNoRetroceso"),
    fechaFabricacionValvulaBypass: formData.get("fechaFabricacionValvulaBypass"),
    fechaFabricacionValvulaRetornoVapores: formData.get("fechaFabricacionValvulaRetornoVapores"),
    fechaFabricacionValvulaServicio: formData.get("fechaFabricacionValvulaServicio"),
    fechaFabricacionValvulaMaximoLlenado: formData.get("fechaFabricacionValvulaMaximoLlenado"),
    tieneValvulaMaximoLlenado85: formData.get("tieneValvulaMaximoLlenado85"),
    fechaFabricacionValvulaMaximoLlenado85: formData.get("fechaFabricacionValvulaMaximoLlenado85"),
    fechaFabricacionValvulaAlivio: formData.get("fechaFabricacionValvulaAlivio"),
    fechaFabricacionValvulaDescargaEmergencia: formData.get("fechaFabricacionValvulaDescargaEmergencia"),
    fechaInstalacionMangueras: formData.get("fechaInstalacionMangueras"),
    fechaFabricacionManguera: formData.get("fechaFabricacionManguera"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Inspección visual interna, prueba hidrostática y ultrasonido: si hay
  // fecha de fabricación y el campo de fecha próxima quedó vacío, se calcula
  // sola como fabricación + 10 años (primer ciclo antes de cualquier
  // registro). Las dos primeras vencen cada 10 años siempre; el ultrasonido
  // es distinto — su primer vencimiento también es a los 10 años de
  // fabricación, pero cada medición posterior recorre el ciclo solo 5 años
  // (ver addFiveYears en actions/ultrasound-actions.ts).
  const data = { ...parsed.data };
  if (data.fechaFabricacionTanque && !data.fechaProximaInspeccionVisualInterna) {
    data.fechaProximaInspeccionVisualInterna = addTenYears(data.fechaFabricacionTanque);
  }
  if (data.fechaFabricacionTanque && !data.fechaProximaPruebaHidrostatica) {
    data.fechaProximaPruebaHidrostatica = addTenYears(data.fechaFabricacionTanque);
  }
  if (data.fechaFabricacionTanque && !data.fechaProximoUltrasonido) {
    data.fechaProximoUltrasonido = addTenYears(data.fechaFabricacionTanque);
  }

  data.fechaCalidadMalaExtintor = nextFechaCalidadMalaExtintor(
    data.calidadExtintor,
    vehicle.technicalSheet?.calidadExtintor ?? null,
    vehicle.technicalSheet?.fechaCalidadMalaExtintor ?? null
  );

  // Vehículo con tanque de carburación siempre usa alguna forma de gas LP
  // (solo o combinado con gasolina): se garantiza en el servidor sin
  // importar lo que llegue del formulario (el campo se muestra bloqueado en
  // la UI, pero esto es la garantía real). Lo mismo aplica a Auto-Tanques
  // cuando el mismo número económico se repite como registro en Vehículo
  // con tanque de carburación dentro de la misma ciudad (mismo camión, motor
  // con sistema de gas LP). Si lo que se mandó ya es uno de los dos valores
  // válidos se respeta tal cual (para no forzar "Gas LP/Gasolina" en una
  // unidad que en realidad es solo Gas LP); cualquier otro valor cae al
  // default de siempre.
  let lockCombustible = vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  if (!lockCombustible && vehicle.section.slug === "auto-tanques") {
    const match = await prisma.vehicleRecord.count({
      where: {
        numeroEconomico: vehicle.numeroEconomico,
        id: { not: vehicle.id },
        section: { cityId: vehicle.section.cityId, slug: "vehiculo-con-tanque-de-carburacion" },
      },
    });
    lockCombustible = match > 0;
  }
  if (lockCombustible && !PAIRING_COMBUSTIBLES.includes(data.combustible ?? "")) {
    data.combustible = "GAS_LP_GASOLINA";
  }

  // La Serie del vehículo y el Número de serie del tanque identifican una
  // unidad física de forma única: no pueden repetirse entre dos números
  // económicos distintos. Excepto contra una unidad ya dada de baja: ese
  // número de serie quedó libre (p.ej. el mismo tanque físico se pasó a una
  // unidad nueva), así que no cuenta como conflicto. Tampoco cuenta cuando
  // Vehículo con tanque de carburación está de por medio (de cualquiera de
  // los dos lados): es el mismo automóvil que su Auto-Tanques/Vehículo de
  // reparto pareja, así que comparte la misma Serie (VIN) a propósito.
  if (data.serie) {
    const duplicate = await prisma.vehicleTechnicalSheet.findFirst({
      where: { serie: data.serie, vehicleRecordId: { not: vehicleId }, vehicleRecord: { activo: true } },
      include: { vehicleRecord: { include: { section: true } } },
    });
    const carburacionInvolucrada =
      vehicle.section.slug === "vehiculo-con-tanque-de-carburacion" ||
      duplicate?.vehicleRecord.section.slug === "vehiculo-con-tanque-de-carburacion";
    if (duplicate && !carburacionInvolucrada) {
      return { error: `Ya existe otra unidad registrada con la Serie "${data.serie}".` };
    }
  }
  if (data.numeroSerieTanque) {
    const duplicate = await prisma.vehicleTechnicalSheet.findFirst({
      where: {
        numeroSerieTanque: data.numeroSerieTanque,
        vehicleRecordId: { not: vehicleId },
        vehicleRecord: { activo: true },
      },
    });
    if (duplicate) {
      return {
        error: `Ya existe otra unidad registrada con el Número de serie de tanque "${data.numeroSerieTanque}".`,
      };
    }
  }

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: data,
    create: { vehicleRecordId: vehicleId, ...data },
  });

  // Este formulario no tiene un campo de observación propio (el cambio
  // rápido de calidad — updateCalidadExtintor — es el que lo exige); si de
  // todos modos la calidad cambió al editar la ficha completa, igual queda
  // el renglón en el historial, sin observación.
  await recordExtinguisherQualityChange({
    vehicleRecordId: vehicleId,
    calidadAnterior: vehicle.technicalSheet?.calidadExtintor ?? null,
    calidadNueva: data.calidadExtintor,
    observacion: null,
    userId: editor.userId,
  });

  // Si esta unidad (en cualquier apartado de Unidad de distribución, menos
  // Vehículo con tanque de carburación mismo y Estaciones de carburación,
  // que no es un vehículo) queda con combustible Gas LP o Gas LP/Gasolina,
  // es porque tiene sistema de gas LP en el motor y también debe existir
  // como registro en Vehículo con tanque de carburación (ver
  // hasTanqueCarburacionMatch en la página de detalle, que ya asumía este
  // pareo). No es normal crear unidades ahí a mano, así que se crea sola si
  // todavía no existe.
  if (
    PAIRING_COMBUSTIBLES.includes(data.combustible ?? "") &&
    vehicle.section.slug !== "vehiculo-con-tanque-de-carburacion" &&
    !STATION_LIKE_SECTION_SLUGS.includes(vehicle.section.slug)
  ) {
    const tanqueSection = await prisma.section.findFirst({
      where: { slug: "vehiculo-con-tanque-de-carburacion", cityId: vehicle.section.cityId },
    });
    if (tanqueSection) {
      const existingPair = await prisma.vehicleRecord.findFirst({
        where: { numeroEconomico: vehicle.numeroEconomico, sectionId: tanqueSection.id },
      });
      if (!existingPair) {
        const maxOrder = await prisma.vehicleRecord.aggregate({
          where: { sectionId: tanqueSection.id },
          _max: { order: true },
        });
        await prisma.vehicleRecord.create({
          data: {
            sectionId: tanqueSection.id,
            order: (maxOrder._max.order ?? -1) + 1,
            createdById: editor.userId,
            numeroEconomico: vehicle.numeroEconomico,
            sucursal: vehicle.sucursal,
            anio: vehicle.anio,
            placas: vehicle.placas,
            observaciones: vehicle.observaciones,
          },
        });
        const tanqueChain = await getSectionChain(tanqueSection.id);
        revalidatePath(sectionBasePath(vehicle.section.city.slug, tanqueChain));
      }
    }
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath("/dashboard");
  return { success: "Ficha técnica guardada." };
}

const stationTankTechnicalSheetSchema = z.object({
  numeroSerie: optionalText(100),
  marca: optionalText(100),
  modelo: optionalText(100),
  tipo: optionalText(100),
  anioFabricacion: optionalText(20),
  fechaFabricacion: optionalDate,
  capacidad: optionalText(50),
  presionDiseno: optionalText(50),
  longitudTotal: optionalText(50),
  formaCabeza: optionalText(100),
  espesorNominalCuerpo: optionalText(50),
  espesorNominalCabeza: optionalText(50),
  materialCuerpo: optionalText(100),
  materialCabeza: optionalText(100),
  diametroInterior: optionalText(50),
  tara: optionalText(50),
  // Válvulas del tanque fijo (ver lib/station-valves.ts).
  fechaInstalacionValvulas: optionalDate,
  fechaFabricacionValvulaExcesoFlujo: optionalDate,
  fechaFabricacionValvulaNoRetroceso: optionalDate,
  fechaFabricacionValvulaSeguridad: optionalDate,
  fechaFabricacionValvulaLlenado: optionalDate,
  fechaFabricacionValvulaServicio: optionalDate,
  fechaFabricacionValvulaCheckLock: optionalDate,
  fechaFabricacionValvulaRelevoHidrostatico: optionalDate,
  fechaFabricacionValvulaVapor: optionalDate,
}).superRefine((data, ctx) => {
  // Misma regla que en la ficha técnica de una unidad: una válvula no se
  // puede instalar antes de existir.
  if (!data.fechaInstalacionValvulas) return;
  for (const campo of STATION_VALVE_FIELDS) {
    const fabricacion = data[campo];
    if (!fabricacion) continue;
    if (data.fechaInstalacionValvulas.getTime() >= fabricacion.getTime()) continue;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Error en las fechas: la instalación de las válvulas (${formatoCortoFecha(data.fechaInstalacionValvulas)}) es anterior a la fabricación de la ${stationValveLabels[campo].toLowerCase()} (${formatoCortoFecha(fabricacion)}). Una válvula no puede instalarse antes de fabricarse.`,
      path: ["fechaInstalacionValvulas"],
    });
    return;
  }
});

// Ficha técnica del tanque de una Estación de carburación: reemplaza la
// sección "Tanque" genérica (ver upsertTechnicalSheet) con el vocabulario de
// un recipiente a presión fijo. Las fechas de vencimiento de las 5
// inspecciones periódicas se quedan en VehicleTechnicalSheet — si aquí se
// captura la fecha de fabricación y esas 3 todavía están vacías, se calculan
// solas a 10 años, igual que ya hace upsertTechnicalSheet para el resto de
// las unidades.
export async function upsertStationTankTechnicalSheet(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } }, technicalSheet: true },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const parsed = stationTankTechnicalSheetSchema.safeParse({
    numeroSerie: formData.get("numeroSerie"),
    marca: formData.get("marca"),
    modelo: formData.get("modelo"),
    tipo: formData.get("tipo"),
    anioFabricacion: formData.get("anioFabricacion"),
    fechaFabricacion: formData.get("fechaFabricacion"),
    capacidad: formData.get("capacidad"),
    presionDiseno: formData.get("presionDiseno"),
    longitudTotal: formData.get("longitudTotal"),
    formaCabeza: formData.get("formaCabeza"),
    espesorNominalCuerpo: formData.get("espesorNominalCuerpo"),
    espesorNominalCabeza: formData.get("espesorNominalCabeza"),
    materialCuerpo: formData.get("materialCuerpo"),
    materialCabeza: formData.get("materialCabeza"),
    diametroInterior: formData.get("diametroInterior"),
    tara: formData.get("tara"),
    fechaInstalacionValvulas: formData.get("fechaInstalacionValvulas"),
    ...Object.fromEntries(STATION_VALVE_FIELDS.map((campo) => [campo, formData.get(campo)])),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const sheetData = parsed.data;

  await prisma.stationTankTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: sheetData,
    create: { vehicleRecordId: vehicleId, ...sheetData },
  });

  if (
    sheetData.fechaFabricacion &&
    !vehicle.technicalSheet?.fechaProximaInspeccionVisualInterna &&
    !vehicle.technicalSheet?.fechaProximaPruebaHidrostatica &&
    !vehicle.technicalSheet?.fechaProximoUltrasonido
  ) {
    const fechaCalculada = addTenYears(sheetData.fechaFabricacion);
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        fechaProximaInspeccionVisualInterna: fechaCalculada,
        fechaProximaPruebaHidrostatica: fechaCalculada,
        fechaProximoUltrasonido: fechaCalculada,
      },
      create: {
        vehicleRecordId: vehicleId,
        fechaProximaInspeccionVisualInterna: fechaCalculada,
        fechaProximaPruebaHidrostatica: fechaCalculada,
        fechaProximoUltrasonido: fechaCalculada,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Ficha técnica del tanque actualizada." };
}

// Cambio rápido de solo la calidad del extintor, sin desbloquear/editar toda
// la ficha técnica (mismo espíritu que EditStatusForm para mantenimientos).
// Reutiliza la acción principal por dentro para no duplicar la lógica de
// upsert ni la transición de fechaCalidadMalaExtintor.
export async function updateCalidadExtintor(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireElevatedEditor();

  const parsed = calidadExtintorSchema.safeParse(formData.get("calidadExtintor"));
  if (!parsed.success) {
    return { error: "Calidad inválida." };
  }

  // Cuando la calidad nueva es "MALA" se exige explicar por qué: la
  // observación queda marcada en el historial de transición del extintor
  // (ver ExtinguisherQualityChangeLog), visible junto al antes/después.
  const observacion = String(formData.get("observacion") ?? "").trim();
  if (parsed.data === "MALA" && !observacion) {
    return { error: "Escribe una observación explicando por qué el extintor está en mal estado." };
  }

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } }, technicalSheet: true },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const calidadAnterior = vehicle.technicalSheet?.calidadExtintor ?? null;
  const fechaCalidadMalaExtintor = nextFechaCalidadMalaExtintor(
    parsed.data,
    calidadAnterior,
    vehicle.technicalSheet?.fechaCalidadMalaExtintor ?? null
  );

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: { calidadExtintor: parsed.data, fechaCalidadMalaExtintor },
    create: { vehicleRecordId: vehicleId, calidadExtintor: parsed.data, fechaCalidadMalaExtintor },
  });

  await recordExtinguisherQualityChange({
    vehicleRecordId: vehicleId,
    calidadAnterior,
    calidadNueva: parsed.data,
    observacion: observacion || null,
    userId: editor.userId,
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Calidad del extintor actualizada." };
}

// Botón rápido de estatus en el listado (ver components/city/VehicleEstatusControl.tsx):
// mismo nivel de acceso que capturar un mantenimiento (requireEditor, no
// requireElevatedEditor), porque es un cambio operativo del día a día, no un
// dato general de la ficha. Marcar "Operativa" a mano cierra ahí mismo los
// mantenimientos que seguían abiertos (mismos 2 estatus que la unidad
// detecta sola como "en taller", ver recalcularFichaTecnicaMantenimiento en
// actions/maintenance-actions.ts) — así el botón "ya volvió a andar" no dice
// mentiras sobre si el mantenimiento sigue pendiente.
export async function setVehicleEstatus(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = vehicleEstatusSchema.safeParse(formData.get("estatus"));
  if (!parsed.success) {
    return { error: "Estatus inválido." };
  }

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // Solo se permiten los cambios de estatus que tienen sentido operativo (ver
  // vehicleEstatusTransitions en lib/vehicle-enums.ts). En particular, una
  // unidad Operativa no se manda a taller a mano: entra sola al registrarle
  // un mantenimiento sin terminar.
  const actual = vehicleEstatusSchema.safeParse(vehicle.estatus).success
    ? (vehicle.estatus as VehicleEstatus)
    : "OPERATIVA";
  if (!canTransitionVehicleEstatus(actual, parsed.data)) {
    return {
      error:
        actual === "OPERATIVA" && parsed.data === "EN_TALLER"
          ? "Una unidad operativa entra a taller sola al registrarle un mantenimiento, no desde aquí."
          : `No se puede pasar de ${vehicleEstatusLabels[actual]} a ${vehicleEstatusLabels[parsed.data]}.`,
    };
  }

  await prisma.vehicleRecord.update({
    where: { id: vehicleId },
    data: { estatus: parsed.data },
  });

  if (parsed.data === "OPERATIVA") {
    await prisma.maintenanceLog.updateMany({
      where: { vehicleRecordId: vehicleId, estatus: { in: ["SIN_ATENCION", "EN_PROCESO"] } },
      data: { estatus: "TERMINADO" },
    });
  }

  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  const bitacoraRoot = await prisma.section.findFirst({
    where: { cityId: vehicle.section.cityId, parentId: null, slug: "bitacoras-de-unidades" },
  });
  if (bitacoraRoot) {
    revalidatePath(sectionBasePath(vehicle.section.city.slug, [bitacoraRoot]));
  }
  revalidatePath("/ciudades/administracion/bitacoras-de-unidades");
  revalidatePath("/dashboard");

  return { success: "Estatus actualizado." };
}
