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
      {documents.map((document) => (
        <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <a
            href={`/api/documents/${document.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
          >
            {document.fileName}
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
      ))}
    </ul>
  );
}
