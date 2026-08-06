"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { combustibleSchema, calidadExtintorSchema } from "@/lib/vehicle-enums";
import { collapseSpaces } from "@/lib/text-normalize";
import { verifySessionPassword } from "@/lib/reauth";
import { deleteVehicleDocumentFiles } from "@/lib/document-cleanup";
import { getVehicleDeleteImpact } from "@/lib/delete-impact";
import type { ActionState } from "./user-actions";

const vehicleSchema = z.object({
  numeroEconomico: z.string().min(1, "El número económico es requerido").max(50),
  sucursal: z.string().min(1, "La sucursal/marca es requerida").max(100),
  anio: z.string().min(1, "El año es requerido").max(20),
  placas: z.string().min(1, "Las placas son requeridas").max(50),
  numeroAnterior: z.string().max(50).optional(),
  localidadAnterior: z.string().max(100).optional(),
});

function parseVehicleForm(formData: FormData) {
  // collapseSpaces y no solo trim: un doble espacio en medio del número
  // económico ("KG  138") lo vuelve inencontrable en el buscador.
  const clean = (value: FormDataEntryValue | null) => {
    const text = collapseSpaces(String(value ?? ""));
    return text.length > 0 ? text : undefined;
  };

  return vehicleSchema.safeParse({
    numeroEconomico: clean(formData.get("numeroEconomico")),
    sucursal: clean(formData.get("sucursal")),
    anio: clean(formData.get("anio")),
    placas: clean(formData.get("placas")),
    numeroAnterior: clean(formData.get("numeroAnterior")),
    localidadAnterior: clean(formData.get("localidadAnterior")),
  });
}

export async function createVehicleRecord(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

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

  const maxOrder = await prisma.vehicleRecord.aggregate({
    where: { sectionId },
    _max: { order: true },
  });

  await prisma.vehicleRecord.create({
    data: {
      sectionId,
      order: (maxOrder._max.order ?? -1) + 1,
      ...parsed.data,
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
  await requireAdmin();

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

  await prisma.vehicleRecord.update({ where: { id: vehicleId }, data: parsed.data });

  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Registro actualizado." };
}

// Solo para pintar la confirmación: no borra nada.
export async function previewVehicleDeleteImpact(vehicleId: string) {
  await requireAdmin();
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
  const admin = await requireAdmin();

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

// Dar de baja NO elimina la unidad: solo cambia su estatus a inactiva. Sigue
// visible en la tabla y conserva ficha técnica, bitácora y documentos.
export async function setVehicleActive(vehicleId: string, activo: boolean) {
  await requireAdmin();

  const vehicle = await prisma.vehicleRecord.update({
    where: { id: vehicleId },
    data: { activo, fechaBaja: activo ? null : new Date() },
    include: { section: { include: { city: true } } },
  });

  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
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

const requiredProximoUltrasonidoDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({
  required_error: "La fecha próxima de ultrasonido es requerida para Auto-Tanques.",
  invalid_type_error: "Fecha próxima de ultrasonido inválida.",
}));

const requiredProximaInspeccionVisualDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({
  required_error: "La fecha próxima de inspección visual externa es requerida para Auto-Tanques.",
  invalid_type_error: "Fecha próxima de inspección visual externa inválida.",
}));

const requiredProximaPruebaHermeticidadDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({
  required_error: "La fecha próxima de prueba de hermeticidad es requerida para Auto-Tanques.",
  invalid_type_error: "Fecha próxima de prueba de hermeticidad inválida.",
}));

// Suma 10 años a una fecha (UTC, sin desfase de zona horaria).
function addTenYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 10, date.getUTCMonth(), date.getUTCDate()));
}

const technicalSheetSchema = z.object({
  fabricante: optionalText(100),
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
  fechaFabricacionValvulaServicio: optionalDate,
  fechaFabricacionValvulaMaximoLlenado: optionalDate,
  fechaFabricacionValvulaAlivio: optionalDate,
  fechaInstalacionMangueras: optionalDate,
  fechaFabricacionManguera: optionalDate,
});

export async function upsertTechnicalSheet(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Solo ADMIN puede editar la ficha técnica: USUARIO puede registrar
  // bitácoras/cambios y descargar/subir documentos, pero no modificar los
  // valores de la ficha técnica directamente.
  await requireAdmin();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } }, technicalSheet: true },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // Auto-Tanques debe programar el próximo ultrasonido, inspección visual
  // externa y prueba de hermeticidad antes de poder guardar la ficha
  // técnica; los demás tipos de unidad lo dejan opcional. La inspección
  // visual interna y la prueba hidrostática NO se piden aquí porque se
  // calculan solas a partir de fechaFabricacionTanque (ver más abajo).
  const schema =
    vehicle.section.slug === "auto-tanques"
      ? technicalSheetSchema.extend({
          fechaProximoUltrasonido: requiredProximoUltrasonidoDate,
          fechaProximaInspeccionVisual: requiredProximaInspeccionVisualDate,
          fechaProximaPruebaHermeticidad: requiredProximaPruebaHermeticidadDate,
        })
      : technicalSheetSchema;

  const parsed = schema.safeParse({
    fabricante: formData.get("fabricante"),
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
    fechaFabricacionValvulaServicio: formData.get("fechaFabricacionValvulaServicio"),
    fechaFabricacionValvulaMaximoLlenado: formData.get("fechaFabricacionValvulaMaximoLlenado"),
    fechaFabricacionValvulaAlivio: formData.get("fechaFabricacionValvulaAlivio"),
    fechaInstalacionMangueras: formData.get("fechaInstalacionMangueras"),
    fechaFabricacionManguera: formData.get("fechaFabricacionManguera"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Inspección visual interna y prueba hidrostática: si hay fecha de
  // fabricación y el campo de fecha próxima quedó vacío, se calcula sola
  // como fabricación + 10 años (primer ciclo antes de cualquier registro).
  const data = { ...parsed.data };
  if (data.fechaFabricacionTanque && !data.fechaProximaInspeccionVisualInterna) {
    data.fechaProximaInspeccionVisualInterna = addTenYears(data.fechaFabricacionTanque);
  }
  if (data.fechaFabricacionTanque && !data.fechaProximaPruebaHidrostatica) {
    data.fechaProximaPruebaHidrostatica = addTenYears(data.fechaFabricacionTanque);
  }

  // Extintor: fechaCalidadMalaExtintor marca la primera vez que se detectó
  // "MALA" (ancla la alerta amarilla/roja). Si ya estaba en MALA se conserva
  // la fecha original; si deja de estar en MALA se limpia.
  data.fechaCalidadMalaExtintor =
    data.calidadExtintor === "MALA"
      ? vehicle.technicalSheet?.calidadExtintor === "MALA"
        ? vehicle.technicalSheet.fechaCalidadMalaExtintor
        : new Date()
      : null;

  // Vehículo con tanque de carburación siempre usa gas LP y gasolina: se
  // fija en el servidor sin importar lo que llegue del formulario (el campo
  // se muestra bloqueado en la UI, pero esto es la garantía real). Lo mismo
  // aplica a Auto-Tanques cuando el mismo número económico se repite como
  // registro en Vehículo con tanque de carburación dentro de la misma
  // ciudad (mismo camión, motor con sistema dual de combustible).
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
  if (lockCombustible) {
    data.combustible = "GAS_LP_GASOLINA";
  }

  // La Serie del vehículo y el Número de serie del tanque identifican una
  // unidad física de forma única: no pueden repetirse entre dos números
  // económicos distintos.
  if (data.serie) {
    const duplicate = await prisma.vehicleTechnicalSheet.findFirst({
      where: { serie: data.serie, vehicleRecordId: { not: vehicleId } },
    });
    if (duplicate) {
      return { error: `Ya existe otra unidad registrada con la Serie "${data.serie}".` };
    }
  }
  if (data.numeroSerieTanque) {
    const duplicate = await prisma.vehicleTechnicalSheet.findFirst({
      where: { numeroSerieTanque: data.numeroSerieTanque, vehicleRecordId: { not: vehicleId } },
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

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath("/dashboard");
  return { success: "Ficha técnica guardada." };
}
