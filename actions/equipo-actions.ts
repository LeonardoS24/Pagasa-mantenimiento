"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { tipoEquipoSchema, estadoEquipoSchema, criticidadEquipoSchema } from "@/lib/equipo-enums";
import { saveDocumentFile, equipoOwnerKey, readOptionalPdfFiles, readOptionalImageFiles } from "@/lib/documents";
import { deleteEquipoDocumentFiles } from "@/lib/document-cleanup";
import { getEquipoDeleteImpact } from "@/lib/delete-impact";
import { verifySessionPassword } from "@/lib/reauth";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const optionalEnum = <T extends [string, ...string[]]>(schema: z.ZodEnum<T>) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, schema.nullable());

const optionalDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : null;
}, z.date().nullable());

const equipoSchema = z.object({
  tipoEquipo: tipoEquipoSchema,
  codigo: optionalText(50),
  nombre: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "El nombre del equipo es requerido").max(150)),
  categoria: optionalText(100),
  tipoEquipoDetalle: optionalText(100),
  marca: optionalText(100),
  modelo: optionalText(100),
  numeroSerie: optionalText(100),
  fabricante: optionalText(100),
  anioFabricacion: optionalText(20),
  fechaInstalacion: optionalDate,
  ubicacion: optionalText(150),
  responsable: optionalText(150),
  estado: optionalEnum(estadoEquipoSchema),
  criticidad: optionalEnum(criticidadEquipoSchema),
  frecuenciaMantenimiento: optionalText(100),
  observaciones: optionalText(2000),
  capacidad: optionalText(100),
  presionTrabajo: optionalText(100),
  temperaturaOperacion: optionalText(100),
  materialFabricacion: optionalText(100),
  fluidoTrabajo: optionalText(100),
  potencia: optionalText(100),
  rpm: optionalText(50),
  lubricante: optionalText(100),
  voltaje: optionalText(50),
  corriente: optionalText(50),
  frecuenciaElectrica: optionalText(50),
  numeroFases: optionalText(20),
  proteccionIp: optionalText(20),
  claseAislamiento: optionalText(20),
  consumoElectrico: optionalText(50),
  comunicacion: optionalText(100),
  combustible: optionalText(50),
  horasOperacion: optionalText(50),
});

function parseEquipoForm(formData: FormData) {
  return equipoSchema.safeParse({
    tipoEquipo: formData.get("tipoEquipo"),
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    categoria: formData.get("categoria"),
    tipoEquipoDetalle: formData.get("tipoEquipoDetalle"),
    marca: formData.get("marca"),
    modelo: formData.get("modelo"),
    numeroSerie: formData.get("numeroSerie"),
    fabricante: formData.get("fabricante"),
    anioFabricacion: formData.get("anioFabricacion"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    ubicacion: formData.get("ubicacion"),
    responsable: formData.get("responsable"),
    estado: formData.get("estado"),
    criticidad: formData.get("criticidad"),
    frecuenciaMantenimiento: formData.get("frecuenciaMantenimiento"),
    observaciones: formData.get("observaciones"),
    capacidad: formData.get("capacidad"),
    presionTrabajo: formData.get("presionTrabajo"),
    temperaturaOperacion: formData.get("temperaturaOperacion"),
    materialFabricacion: formData.get("materialFabricacion"),
    fluidoTrabajo: formData.get("fluidoTrabajo"),
    potencia: formData.get("potencia"),
    rpm: formData.get("rpm"),
    lubricante: formData.get("lubricante"),
    voltaje: formData.get("voltaje"),
    corriente: formData.get("corriente"),
    frecuenciaElectrica: formData.get("frecuenciaElectrica"),
    numeroFases: formData.get("numeroFases"),
    proteccionIp: formData.get("proteccionIp"),
    claseAislamiento: formData.get("claseAislamiento"),
    consumoElectrico: formData.get("consumoElectrico"),
    comunicacion: formData.get("comunicacion"),
    combustible: formData.get("combustible"),
    horasOperacion: formData.get("horasOperacion"),
  });
}

export async function createEquipo(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();

  const parsed = parseEquipoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { city: true } });
  if (!section) {
    return { error: "El apartado no existe." };
  }

  const manuales = readOptionalPdfFiles(formData, "manualTecnico");
  if (!Array.isArray(manuales)) return manuales;
  const fotografias = readOptionalImageFiles(formData, "fotografias");
  if (!Array.isArray(fotografias)) return fotografias;

  const maxOrder = await prisma.equipo.aggregate({ where: { sectionId }, _max: { order: true } });

  const equipo = await prisma.equipo.create({
    data: { sectionId, order: (maxOrder._max.order ?? -1) + 1, createdById: editor.userId, ...parsed.data },
  });

  for (const file of manuales) {
    const { storedName } = await saveDocumentFile(equipoOwnerKey(equipo.id), file);
    await prisma.document.create({
      data: {
        sectionId,
        equipoId: equipo.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }
  for (const file of fotografias) {
    const { storedName } = await saveDocumentFile(equipoOwnerKey(equipo.id), file);
    await prisma.document.create({
      data: {
        sectionId,
        equipoId: equipo.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
        kind: "FOTO",
      },
    });
  }

  const chain = await getSectionChain(sectionId);
  revalidatePath(sectionBasePath(section.city.slug, chain));
  return { success: "Equipo agregado." };
}

export async function updateEquipo(
  equipoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = parseEquipoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { section: { include: { city: true } } },
  });
  if (!equipo) {
    return { error: "El equipo no existe." };
  }

  await prisma.equipo.update({ where: { id: equipoId }, data: parsed.data });

  const chain = await getSectionChain(equipo.sectionId);
  revalidatePath(sectionBasePath(equipo.section.city.slug, chain));
  revalidatePath(`/ciudades/${equipo.section.city.slug}/equipo/${equipoId}`);
  return { success: "Equipo actualizado." };
}

export async function previewEquipoDeleteImpact(equipoId: string) {
  await requireElevatedEditor();
  return { impacto: await getEquipoDeleteImpact(equipoId), pideContrasena: true };
}

export async function deleteEquipo(
  equipoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { section: { include: { city: true } } },
  });
  if (!equipo) return { error: "El equipo no existe." };

  await deleteEquipoDocumentFiles(equipoId);
  await prisma.equipo.delete({ where: { id: equipoId } });

  const chain = await getSectionChain(equipo.sectionId);
  revalidatePath(sectionBasePath(equipo.section.city.slug, chain));
  return { success: "Equipo eliminado." };
}
