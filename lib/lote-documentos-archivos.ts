import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { UPLOADS_DIR } from "./documents";

// Dónde vive el escaneo original de un lote (ver LoteDocumentos). Nunca se
// borra al guardar sus partes: es la evidencia de lo que se recibió.
function carpetaLote(loteId: string): string {
  return path.join(UPLOADS_DIR, "lotes-documentos", loteId);
}

export async function guardarOriginalLote(loteId: string, datos: Buffer): Promise<string> {
  const storedName = `${randomUUID()}.pdf`;
  await fs.mkdir(carpetaLote(loteId), { recursive: true });
  await fs.writeFile(path.join(carpetaLote(loteId), storedName), datos);
  return storedName;
}

export async function leerOriginalLote(loteId: string, storedName: string): Promise<Buffer> {
  return fs.readFile(path.join(carpetaLote(loteId), storedName));
}

// Lanza si no es un PDF que se pueda abrir; quien llama lo convierte en un
// mensaje para el usuario. ignoreEncryption: muchos escáneres marcan el PDF
// como "protegido" sin contraseña de apertura, y así igual se puede leer.
export async function contarPaginasPdf(datos: Buffer): Promise<number> {
  const pdf = await PDFDocument.load(datos, { ignoreEncryption: true });
  return pdf.getPageCount();
}

// Un PDF nuevo con solo las páginas desde..hasta (contando desde 1, ambas
// incluidas): la parte que le toca a un documento del lote.
export async function extraerPaginasPdf(datos: Buffer, desde: number, hasta: number): Promise<Buffer> {
  const origen = await PDFDocument.load(datos, { ignoreEncryption: true });
  const total = origen.getPageCount();
  if (desde < 1 || hasta < desde || hasta > total) {
    throw new Error(`Páginas fuera de rango: ${desde}–${hasta} (el escaneo tiene ${total}).`);
  }
  const destino = await PDFDocument.create();
  const indices = Array.from({ length: hasta - desde + 1 }, (_, i) => desde - 1 + i);
  const paginas = await destino.copyPages(origen, indices);
  for (const pagina of paginas) destino.addPage(pagina);
  return Buffer.from(await destino.save());
}
