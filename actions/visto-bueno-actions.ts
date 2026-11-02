"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/auth";
import { assertVehicleAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity-log";
import { ENTIDADES_VISTO_BUENO, esEntidadVistoBueno, registroDeBitacora } from "@/lib/visto-bueno";

export type ResultadoVistoBueno = { error?: string; ok?: boolean };

// Dar visto bueno: ADMIN o USUARIO con acceso a la ciudad de la unidad, y
// que NO sea quien capturó el registro (regla de cuatro ojos).
export async function darVistoBueno(entidad: string, registroId: string, comentario: string): Promise<ResultadoVistoBueno> {
  const user = await requireEditor();
  if (!esEntidadVistoBueno(entidad)) return { error: "Tipo de registro desconocido." };
  const registro = await registroDeBitacora(entidad, registroId);
  if (!registro) return { error: "El registro ya no existe." };
  await assertVehicleAccess(user, registro.vehicleRecordId);
  if (registro.createdById === user.userId) {
    return { error: "No puedes dar visto bueno a un registro que capturaste tú: lo revisa otra persona." };
  }
  const texto = String(comentario ?? "").trim().slice(0, 500) || null;
  const ya = await prisma.vistoBueno.findUnique({ where: { entidad_registroId: { entidad, registroId } } });
  if (ya) return { error: `Ya tiene visto bueno de ${ya.username}.` };
  await prisma.vistoBueno.create({
    data: { entidad, registroId, vehicleRecordId: registro.vehicleRecordId, userId: user.userId, username: user.username, comentario: texto },
  });
  const unidad = await prisma.vehicleRecord.findUnique({ where: { id: registro.vehicleRecordId }, include: { section: { include: { city: true } } } });
  await logActivity({
    user,
    accion: "EDITAR",
    entidad: "Visto bueno",
    resumen: `${ENTIDADES_VISTO_BUENO[entidad]} de ${unidad?.numeroEconomico ?? "?"}`,
    detalle: texto ?? undefined,
    citySlug: unidad?.section.city.slug,
  });
  if (unidad) revalidatePath(`/ciudades/${unidad.section.city.slug}/vehiculo/${unidad.id}`);
  return { ok: true };
}

// Quitarlo: quien lo dio o un ADMIN (queda en la bitácora de actividad).
export async function quitarVistoBueno(entidad: string, registroId: string): Promise<ResultadoVistoBueno> {
  const user = await requireEditor();
  if (!esEntidadVistoBueno(entidad)) return { error: "Tipo de registro desconocido." };
  const vb = await prisma.vistoBueno.findUnique({ where: { entidad_registroId: { entidad, registroId } } });
  if (!vb) return { ok: true };
  await assertVehicleAccess(user, vb.vehicleRecordId);
  if (vb.userId !== user.userId && user.role !== "ADMIN") return { error: "Solo quien lo dio o un administrador puede quitarlo." };
  await prisma.vistoBueno.delete({ where: { id: vb.id } });
  const unidad = await prisma.vehicleRecord.findUnique({ where: { id: vb.vehicleRecordId }, include: { section: { include: { city: true } } } });
  await logActivity({
    user,
    accion: "EDITAR",
    entidad: "Visto bueno",
    resumen: `Se quitó el visto bueno de ${vb.username} (${ENTIDADES_VISTO_BUENO[entidad]} de ${unidad?.numeroEconomico ?? "?"})`,
    citySlug: unidad?.section.city.slug,
  });
  if (unidad) revalidatePath(`/ciudades/${unidad.section.city.slug}/vehiculo/${unidad.id}`);
  return { ok: true };
}
