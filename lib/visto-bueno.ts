import { prisma } from "./prisma";
import type { EntidadVistoBueno, VistoBuenoVista } from "./visto-bueno-tipos";

export { ENTIDADES_VISTO_BUENO, esEntidadVistoBueno, type EntidadVistoBueno, type VistoBuenoVista } from "./visto-bueno-tipos";

// Visto bueno de supervisor a los registros de bitácora (tabla VistoBueno):
// la parte que toca la base. Los nombres y tipos, en lib/visto-bueno-tipos.ts.

// El registro de la bitácora: de qué unidad es y quién lo capturó.
export async function registroDeBitacora(
  entidad: EntidadVistoBueno,
  id: string
): Promise<{ vehicleRecordId: string; createdById: string | null; updatedAt: Date } | null> {
  const select = { vehicleRecordId: true, createdById: true, updatedAt: true } as const;
  const where = { id };
  switch (entidad) {
    case "mantenimiento":
      return prisma.maintenanceLog.findUnique({ where, select });
    case "ultrasonido":
      return prisma.ultrasoundLog.findUnique({ where, select });
    case "visualExterna":
      return prisma.visualInspectionLog.findUnique({ where, select });
    case "hermeticidad":
      return prisma.tightnessTestLog.findUnique({ where, select });
    case "visualInterna":
      return prisma.internalVisualInspectionLog.findUnique({ where, select });
    case "hidrostatica":
      return prisma.hydrostaticTestLog.findUnique({ where, select });
    case "valvulas":
      return prisma.valveChangeLog.findUnique({ where, select });
    case "valvulasCorrectivo":
      return prisma.valveCorrectiveMaintenanceLog.findUnique({ where, select });
    case "mangueras":
      return prisma.hoseChangeLog.findUnique({ where, select });
    case "extintor":
      return prisma.extinguisherChangeLog.findUnique({ where, select });
  }
}


// Los vistos buenos de una unidad, por "entidad:registroId".
export async function vistosBuenosDeUnidad(vehicleRecordId: string): Promise<Record<string, VistoBuenoVista>> {
  const filas = await prisma.vistoBueno.findMany({ where: { vehicleRecordId } });
  return Object.fromEntries(
    filas.map((f) => [
      `${f.entidad}:${f.registroId}`,
      {
        userId: f.userId,
        username: f.username,
        fecha: f.createdAt.toISOString(),
        comentario: f.comentario,
        registroActualizadoEl: f.registroActualizadoEl?.toISOString() ?? null,
      },
    ])
  );
}
