import { prisma } from "./prisma";

// Ajustes sueltos del sistema (tabla AjusteSistema, clave/valor).

// Dirección con la que se abre el sistema en la red, p. ej.
// "http://192.168.1.50:3000". Se usa en los enlaces de los correos y en los
// códigos QR de las unidades. Sin barra final.
export function normalizarUrlBase(valor: string): string | null {
  const limpio = valor.trim().replace(/\/+$/, "");
  try {
    const url = new URL(limpio);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return null;
  }
}

export async function getUrlBase(): Promise<string | null> {
  const fila = await prisma.ajusteSistema.findUnique({ where: { clave: "urlBase" } });
  return fila?.valor ? normalizarUrlBase(fila.valor) : null;
}

export async function setUrlBase(valor: string | null): Promise<void> {
  if (!valor) {
    await prisma.ajusteSistema.deleteMany({ where: { clave: "urlBase" } });
    return;
  }
  await prisma.ajusteSistema.upsert({
    where: { clave: "urlBase" },
    update: { valor },
    create: { clave: "urlBase", valor },
  });
}
