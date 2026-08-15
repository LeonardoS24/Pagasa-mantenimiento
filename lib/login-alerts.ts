import { prisma } from "./prisma";
import { getValveAlertLevel } from "./valve-alerts";
import { isAlertVisibleForSection } from "./alert-visibility";
import { PIECE_ORDER_UNRESOLVED_STATES } from "./inventory-enums";
import { getStationValveAlertLevel, getStationValveVencimiento } from "./station-valves";
import { ESTACION_LIKE_SECTION_SLUGS } from "./estacion-sections";

// Cuántas órdenes de prioridad ALTA (unidad en mal estado, ver
// createPieceOrder en actions/piece-order-actions.ts) siguen sin resolver en
// las ciudades dadas. Se llama una sola vez al iniciar sesión (ver
// actions/auth-actions.ts) para armar el aviso de
// components/layout/HighPriorityOrderAlertToast.tsx.
export async function countPendingHighPriorityOrders(cityIds: string[]): Promise<number> {
  if (cityIds.length === 0) return 0;
  return prisma.pieceOrder.count({
    where: {
      prioridad: "ALTA",
      estado: { in: PIECE_ORDER_UNRESOLVED_STATES },
      section: { cityId: { in: cityIds } },
    },
  });
}

// Cuántas unidades activas tienen la alerta de cambio de válvulas en rojo
// (falta una semana o menos, ver lib/valve-alerts.ts) en las ciudades dadas.
// Mismo momento de cálculo que countPendingHighPriorityOrders, para el aviso
// de components/layout/ValveRedAlertToast.tsx.
export async function countValveRedAlerts(cityIds: string[]): Promise<number> {
  if (cityIds.length === 0) return 0;

  const records = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    select: {
      section: { select: { slug: true } },
      technicalSheet: {
        select: {
          fechaFabricacionValvulaLlenado: true,
          fechaFabricacionValvulaNoRetroceso: true,
          fechaFabricacionValvulaBypass: true,
          fechaFabricacionValvulaRetornoVapores: true,
          fechaFabricacionValvulaServicio: true,
          fechaFabricacionValvulaMaximoLlenado: true,
          fechaFabricacionValvulaMaximoLlenado85: true,
          fechaFabricacionValvulaAlivio: true,
          fechaFabricacionValvulaDescargaEmergencia: true,
        },
      },
    },
  });

  let count = 0;
  for (const record of records) {
    if (!record.technicalSheet) continue;
    if (!isAlertVisibleForSection("valvulas", record.section.slug)) continue;
    if (getValveAlertLevel(record.technicalSheet) === "red") count++;
  }

  // Válvulas de Estación de carburación / Planta: viven en su propia ficha
  // del tanque, no en la del vehículo (ver lib/station-valves.ts), así que
  // el conteo de arriba no las alcanza — se cuentan aparte. Una estación con
  // dos tanques (ver VehicleRecord.stationTankTechnicalSheets) suma una
  // alerta por cada tanque en rojo.
  const stationRecords = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds }, slug: { in: ESTACION_LIKE_SECTION_SLUGS } } },
    select: { section: { select: { slug: true } }, stationTankTechnicalSheets: true },
  });
  for (const record of stationRecords) {
    if (!isAlertVisibleForSection("valvulas", record.section.slug)) continue;
    for (const tanque of record.stationTankTechnicalSheets) {
      if (getStationValveAlertLevel(getStationValveVencimiento(tanque)) === "red") count++;
    }
  }

  return count;
}
