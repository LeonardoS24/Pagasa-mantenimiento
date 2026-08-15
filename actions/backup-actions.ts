"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { runBackup } from "@/lib/backup";
import type { ActionState } from "./user-actions";

// Respaldo manual, además del automático diario (ver lib/backup.ts,
// agendado desde instrumentation.ts) — útil antes de un cambio grande o
// simplemente para no esperar a la próxima corrida.
export async function runBackupNow(): Promise<ActionState> {
  const admin = await requireAdmin();

  try {
    const folderName = await runBackup();
    await logActivity({
      user: admin,
      accion: "EDITAR",
      entidad: "Respaldo",
      resumen: `Respaldo manual creado (${folderName})`,
    });
    revalidatePath("/admin/respaldos");
    return { success: "Respaldo creado correctamente." };
  } catch (err) {
    console.error("[backup] Falló el respaldo manual:", err);
    return { error: "No se pudo crear el respaldo. Revisa el espacio en disco." };
  }
}
