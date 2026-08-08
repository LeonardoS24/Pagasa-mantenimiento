"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import { getCityUnitLogFeed, type UnitLogEvent } from "@/lib/city-unit-log-feed";
import { RECORD_TYPE_LABELS, type RecordTypeKey } from "@/lib/record-count-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import type { SessionData } from "@/lib/session";

// Mismo control de acceso que actions/piece-maintenance-actions.ts: esta
// acción se pide desde el cliente (al hacer clic en una barra de
// RecordCountByCityChart o RecordTypeComparisonSection), así que hay que
// revalidar el acceso aquí, no confiar en lo que el cliente diga que ve.
async function assertCanViewCity(user: SessionData, cityId: string | null) {
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

// Desglose al hacer clic en una barra: reutiliza el mismo feed combinado que
// ya arma la bitácora de unidades (getCityUnitLogFeed) y solo se queda con
// los eventos del tipo elegido — evita repetir 10 consultas más para lo mismo.
export async function fetchRecordEntriesForType(
  type: RecordTypeKey,
  cityId: string | null,
  range: MonthRange
): Promise<UnitLogEvent[]> {
  const user = await requireUser();
  await assertCanViewCity(user, cityId);

  const events = await getCityUnitLogFeed(cityId, range);
  const label = RECORD_TYPE_LABELS[type];
  return events.filter((event) => event.tipo === label);
}
