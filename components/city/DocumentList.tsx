import type { Document } from "@prisma/client";
import { deleteDocument } from "@/actions/document-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({
  documents,
  isAdmin,
}: {
  documents: Document[];
  isAdmin: boolean;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-ink">No hay documentos PDF todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {documents.map((document) => {
        const esImagen = document.mimeType.startsWith("image/");
        // La imagen ya se ve inline con el visor nativo del navegador; PDF,
        // Word, Excel, etc. pasan por /documentos/[id] sin necesidad de
        // descargarlos: para PDF esa página solo redirige al archivo (el
        // visor nativo a pantalla completa pagina bien; embebido en un
        // iframe no), el resto se convierte a HTML del lado del servidor.
        const href = esImagen ? `/api/documents/${document.id}` : `/documentos/${document.id}`;
        return (
        <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            {esImagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/documents/${document.id}`}
                alt=""
                width={56}
                height={64}
                className="h-16 w-14 shrink-0 rounded-md border border-gray-200 object-cover print:hidden"
              />
            )}
            <span className="min-w-0 truncate text-sm font-medium text-primary hover:underline print:overflow-visible print:whitespace-normal print:break-all">
              {document.fileName}
            </span>
          </a>
          <span className="shrink-0 text-xs text-gray-400">{formatSize(document.size)}</span>
          {isAdmin && (
            <form action={deleteDocument.bind(null, document.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar el archivo "${document.fileName}"?`}
                className="shrink-0 text-sm text-accent hover:underline"
              >
                Eliminar
              </ConfirmSubmitButton>
            </form>
          )}
        </li>
        );
      })}
    </ul>
  );
}
