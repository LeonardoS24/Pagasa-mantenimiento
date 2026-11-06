"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { APARTADOS_ACOMODABLES, RECUADROS_FICHA, leerDiseno, type DisenoFicha } from "@/lib/diseno-ficha";

export type ResultadoDiseno = { ok: true } | { ok: false; error: string };

// Entrar al editor pide la contraseña de quien está en sesión: acomodar las
// fichas cambia lo que ven todos los usuarios, así que no basta con tener la
// pantalla abierta. (El guardado la vuelve a pedir: esta solo abre la puerta.)
export async function abrirEditorDiseno(password: string): Promise<ResultadoDiseno> {
  const admin = await requireAdmin();
  const error = await verifySessionPassword(admin, password);
  return error ? { ok: false, error } : { ok: true };
}

// Guarda el diseño de la ficha de un apartado. Un diseño vacío ({}) deja la
// ficha como de fábrica (se borra la fila). Solo cambia la presentación:
// ningún campo, dato ni alerta se toca.
export async function guardarDisenoFicha(apartadoSlug: string, diseno: unknown, password: string): Promise<ResultadoDiseno> {
  const admin = await requireAdmin();

  const apartado = APARTADOS_ACOMODABLES.find((a) => a.slug === apartadoSlug);
  if (!apartado) return { ok: false, error: "Ese apartado no se puede acomodar." };

  const error = await verifySessionPassword(admin, password);
  if (error) return { ok: false, error };

  // Solo las claves de recuadros de fábrica y los propios ("x:<id>").
  const validas = new Set(RECUADROS_FICHA.map((r) => r.clave));
  const limpio: DisenoFicha = {};
  for (const [clave, ajuste] of Object.entries(leerDiseno(JSON.stringify(diseno ?? {})))) {
    if (validas.has(clave) || clave.startsWith("x:")) limpio[clave] = ajuste;
  }
  const cantidad = Object.keys(limpio).length;

  if (cantidad === 0) {
    await prisma.disenoFicha.deleteMany({ where: { apartadoSlug } });
  } else {
    const datos = JSON.stringify(limpio);
    await prisma.disenoFicha.upsert({
      where: { apartadoSlug },
      update: { datos, updatedById: admin.userId },
      create: { apartadoSlug, datos, updatedById: admin.userId },
    });
  }

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Diseño de ficha",
    resumen: `Acomodó la ficha técnica de ${apartado.nombre}`,
    detalle: cantidad === 0 ? "Volvió al diseño de fábrica." : `${cantidad} recuadros con orden, ancho o color propio.`,
  });

  revalidatePath("/ciudades", "layout");
  revalidatePath("/admin/campos/acomodar");
  return { ok: true };
}
