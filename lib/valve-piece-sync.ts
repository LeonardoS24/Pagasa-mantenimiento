import { prisma } from "@/lib/prisma";
import { normalizePieceName } from "@/lib/learned-pieces";

// Cuando en un mantenimiento normal (Bitácora de mantenimiento, no el
// registro dedicado "Cambio de válvulas") se reemplaza una de las 4 válvulas
// del sistema de carburación de gas LP del motor (ver categoría "Válvulas"
// en lib/piece-catalog.ts, exclusiva de Vehículo con tanque de
// carburación), la fecha de fabricación de esa válvula en la ficha técnica
// se actualiza sola con la fecha del mantenimiento — sin esto habría que
// además llenar el registro "Cambio de válvulas" aparte solo para que la
// alerta de vencimiento (ver lib/valve-alerts.ts) no quedara desactualizada.
type ValveField =
  | "fechaFabricacionValvulaLlenado"
  | "fechaFabricacionValvulaMaximoLlenado"
  | "fechaFabricacionValvulaServicio"
  | "fechaFabricacionValvulaAlivio";

const VALVE_PIECE_CATEGORY = "Válvulas";
const VALVE_REPLACEMENT_ACTION = "Sustitución";

const VALVULA_PIEZA_A_CAMPO: Record<string, ValveField> = {
  [normalizePieceName("Válvula de llenado (Doble check)")]: "fechaFabricacionValvulaLlenado",
  [normalizePieceName("Válvula de máximo llenado (purgador)")]: "fechaFabricacionValvulaMaximoLlenado",
  [normalizePieceName("Válvula de servicio (reguladora)")]: "fechaFabricacionValvulaServicio",
  [normalizePieceName("Válvula de seguridad")]: "fechaFabricacionValvulaAlivio",
};

export async function maybeSyncValvePieceReplacement({
  vehicleRecordId,
  categoriaPieza,
  pieza,
  accionPieza,
  fecha,
}: {
  vehicleRecordId: string;
  categoriaPieza: string | null;
  pieza: string | null;
  accionPieza: string | null;
  fecha: Date;
}): Promise<void> {
  if (categoriaPieza !== VALVE_PIECE_CATEGORY || accionPieza !== VALVE_REPLACEMENT_ACTION || !pieza) {
    return;
  }
  const campo = VALVULA_PIEZA_A_CAMPO[normalizePieceName(pieza)];
  if (!campo) return;

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId },
    update: { [campo]: fecha },
    create: { vehicleRecordId, [campo]: fecha },
  });
}
