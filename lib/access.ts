import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { UsuarioSesion } from "./session";

export async function getAccessibleCities(user: UsuarioSesion) {
  if (user.role === "ADMIN") {
    return prisma.city.findMany({ orderBy: { order: "asc" } });
  }

  return prisma.city.findMany({
    where: { userAccess: { some: { userId: user.userId } } },
    orderBy: { order: "asc" },
  });
}

export async function assertCityAccess(user: UsuarioSesion, citySlug: string) {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) notFound();

  if (user.role === "ADMIN") return city;

  const access = await prisma.userCityAccess.findUnique({
    where: { userId_cityId: { userId: user.userId, cityId: city.id } },
  });

  if (!access) notFound();

  return city;
}

// Las tres funciones de abajo son para Server Actions, no para páginas.
//
// Una página se protege con assertCityAccess porque conoce el slug de la
// ciudad por la URL. Una Server Action no: recibe un sectionId / vehicleId /
// equipoId que viene del navegador, y todo lo exportado desde un archivo
// "use server" queda expuesto como endpoint que se puede llamar directo con
// el id que sea. Comprobar el ROL (requireEditor y compañía) no alcanza:
// contesta "¿puede editar?", no "¿puede editar ESTO?". Sin estas guardas, un
// USUARIO con una sola ciudad asignada podía tocar los datos de cualquier
// otra ciudad mandando un id ajeno.
//
// Fallan lanzando (no con notFound()) porque una acción no renderiza una
// página: el error lo recoge quien la llamó.
export async function assertCityAccessById(user: UsuarioSesion, cityId: string): Promise<void> {
  if (user.role === "ADMIN") return;

  const access = await prisma.userCityAccess.findUnique({
    where: { userId_cityId: { userId: user.userId, cityId } },
  });
  if (!access) throw new Error("No tienes acceso a esta ciudad.");
}

export async function assertSectionAccess(user: UsuarioSesion, sectionId: string): Promise<void> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { cityId: true },
  });
  if (!section) throw new Error("El apartado no existe.");
  await assertCityAccessById(user, section.cityId);
}

export async function assertVehicleAccess(user: UsuarioSesion, vehicleRecordId: string): Promise<void> {
  const record = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleRecordId },
    select: { section: { select: { cityId: true } } },
  });
  if (!record) throw new Error("El registro no existe.");
  await assertCityAccessById(user, record.section.cityId);
}

export async function assertEquipoAccess(user: UsuarioSesion, equipoId: string): Promise<void> {
  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    select: { section: { select: { cityId: true } } },
  });
  if (!equipo) throw new Error("El equipo no existe.");
  await assertCityAccessById(user, equipo.section.cityId);
}
