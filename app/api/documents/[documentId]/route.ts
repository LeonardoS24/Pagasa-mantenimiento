import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storagePathFor, vehicleOwnerKey, maintenanceLogOwnerKey } from "@/lib/documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: { section: { include: { city: true } } },
  });
  if (!document) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (session.role !== "ADMIN") {
    const access = await prisma.userCityAccess.findUnique({
      where: { userId_cityId: { userId: session.userId, cityId: document.section.city.id } },
    });
    if (!access) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const ownerKey = document.maintenanceLogId
    ? maintenanceLogOwnerKey(document.maintenanceLogId)
    : document.vehicleRecordId
      ? vehicleOwnerKey(document.vehicleRecordId)
      : document.sectionId;

  try {
    const buffer = await fs.readFile(storagePathFor(ownerKey, document.storedName));
    // RFC 6266: `filename` sirve como respaldo ASCII para navegadores viejos,
    // `filename*` lleva el nombre real con acentos/ñ correctamente codificado.
    const asciiFallback = document.fileName.replace(/[^\x20-\x7E]/g, "_");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        "Content-Length": String(document.size),
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo ya no está disponible" }, { status: 404 });
  }
}
