import { notFound } from "next/navigation";
import fs from "fs/promises";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import sanitizeHtml from "sanitize-html";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { storagePathFor, ownerKeyForDocument } from "@/lib/documents";
import { PdfViewer } from "@/components/city/PdfViewer";

// Vista de solo lectura para abrir un documento ahí mismo, sin descargarlo.
// PDF se dibuja con PdfViewer (pdfjs-dist, canvas por página): el visor
// nativo del navegador embebido en un iframe se veía en negro y sin paginar,
// así que ya no se usa. Imagen se ve inline con un <img>. Word y Excel no
// tienen visor nativo, así que aquí se convierten a HTML del lado del
// servidor (mammoth / xlsx) para mostrarlos igual sin salir de la app.
// PowerPoint y formatos no reconocidos no tienen conversión disponible: se
// ofrece solo la descarga.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr",
    "td", "th", "img", "span", "div", "blockquote", "code", "pre", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "data", "mailto"],
};

const WORD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const TEXT_MIME_TYPES = new Set(["text/csv", "text/plain"]);

export default async function DocumentViewPage({
  params,
}: {
  params: { documentId: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };

  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: { section: { include: { city: true } } },
  });
  if (!document) notFound();

  await assertCityAccess(user, document.section.city.slug);

  const filePath = storagePathFor(ownerKeyForDocument(document), document.storedName);
  const downloadHref = `/api/documents/${document.id}`;

  let body: React.ReactNode;
  if (document.mimeType === "application/pdf") {
    // PdfViewer pide el archivo por su cuenta (fetch del lado del cliente vía
    // downloadHref) y lo dibuja en <canvas>; no hace falta leer el buffer aquí.
    body = <PdfViewer src={downloadHref} fileName={document.fileName} />;
  } else {
    try {
      const buffer = await fs.readFile(filePath);

      if (document.mimeType.startsWith("image/")) {
        // eslint-disable-next-line @next/next/no-img-element
        body = <img src={downloadHref} alt={document.fileName} className="max-w-full rounded-lg border border-gray-200" />;
      } else if (WORD_MIME_TYPES.has(document.mimeType)) {
        const result = await mammoth.convertToHtml({ buffer });
        const html = sanitizeHtml(result.value, SANITIZE_OPTIONS);
        body = (
          <div
            className="prose prose-sm max-w-none rounded-lg border border-gray-200 bg-white p-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else if (EXCEL_MIME_TYPES.has(document.mimeType)) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        body = (
          <div className="space-y-6">
            {workbook.SheetNames.map((sheetName) => {
              const rawHtml = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { id: undefined });
              const html = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
              return (
                <div key={sheetName} className="rounded-lg border border-gray-200 bg-white p-4">
                  <h2 className="mb-2 text-sm font-semibold uppercase text-primary-bright">
                    {sheetName}
                  </h2>
                  <div
                    className="overflow-x-auto text-xs [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              );
            })}
          </div>
        );
      } else if (TEXT_MIME_TYPES.has(document.mimeType)) {
        body = (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-xs text-ink">
            {buffer.toString("utf-8")}
          </pre>
        );
      } else {
        body = (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-ink">
            Este tipo de archivo no tiene vista previa disponible todavía. Descárgalo para abrirlo.
          </p>
        );
      }
    } catch {
      body = (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-ink">
          No se pudo generar la vista previa de este archivo. Descárgalo para abrirlo.
        </p>
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {document.section.city.name} · {document.section.name}
          </p>
          <h1 className="truncate text-lg font-semibold text-primary">{document.fileName}</h1>
        </div>
        <a
          href={downloadHref}
          download={document.fileName}
          className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-gray-50"
        >
          Descargar
        </a>
      </div>
      {body}
    </div>
  );
}
