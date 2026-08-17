import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storagePathFor, ownerKeyForDocument } from "@/lib/documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // La cuenta pudo eliminarse con la sesión abierta. Aquí se responde 401 en
  // lugar de redirigir: quien pide esto espera un PDF, no una página de login.
  // El rol se toma de la base, no de la cookie.
  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
  }

  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: { section: { include: { city: true } } },
  });
  if (!document) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (usuario.role !== "ADMIN") {
    const access = await prisma.userCityAccess.findUnique({
      where: { userId_cityId: { userId: usuario.id, cityId: document.section.city.id } },
    });
    if (!access) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const ownerKey = ownerKeyForDocument(document);

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
        // El tipo se valida al subir (ver readPdfFromForm), pero ese dato lo
        // declara el navegador de quien sube: alguien podría mandar un
        // archivo diciendo que es PDF sin serlo. Con nosniff el navegador se
        // queda con el Content-Type de arriba en vez de adivinar por el
        // contenido, así un archivo mal etiquetado no puede acabar
        // ejecutándose como página dentro del sistema.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo ya no está disponible" }, { status: 404 });
  }
}
