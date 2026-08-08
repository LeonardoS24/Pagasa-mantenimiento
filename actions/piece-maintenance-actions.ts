"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import {
  getMaintenanceLogsForPiece,
  type PieceMaintenanceLogEntry,
  type MonthRange,
} from "@/lib/piece-maintenance-stats";
import { getMaintenanceLogsForType, type MaintenanceTypeLogEntry } from "@/lib/maintenance-type-stats";
import type { SessionData } from "@/lib/session";

// El desglose de una pieza (ver components/city/PieceMaintenanceChart.tsx) se
// pide desde el cliente, así que hay que revalidar el acceso aquí mismo: la
// página ya lo hizo con assertCityAccess al cargar, pero esta acción es una
// llamada aparte y no puede confiar en lo que el cliente diga que está viendo.
// cityId null = la vista combinada de Administración: para eso se exige
// acceso a esa ciudad agregada en concreto, no a "cualquier ciudad".
async function assertCanViewPieceStats(user: SessionData, cityId: string | null) {
  if (user.role === "ADMIN") return;

  const targetCityId =
    cityId ??
    (await prisma.city.findUnique({ where: { slug: AGGREGATE_CITY_SLUG }, select: { id: true } }))?.id;
  if (!targetCityId) throw new Error("No autorizado");

  const access = await prisma.userCityAccess.findUnique({
    where: { userId_cityId: { userId: user.userId, cityId: targetCityId } },
  });
  if (!access) throw new Error("No autorizado");
}

export async function fetchMaintenanceLogsForPiece(
  cityId: string | null,
  categoria: string | null,
  pieza: string,
  range: MonthRange
): Promise<PieceMaintenanceLogEntry[]> {
  const user = await requireUser();
  await assertCanViewPieceStats(user, cityId);
  return getMaintenanceLogsForPiece(cityId, categoria, pieza, range);
}

// Mismo desglose, pero para el gráfico propio de una unidad (ver el apartado
// de cada vehículo): revalida acceso a la ciudad de ESA unidad en concreto.
export async function fetchMaintenanceLogsForPieceByVehicle(
  vehicleRecordId: string,
  categoria: string | null,
  pieza: string,
  range: MonthRange
): Promise<PieceMaintenanceLogEntry[]> {
  const user = await requireUser();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleRecordId },
    select: { section: { select: { cityId: true } } },
  });
  if (!vehicle) throw new Error("No autorizado");
  await assertCanViewPieceStats(user, vehicle.section.cityId);

  return getMaintenanceLogsForPiece(null, categoria, pieza, range, vehicleRecordId);
}

// Desglose de una rebanada de la gráfica de pastel Preventivo/Correctivo/
// Predictivo (ver components/city/MaintenanceTypePieChart.tsx). Mismo
// control de acceso que fetchMaintenanceLogsForPiece.
export async function fetchMaintenanceLogsForType(
  cityId: string | null,
  tipoMantenimiento: string,
  range: MonthRange,
  vehicleRecordId?: string
): Promise<MaintenanceTypeLogEntry[]> {
  const user = await requireUser();

  if (vehicleRecordId) {
    const vehicle = await prisma.vehicleRecord.findUnique({
      where: { id: vehicleRecordId },
      select: { section: { select: { cityId: true } } },
    });
    if (!vehicle) throw new Error("No autorizado");
    await assertCanViewPieceStats(user, vehicle.section.cityId);
  } else {
    await assertCanViewPieceStats(user, cityId);
  }

  return getMaintenanceLogsForType(cityId, tipoMantenimiento, range, vehicleRecordId);
}
