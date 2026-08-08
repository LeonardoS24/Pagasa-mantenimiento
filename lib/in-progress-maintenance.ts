import { prisma } from "./prisma";

// Cuántos MaintenanceLog siguen "En proceso" en las ciudades dadas. Se llama
// una sola vez al iniciar sesión (ver actions/auth-actions.ts) para armar el
// aviso de components/layout/InProgressAlertToast.tsx.
export async function countInProgressMaintenance(cityIds: string[]): Promise<number> {
  if (cityIds.length === 0) return 0;

  return prisma.maintenanceLog.count({
    where: {
      estatus: "EN_PROCESO",
      vehicleRecord: { section: { cityId: { in: cityIds } } },
    },
  });
}
