"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { combustibleSchema } from "@/lib/vehicle-enums";
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
  const clean = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim();
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

export async function updateVehicleRecord(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

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

export async function deleteVehicleRecord(vehicleId: string) {
  await requireAdmin();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) return;

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

const technicalSheetSchema = z.object({
  fabricante: optionalText(100),
  marca: optionalText(100),
  linea: optionalText(100),
  modelo: optionalText(100),
  peso: optionalText(50),
  serie: optionalText(100),
  combustible: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, combustibleSchema.nullable()),
  caracteristicas: optionalText(1000),
  ubicacion: optionalText(100),
  potencia: optionalText(50),
  horasUsoDiario: optionalText(50),
  fechaAdquisicion: optionalDate,
  serieTanque: optionalText(100),
  capacidadTanque: optionalText(50),
  marcaTanque: optionalText(100),
  anioFabricacionTanque: optionalText(20),
  numeroSerieTanque: optionalText(100),
  numeroUltimoUltrasonido: optionalText(100),
  ultimoUltrasonido: optionalDate,
  fechaProximoUltrasonido: optionalDate,
});

export async function upsertTechnicalSheet(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = technicalSheetSchema.safeParse({
    fabricante: formData.get("fabricante"),
    marca: formData.get("marca"),
    linea: formData.get("linea"),
    modelo: formData.get("modelo"),
    peso: formData.get("peso"),
    serie: formData.get("serie"),
    combustible: formData.get("combustible"),
    caracteristicas: formData.get("caracteristicas"),
    ubicacion: formData.get("ubicacion"),
    potencia: formData.get("potencia"),
    horasUsoDiario: formData.get("horasUsoDiario"),
    fechaAdquisicion: formData.get("fechaAdquisicion"),
    serieTanque: formData.get("serieTanque"),
    capacidadTanque: formData.get("capacidadTanque"),
    marcaTanque: formData.get("marcaTanque"),
    anioFabricacionTanque: formData.get("anioFabricacionTanque"),
    numeroSerieTanque: formData.get("numeroSerieTanque"),
    numeroUltimoUltrasonido: formData.get("numeroUltimoUltrasonido"),
    ultimoUltrasonido: formData.get("ultimoUltrasonido"),
    fechaProximoUltrasonido: formData.get("fechaProximoUltrasonido"),
  });

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

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: parsed.data,
    create: { vehicleRecordId: vehicleId, ...parsed.data },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  const chain = await getSectionChain(vehicle.sectionId);
  revalidatePath(sectionBasePath(vehicle.section.city.slug, chain));
  revalidatePath("/dashboard");
  return { success: "Ficha técnica guardada." };
}
