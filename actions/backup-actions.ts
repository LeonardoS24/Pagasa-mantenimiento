"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { runBackup } from "@/lib/backup";
import {
  NOMBRE_CARPETA_EXTERNA,
  copiarAExterno,
  getEstadoExterno,
  getProgresoExterno,
  getRutaExterna,
  probarRestauracion,
  setRutaExterna,
  validarRutaExterna,
  type ResultadoPrueba,
} from "@/lib/respaldo-externo";
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

// --- Copia de seguridad servidor (memoria USB), ver lib/respaldo-externo.ts ---

export async function guardarDestinoExterno(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const elegida = String(formData.get("unidad") ?? "");
  const escrita = String(formData.get("rutaManual") ?? "").trim();
  const quitar = formData.get("quitar") === "1";

  if (quitar) {
    await setRutaExterna(null);
    await logActivity({ user: admin, accion: "EDITAR", entidad: "Respaldo", resumen: "Se quitó la unidad de la copia de seguridad servidor" });
    revalidatePath("/admin/respaldos");
    return { success: "Se quitó la unidad. Ya no se hará la copia automática a la memoria." };
  }

  const ruta = elegida === "otra" ? escrita : elegida;
  const problema = validarRutaExterna(ruta);
  if (problema) return { error: problema };

  await setRutaExterna(ruta);
  await logActivity({ user: admin, accion: "EDITAR", entidad: "Respaldo", resumen: `Copia de seguridad servidor en ${ruta}` });
  revalidatePath("/admin/respaldos");
  return { success: `Listo: la copia se guardará en ${ruta}${ruta.endsWith("\\") || ruta.endsWith("/") ? "" : "\\"}${NOMBRE_CARPETA_EXTERNA}. Haz la primera con "Copiar ahora".` };
}

// Arranca la copia y regresa de inmediato: la primera vez puede tardar
// varios minutos (copia todos los archivos). El panel va mostrando el avance.
export async function copiarAExternoAhora(): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!(await getRutaExterna())) return { error: "Primero elige la unidad donde se guardará la copia." };
  if (getProgresoExterno().enCurso) return { error: "Ya hay una copia en curso." };
  void copiarAExterno().then(async (r) => {
    await logActivity({
      user: admin,
      accion: "EDITAR",
      entidad: "Respaldo",
      resumen: `Copia de seguridad servidor (manual): ${r.ok ? "correcta" : "falló"}`,
      detalle: r.mensaje,
    }).catch(() => undefined);
  });
  return { success: "Copia iniciada." };
}

export async function consultarCopiaExterna() {
  await requireAdmin();
  const [estado, progreso] = [await getEstadoExterno(), getProgresoExterno()];
  return { estado, progreso };
}

export async function probarRestauracionAhora(): Promise<ResultadoPrueba> {
  const admin = await requireAdmin();
  try {
    const r = await probarRestauracion();
    await logActivity({ user: admin, accion: "EDITAR", entidad: "Respaldo", resumen: `Prueba de restauración: ${r.ok ? "correcta" : "con problemas"}`, detalle: r.mensaje });
    return r;
  } catch (error) {
    console.error("[respaldo externo] Falló la prueba de restauración:", error);
    return { ok: false, mensaje: `No se pudo hacer la prueba: ${error instanceof Error ? error.message : String(error)}` };
  }
}
