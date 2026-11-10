"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { assertVehicleAccess } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { pasarTanque, resumenRegistros } from "@/lib/traspaso-tanque";
import type { ActionState } from "./user-actions";

const esquema = z.object({
  destinoId: z.string().min(1, "Elige la unidad a la que pasa el tanque."),
  motivo: z.preprocess((valor) => {
    const texto = String(valor ?? "").trim();
    return texto.length > 0 ? texto : null;
  }, z.string().max(500, "El motivo es demasiado largo (máximo 500 caracteres).").nullable()),
});

// Pasa el tanque de una unidad dada de baja a otra (ver lib/traspaso-tanque.ts).
// Solo ADMIN, con acceso a las dos unidades y su contraseña: mueve datos y
// registros de una unidad a otra. No borra nada.
export async function pasarTanqueAOtraUnidad(
  origenId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();
  await assertVehicleAccess(admin, origenId);

  const parsed = esquema.safeParse({ destinoId: formData.get("destinoId"), motivo: formData.get("motivo") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  await assertVehicleAccess(admin, parsed.data.destinoId);

  const errorContrasena = await verifySessionPassword(admin, formData.get("password"));
  if (errorContrasena) return { error: errorContrasena };

  const r = await pasarTanque({
    origenId,
    destinoId: parsed.data.destinoId,
    motivo: parsed.data.motivo,
    userId: admin.userId,
    username: admin.username,
  });
  if ("error" in r) return { error: r.error };

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Traspaso de tanque",
    resumen: `El tanque${r.serie ? ` (serie ${r.serie})` : ""} de ${r.origen.numero} pasó a ${r.destino.numero} (${r.destino.cityName})`,
    detalle: [`Registros que se fueron con el tanque: ${resumenRegistros(r.registros)}.`, parsed.data.motivo]
      .filter(Boolean)
      .join(" "),
    citySlug: r.origen.citySlug,
  });

  revalidatePath(`/ciudades/${r.origen.citySlug}`, "layout");
  revalidatePath(`/ciudades/${r.destino.citySlug}`, "layout");
  revalidatePath("/ciudades/administracion", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/admin/alertas");

  redirect(`/ciudades/${r.destino.citySlug}/vehiculo/${r.destino.id}#tanque-traspasos`);
}
