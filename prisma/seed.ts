import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { slugify } from "../lib/slugify";

const prisma = new PrismaClient();

const CITIES = [
  "Hermosillo",
  "Cajeme (Ciudad Obregón)",
  "Guaymas",
  "Empalme",
  "Navojoa",
  "Huatabampo",
  "Nogales",
  "Magdalena (Magdalena de Kino)",
  "Caborca",
  "Puerto Peñasco",
  "San Luis Río Colorado",
  "Agua Prieta",
  "San Miguel de Horcasitas (Pesqueira)",
  "Mexicali",
  "Tijuana",
  "Ensenada",
];

const SECTIONS = [
  "Unidad de distribución",
  "Manuales",
  "Programa de mantenimiento",
  "Equipos Mecánicos",
  "Equipos electrónicos",
  "Bitácoras de unidades",
  "Bitácoras de equipos mecánicos",
  "Bitácora de equipos electrónicos",
  "Inventarios",
];

const ADMIN_USERNAME = "admin";
const ADMIN_TEMP_PASSWORD = "CambiarAhora123!";

async function main() {
  for (const [cityIndex, cityName] of CITIES.entries()) {
    const citySlug = slugify(cityName);

    const city = await prisma.city.upsert({
      where: { slug: citySlug },
      update: {},
      create: { name: cityName, slug: citySlug, order: cityIndex },
    });

    for (const [sectionIndex, sectionName] of SECTIONS.entries()) {
      const sectionSlug = slugify(sectionName);

      const existing = await prisma.section.findFirst({
        where: { cityId: city.id, parentId: null, slug: sectionSlug },
      });

      if (!existing) {
        await prisma.section.create({
          data: {
            cityId: city.id,
            parentId: null,
            name: sectionName,
            slug: sectionSlug,
            order: sectionIndex,
          },
        });
      }
    }
  }

  const adminPasswordHash = await hashPassword(ADMIN_TEMP_PASSWORD);
  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      username: ADMIN_USERNAME,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      // La contraseña temporal es pública (está en este archivo): al primer
      // inicio de sesión el sistema obliga a cambiarla.
      debeCambiarContrasena: true,
    },
  });

  console.warn(
    `\n[SEED] Cuenta admin lista -> usuario "${ADMIN_USERNAME}" / contraseña temporal "${ADMIN_TEMP_PASSWORD}".` +
      `\n[SEED] Al entrar por primera vez el sistema pide cambiarla.\n`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
