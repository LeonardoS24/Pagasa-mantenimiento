// Renombra el apartado "Equipos" a "Equipos de planta" en todas las
// ciudades: el slug se queda igual ("equipos", compatibilidad de URLs), solo
// cambia el nombre visible (ver components/layout/SectionIcon.tsx y la
// petición de distinguirlo de los equipos propios de cada Estación de
// carburación, ver Equipo.vehicleRecordId).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const result = await prisma.section.updateMany({
  where: { slug: "equipos", parentId: null, name: "Equipos" },
  data: { name: "Equipos de planta" },
});
console.log(`Renombrados ${result.count} apartado(s).`);

await prisma.$disconnect();
