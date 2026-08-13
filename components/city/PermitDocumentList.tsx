import type { Document } from "@prisma/client";
import { deleteDocument } from "@/actions/document-actions";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";
import { formatDate } from "@/lib/dates";

// Igual que DocumentList, pero para los permisos de una Estación de
// carburación (kind "PERMISO", ver uploadStationPermit): muestra también la
// fecha del permiso, que es la razón por la que no se mezclan en la lista
// general de "Documentos".
export function PermitDocumentList({ documents, isAdmin }: { documents: Document[]; isAdmin: boolean }) {
  if (documents.length === 0) {
    return <p className="text-sm text-ink">No hay permisos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {documents.map((document) => {
        const esImagen = document.mimeType.startsWith("image/");
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
              <span className="min-w-0 truncate text-sm font-medium text-primary hover:underline">
                {document.fileName}
              </span>
            </a>
            {document.fecha && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                {formatDate(document.fecha)}
              </span>
            )}
            {isAdmin && (
              <ConfirmDeleteRecordWithPassword
                mensaje={`¿Eliminar el permiso "${document.fileName}"?`}
                action={deleteDocument.bind(null, document.id)}
                className="shrink-0 text-sm text-accent hover:underline"
              >
                Eliminar
              </ConfirmDeleteRecordWithPassword>
            )}
          </li>
        );
      })}
    </ul>
  );
}
