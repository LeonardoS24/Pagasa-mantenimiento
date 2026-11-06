import { prisma } from "./prisma";
import { leerDiseno, type DisenoFicha } from "./diseno-ficha";

// El diseño guardado de la ficha de un apartado ({} si nadie lo acomodó).
export async function getDisenoFicha(apartadoSlug: string): Promise<DisenoFicha> {
  const fila = await prisma.disenoFicha.findUnique({ where: { apartadoSlug }, select: { datos: true } });
  return leerDiseno(fila?.datos);
}
