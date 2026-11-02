import { prisma } from "./prisma";

// Los apartados que tienen unidades activas en esas ciudades (para los
// filtros del expediente y del programa anual). En Administración se juntan
// los de todas las ciudades: un mismo apartado aparece una vez.
export async function apartadosConUnidades(cityIds: string[]): Promise<{ slug: string; nombre: string }[]> {
  const secciones = await prisma.section.findMany({
    where: { cityId: { in: cityIds }, vehicleRecords: { some: { activo: true } } },
    select: { slug: true, name: true },
    orderBy: { order: "asc" },
  });
  const vistos = new Map<string, string>();
  for (const s of secciones) if (!vistos.has(s.slug)) vistos.set(s.slug, s.name);
  return [...vistos].map(([slug, nombre]) => ({ slug, nombre }));
}
