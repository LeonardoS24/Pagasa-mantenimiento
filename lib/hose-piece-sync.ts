import { prisma } from "@/lib/prisma";
import { normalizePieceName } from "@/lib/learned-pieces";

// Mismo mecanismo que lib/valve-piece-sync.ts, pero para la manguera de alta
// presión del sistema de carburación (categoría "Sistema de carburación" en
// lib/piece-catalog.ts, exclusiva de Vehículo con tanque de carburación):
// si se reemplaza en un mantenimiento normal, la fecha de fabricación de la
// manguera en la ficha técnica se actualiza sola, sin tener que llenar
// además el registro dedicado "Cambio de mangueras".
const HOSE_PIECE_CATEGORY = "Sistema de carburación";
const HOSE_PIECE_NAME = "Mangueras de alta presión";
const HOSE_REPLACEMENT_ACTION = "Sustitución";

export async function maybeSyncHosePieceReplacement({
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
  if (
    categoriaPieza !== HOSE_PIECE_CATEGORY ||
    accionPieza !== HOSE_REPLACEMENT_ACTION ||
    !pieza ||
    normalizePieceName(pieza) !== normalizePieceName(HOSE_PIECE_NAME)
  ) {
    return;
  }

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId },
    update: { fechaFabricacionManguera: fecha },
    create: { vehicleRecordId, fechaFabricacionManguera: fecha },
  });
}
