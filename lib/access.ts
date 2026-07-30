import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { SessionData } from "./session";

export async function getAccessibleCities(user: SessionData) {
  if (user.role === "ADMIN") {
    return prisma.city.findMany({ orderBy: { order: "asc" } });
  }

  return prisma.city.findMany({
    where: { userAccess: { some: { userId: user.userId } } },
    orderBy: { order: "asc" },
  });
}

export async function assertCityAccess(user: SessionData, citySlug: string) {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) notFound();

  if (user.role === "ADMIN") return city;

  const access = await prisma.userCityAccess.findUnique({
    where: { userId_cityId: { userId: user.userId, cityId: city.id } },
  });

  if (!access) notFound();

  return city;
}
