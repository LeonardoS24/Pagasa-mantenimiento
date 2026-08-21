"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertVehicleAccess } from "@/lib/access";
import { complianceItemsFor, complianceAmbitoDe as ambitoDe } from "@/lib/compliance-checklist";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const optionalDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : null;
}, z.date().nullable());

const itemSchema = z.object({
  cumple: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  fecha: optionalDate,
  observaciones: optionalText(500),
});

// Este checklist no guarda documentos: solo dice si la unidad/estación/
// planta tiene o no cada uno (con fecha y observación libres, si hacen
// falta). El archivo en sí, si existe, se sube al apartado de Documentación
// o al de manuales, según corresponda — no aquí.
export async function updateComplianceChecklistItem(
  vehicleId: string,
  clave: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertVehicleAccess(editor, vehicleId);

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // Se recalcula aquí (no se confía en lo que mande el formulario) para no
  // dejar que alguien marque "cumple" un documento que ni siquiera está en
  // la lista de su tipo de registro.
  const ambito = ambitoDe(vehicle.section.slug);
  const items = complianceItemsFor(ambito, vehicle.activo);
  if (!items.some((item) => item.clave === clave)) {
    return { error: "Ese documento no aplica a este tipo de registro." };
  }

  const parsed = itemSchema.safeParse({
    cumple: formData.get("cumple"),
    fecha: formData.get("fecha"),
    observaciones: formData.get("observaciones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.complianceChecklistItem.upsert({
    where: { vehicleRecordId_clave: { vehicleRecordId: vehicleId, clave } },
    update: { ...parsed.data, updatedById: editor.userId },
    create: { vehicleRecordId: vehicleId, clave, ...parsed.data, updatedById: editor.userId },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath(`/ciudades/${vehicle.section.city.slug}`);
  revalidatePath("/dashboard");
  return { success: "Guardado." };
}
