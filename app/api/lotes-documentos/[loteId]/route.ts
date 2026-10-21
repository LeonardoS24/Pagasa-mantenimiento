import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leerOriginalLote } from "@/lib/lote-documentos-archivos";

// El escaneo original de un lote (ver LoteDocumentos), para la vista previa
// de la revisión. Mismas reglas que app/api/documents/[documentId]: sesión
// válida, rol desde la base y acceso a la ciudad del lote.
export async function GET(_request: NextRequest, { params }: { params: { loteId: string } }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
  }

  const lote = await prisma.loteDocumentos.findUnique({ where: { id: params.loteId } });
  if (!lote) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (usuario.role !== "ADMIN") {
    const access = await prisma.userCityAccess.findUnique({
      where: { userId_cityId: { userId: usuario.id, cityId: lote.cityId } },
    });
    if (!access) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  try {
    const buffer = await leerOriginalLote(lote.id, lote.storedName);
    const asciiFallback = lote.fileName.replace(/[^\x20-\x7E]/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(lote.fileName)}`,
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo ya no está disponible" }, { status: 404 });
  }
}
