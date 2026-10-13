import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storagePathFor, ownerKeyForDocument } from "@/lib/documents";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { getDocumentosDePruebasPorIds, tipoDocumentoPruebaLabel } from "@/lib/test-documents";
import { buildZip, ZIP_MAX_BYTES, ZIP_MAX_ENTRIES, type ZipEntry } from "@/lib/zip";

// Descarga en un solo ZIP los documentos que se marcaron en "Documentos de
// pruebas" (ver app/(protected)/ciudades/[citySlug]/documentos-de-pruebas).
// Es POST porque la lista de ids puede ser larga para ir en la URL.

// Nombre válido como carpeta/archivo en Windows: sin \ / : * ? " < > |.
function limpiar(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "sin-nombre";
}

export async function POST(request: NextRequest, { params }: { params: { citySlug: string } }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // El rol y la cuenta se toman de la base, no de la cookie (ver
  // app/api/documents/[documentId]/route.ts).
  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
  }

  const city = await prisma.city.findUnique({ where: { slug: params.citySlug } });
  if (!city) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (usuario.role !== "ADMIN") {
    const access = await prisma.userCityAccess.findUnique({
      where: { userId_cityId: { userId: usuario.id, cityId: city.id } },
    });
    if (!access) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  // Administración no tiene unidades propias: igual que sus alertas y su
  // Excel, abarca todas las ciudades reales (ver lib/aggregate-city.ts).
  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];

  const formData = await request.formData();
  const ids = formData
    .getAll("ids")
    .map((v) => String(v))
    .filter((v) => v.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No se eligió ningún documento." }, { status: 400 });
  }
  if (ids.length > ZIP_MAX_ENTRIES) {
    return NextResponse.json({ error: "Demasiados documentos para un solo ZIP." }, { status: 400 });
  }

  // Solo los que de verdad son de estas ciudades: un id ajeno se ignora.
  const documentos = await getDocumentosDePruebasPorIds(cityIds, ids);
  const tamanoTotal = documentos.reduce((total, d) => total + d.size, 0);
  if (tamanoTotal > ZIP_MAX_BYTES) {
    return NextResponse.json(
      { error: "Los documentos elegidos pesan más de 4 GB. Descárgalos en partes." },
      { status: 400 }
    );
  }

  // Carpetas: [Ciudad/] Unidad / Tipo de documento / archivo.
  const entries: ZipEntry[] = [];
  const faltantes: string[] = [];
  for (const doc of documentos) {
    try {
      const data = await fs.readFile(storagePathFor(ownerKeyForDocument(doc.owner), doc.owner.storedName));
      const carpetas = [
        ...(esAgregada ? [limpiar(doc.cityName)] : []),
        limpiar(doc.numeroEconomico),
        limpiar(tipoDocumentoPruebaLabel[doc.tipo]),
      ];
      entries.push({ name: [...carpetas, limpiar(doc.fileName)].join("/"), data, date: doc.owner.createdAt });
    } catch {
      faltantes.push(`${doc.numeroEconomico} — ${doc.fileName}`);
    }
  }
  // Si algún archivo ya no está en disco, se avisa dentro del mismo ZIP en
  // vez de fallar toda la descarga.
  if (faltantes.length > 0) {
    entries.push({
      name: "LEEME - archivos no encontrados.txt",
      data: Buffer.from(
        `Estos documentos están registrados en el sistema pero su archivo ya no está en el servidor:\r\n\r\n${faltantes.join("\r\n")}\r\n`,
        "utf8"
      ),
    });
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Ninguno de los documentos elegidos está disponible." }, { status: 404 });
  }

  const zip = buildZip(entries);
  const fecha = new Date().toISOString().slice(0, 10);
  const fileName = `Documentos de pruebas ${city.name} ${fecha}.zip`;
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
