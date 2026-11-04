"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { assertCityAccessById, assertVehicleAccess } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { trasladarUnidad } from "@/lib/traspaso-unidades";
import type { ActionState } from "./user-actions";

const traspasoSchema = z.object({
  destinoCityId: z.string().min(1, "Elige la ciudad a la que pasa la unidad."),
  motivo: z.preprocess((valor) => {
    const texto = String(valor ?? "").trim();
    return texto.length > 0 ? texto : null;
  }, z.string().max(500, "El motivo es demasiado largo (máximo 500 caracteres).").nullable()),
});

// Cambia una unidad de distribución de ciudad (ver lib/traspaso-unidades.ts).
// Solo ADMIN, con las dos capas de siempre (rol + ciudad: tiene que tener
// acceso a la ciudad de origen y a la de destino) y su contraseña, como los
// borrados: es un cambio que mueve la unidad de las alertas de una ciudad a
// otra. No borra nada: la unidad, sus bitácoras y sus documentos se conservan.
export async function trasladarUnidadDeCiudad(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();
  await assertVehicleAccess(admin, vehicleId);

  const parsed = traspasoSchema.safeParse({
    destinoCityId: formData.get("destinoCityId"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  await assertCityAccessById(admin, parsed.data.destinoCityId);

  const errorContrasena = await verifySessionPassword(admin, formData.get("password"));
  if (errorContrasena) return { error: errorContrasena };

  const resultado = await trasladarUnidad({
    vehicleId,
    destinoCityId: parsed.data.destinoCityId,
    motivo: parsed.data.motivo,
    userId: admin.userId,
    username: admin.username,
  });
  if ("error" in resultado) return { error: resultado.error };

  const nombres = resultado.movidas.map((m) => m.numeroEconomico);
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Traspaso de unidad",
    resumen:
      nombres.length > 1
        ? `${nombres.join(" y ")} pasaron de ${resultado.origen.nombre} a ${resultado.destino.nombre}`
        : `${nombres[0]} pasó de ${resultado.origen.nombre} a ${resultado.destino.nombre}`,
    detalle: parsed.data.motivo ?? undefined,
    citySlug: resultado.origen.slug,
  });

  // Todo lo de ambas ciudades (listados, fichas) y lo que junta todo (Inicio,
  // Administración).
  revalidatePath(`/ciudades/${resultado.origen.slug}`, "layout");
  revalidatePath(`/ciudades/${resultado.destino.slug}`, "layout");
  revalidatePath("/ciudades/administracion", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/admin/alertas");

  redirect(`/ciudades/${resultado.destino.slug}/vehiculo/${vehicleId}`);
}
