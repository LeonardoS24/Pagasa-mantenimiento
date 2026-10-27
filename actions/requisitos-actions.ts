"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { REQUISITOS_BASE, plazoBaseDe } from "@/lib/requisitos-normativos";
import { cargarPlazos } from "@/lib/requisitos-runtime";
import type { ActionState } from "./user-actions";

// Ajustes al catálogo de requisitos normativos (ver
// lib/requisitos-normativos.ts). Solo ADMIN: el plazo mueve las alertas de
// todas las ciudades.
const texto = (max: number) =>
  z.preprocess((v) => String(v ?? "").replace(/\s+/g, " ").trim(), z.string().min(1, "No puede ir vacío").max(max));

const schema = z.object({
  norma: texto(150),
  numeral: texto(150),
  cita: z.preprocess((v) => String(v ?? "").replace(/[ \t]+/g, " ").trim(), z.string().min(1, "La cita no puede ir vacía").max(1500)),
  verificado: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  plazoAnios: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? undefined : Number(v)),
    z.number({ invalid_type_error: "El plazo debe ser un número" }).int("El plazo debe ser en años enteros").min(1, "El plazo mínimo es 1 año").max(30, "El plazo máximo es 30 años").optional()
  ),
});

export async function guardarRequisito(clave: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const base = REQUISITOS_BASE.find((r) => r.clave === clave);
  if (!base) return { error: "Ese requisito no existe en el catálogo." };

  const parsed = schema.safeParse({
    norma: formData.get("norma"),
    numeral: formData.get("numeral"),
    cita: formData.get("cita"),
    verificado: formData.get("verificado"),
    plazoAnios: formData.get("plazoAnios"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  // El plazo solo se edita en los requisitos que mueven una alerta: uno de
  // solo referencia no tiene plazo, aunque llegara en el FormData.
  const plazoBase = plazoBaseDe(base);
  if (base.plazoClave && d.plazoAnios === undefined) return { error: "Escribe el plazo en años." };

  // Se guarda solo lo que cambió respecto al catálogo base; un campo igual al
  // base queda en null (usa el base) para que "restablecer" y "ajustado"
  // signifiquen lo que dicen.
  const distinto = <T,>(valor: T, valorBase: T) => (valor === valorBase ? null : valor);
  const datos = {
    plazoAnios: base.plazoClave ? distinto(d.plazoAnios as number, plazoBase) : null,
    norma: distinto(d.norma, base.norma),
    numeral: distinto(d.numeral, base.numeral),
    cita: distinto(d.cita, base.cita),
    verificado: distinto(d.verificado, base.verificado),
  };
  const sinCambios = Object.values(datos).every((v) => v === null);

  const anterior = await prisma.requisitoNormativoAjuste.findUnique({ where: { clave } });

  // Qué cambió respecto a lo que regía hasta ahora (no respecto al base):
  // queda en el historial de /admin/normas con fecha y quién, para poder
  // decir qué criterio aplicaba el sistema en cada momento.
  const antes = {
    plazo: base.plazoClave ? anterior?.plazoAnios ?? plazoBase : null,
    norma: anterior?.norma ?? base.norma,
    numeral: anterior?.numeral ?? base.numeral,
    cita: anterior?.cita ?? base.cita,
    verificado: anterior?.verificado ?? base.verificado,
  };
  const cambios: string[] = [];
  if (base.plazoClave && antes.plazo !== d.plazoAnios) cambios.push(`Plazo: ${antes.plazo} → ${d.plazoAnios} años`);
  if (antes.norma !== d.norma) cambios.push(`Norma: ${antes.norma} → ${d.norma}`);
  if (antes.numeral !== d.numeral) cambios.push(`Numeral: ${antes.numeral} → ${d.numeral}`);
  if (antes.cita !== d.cita) cambios.push(`Cita: «${d.cita}»`);
  if (antes.verificado !== d.verificado) cambios.push(d.verificado ? "Marcado como cotejado" : "Marcado como pendiente de cotejar");
  if (cambios.length === 0) return { success: "No había cambios que guardar." };

  if (sinCambios) {
    if (anterior) await prisma.requisitoNormativoAjuste.delete({ where: { clave } });
  } else {
    await prisma.requisitoNormativoAjuste.upsert({
      where: { clave },
      update: { ...datos, actualizadoPor: admin.username },
      create: { clave, ...datos, actualizadoPor: admin.username },
    });
  }

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: base.nombre,
    detalle: cambios.join(" · "),
  });

  // Las alertas toman el plazo nuevo desde ya, en todas las pantallas.
  await cargarPlazos();
  revalidatePath("/", "layout");
  return { success: "Guardado. Las alertas ya usan este plazo." };
}

export async function restablecerRequisito(clave: string, _prevState: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const base = REQUISITOS_BASE.find((r) => r.clave === clave);
  if (!base) return { error: "Ese requisito no existe en el catálogo." };

  await prisma.requisitoNormativoAjuste.deleteMany({ where: { clave } });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: base.nombre,
    detalle: "Restableció los valores base del catálogo",
  });
  await cargarPlazos();
  revalidatePath("/", "layout");
  return { success: "Restablecido a los valores base." };
}
