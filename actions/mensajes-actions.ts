"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TEXTO_MAX, marcarLeido, puedeVerCanal } from "@/lib/mensajes";

export type EnvioMensaje = { error?: string; ok?: boolean };

// Cualquier usuario (también LECTOR) puede escribir: es comunicación, no
// edición de datos. El canal se revisa aquí: llega del navegador.
export async function enviarMensaje(canal: string, texto: string): Promise<EnvioMensaje> {
  const user = await requireUser();
  if (!puedeVerCanal(user.userId, canal)) return { error: "No puedes escribir en esa conversación." };
  const limpio = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (!limpio) return { error: "Escribe un mensaje." };
  if (limpio.length > TEXTO_MAX) return { error: `Máximo ${TEXTO_MAX} caracteres.` };
  // En una conversación directa, que la otra persona exista todavía.
  if (canal.startsWith("dm:")) {
    const otro = canal.split(":").find((p, i) => i > 0 && p !== user.userId);
    if (!otro || !(await prisma.user.findUnique({ where: { id: otro }, select: { id: true } }))) {
      return { error: "Esa cuenta ya no existe." };
    }
  }
  await prisma.mensaje.create({ data: { canal, texto: limpio, deUserId: user.userId, deUsername: user.username } });
  await marcarLeido(user.userId, canal);
  return { ok: true };
}
