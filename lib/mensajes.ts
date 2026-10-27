import { prisma } from "./prisma";

// Mensajes entre usuarios (tablas Mensaje y LecturaCanal). Dos tipos de
// conversación:
// - "general": la ven todas las cuentas.
// - "dm:<idA>:<idB>": entre dos personas, con los ids en orden para que la
//   misma pareja siempre caiga en el mismo canal.
// Quién puede ver qué se decide aquí (puedeVerCanal), no en el navegador.

export const CANAL_GENERAL = "general";
export const TEXTO_MAX = 2000;

export function canalDirecto(a: string, b: string): string {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}

export function participantes(canal: string): string[] | null {
  if (!canal.startsWith("dm:")) return null;
  const partes = canal.split(":");
  return partes.length === 3 ? [partes[1], partes[2]] : null;
}

export function puedeVerCanal(userId: string, canal: string): boolean {
  if (canal === CANAL_GENERAL) return true;
  const p = participantes(canal);
  return !!p && p.includes(userId) && p[0] !== p[1];
}

// Del canal directo, el id de la otra persona.
export function otroParticipante(userId: string, canal: string): string | null {
  const p = participantes(canal);
  if (!p) return null;
  return p[0] === userId ? p[1] : p[0];
}

async function lecturas(userId: string): Promise<Map<string, Date>> {
  const filas = await prisma.lecturaCanal.findMany({ where: { userId } });
  return new Map(filas.map((f) => [f.canal, f.leidoHasta]));
}

// Canales donde participa la persona y que tienen al menos un mensaje.
async function canalesConMensajes(userId: string): Promise<string[]> {
  const filas = await prisma.mensaje.findMany({
    where: { OR: [{ canal: CANAL_GENERAL }, { canal: { startsWith: "dm:", contains: userId } }] },
    distinct: ["canal"],
    select: { canal: true },
  });
  return filas.map((f) => f.canal).filter((c) => puedeVerCanal(userId, c));
}

function noLeidosWhere(userId: string, canal: string, desde: Date | undefined) {
  return {
    canal,
    OR: [{ deUserId: null }, { deUserId: { not: userId } }],
    ...(desde ? { createdAt: { gt: desde } } : {}),
  };
}

export async function contarNoLeidos(userId: string): Promise<number> {
  const [canales, leido] = await Promise.all([canalesConMensajes(userId), lecturas(userId)]);
  const cuentas = await Promise.all(
    canales.map((canal) => prisma.mensaje.count({ where: noLeidosWhere(userId, canal, leido.get(canal)) }))
  );
  return cuentas.reduce((a, b) => a + b, 0);
}

// El mensaje más reciente que la persona no ha leído (para el aviso).
export async function ultimoNoLeido(userId: string) {
  const [canales, leido] = await Promise.all([canalesConMensajes(userId), lecturas(userId)]);
  const candidatos = await Promise.all(
    canales.map((canal) =>
      prisma.mensaje.findFirst({ where: noLeidosWhere(userId, canal, leido.get(canal)), orderBy: { createdAt: "desc" } })
    )
  );
  const lista = candidatos.filter((m): m is NonNullable<typeof m> => !!m);
  lista.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return lista[0] ?? null;
}

export type Conversacion = {
  canal: string;
  titulo: string;
  subtitulo: string | null;
  noLeidos: number;
  ultimo: { texto: string; de: string; fecha: string } | null;
};

// La lista de la izquierda: General primero, luego las conversaciones con
// mensajes (la más reciente arriba) y al final el resto de las personas.
export async function getConversaciones(userId: string): Promise<Conversacion[]> {
  const [usuarios, canales, leido] = await Promise.all([
    prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true, username: true, puesto: true }, orderBy: { username: "asc" } }),
    canalesConMensajes(userId),
    lecturas(userId),
  ]);
  const ultimos = new Map(
    await Promise.all(
      canales.map(async (canal) => {
        const [ultimo, noLeidos] = await Promise.all([
          prisma.mensaje.findFirst({ where: { canal }, orderBy: { createdAt: "desc" } }),
          prisma.mensaje.count({ where: noLeidosWhere(userId, canal, leido.get(canal)) }),
        ]);
        return [canal, { ultimo, noLeidos }] as const;
      })
    )
  );
  const resumen = (canal: string) => {
    const u = ultimos.get(canal);
    return {
      noLeidos: u?.noLeidos ?? 0,
      ultimo: u?.ultimo ? { texto: u.ultimo.texto, de: u.ultimo.deUsername, fecha: u.ultimo.createdAt.toISOString() } : null,
    };
  };

  const general: Conversacion = { canal: CANAL_GENERAL, titulo: "General (todos)", subtitulo: null, ...resumen(CANAL_GENERAL) };
  const directas: Conversacion[] = usuarios.map((u) => {
    const canal = canalDirecto(userId, u.id);
    return { canal, titulo: u.username, subtitulo: u.puesto, ...resumen(canal) };
  });
  // Conversaciones con alguien cuya cuenta ya no existe: se siguen viendo.
  const conocidos = new Set(directas.map((d) => d.canal));
  for (const canal of canales) {
    if (canal === CANAL_GENERAL || conocidos.has(canal)) continue;
    const r = resumen(canal);
    directas.push({ canal, titulo: r.ultimo?.de ?? "Cuenta eliminada", subtitulo: "cuenta eliminada", ...r });
  }
  directas.sort((a, b) => {
    if (a.ultimo && b.ultimo) return b.ultimo.fecha.localeCompare(a.ultimo.fecha);
    if (a.ultimo) return -1;
    if (b.ultimo) return 1;
    return a.titulo.localeCompare(b.titulo, "es");
  });
  return [general, ...directas];
}

export async function getMensajes(canal: string, limite = 200) {
  const filas = await prisma.mensaje.findMany({ where: { canal }, orderBy: { createdAt: "desc" }, take: limite });
  return filas.reverse().map((m) => ({
    id: m.id,
    deUserId: m.deUserId,
    de: m.deUsername,
    texto: m.texto,
    fecha: m.createdAt.toISOString(),
  }));
}

export async function marcarLeido(userId: string, canal: string): Promise<void> {
  const ahora = new Date();
  await prisma.lecturaCanal.upsert({
    where: { userId_canal: { userId, canal } },
    update: { leidoHasta: ahora },
    create: { userId, canal, leidoHasta: ahora },
  });
}
