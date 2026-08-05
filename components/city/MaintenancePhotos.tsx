import type { Document } from "@prisma/client";
import { deleteDocument } from "@/actions/document-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

// Separadas de la lista genérica de PDF: son fotos, así que se muestran como
// miniaturas en vez de un enlace de descarga, y "antes"/"después" van fijos
// uno junto al otro para poder comparar de un vistazo.
function Photo({ label, document }: { label: string; document: Document | undefined }) {
  if (!document) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
        Sin foto de {label.toLowerCase()}
      </div>
    );
  }

  return (
    <div>
      <a href={`/api/documents/${document.id}`} target="_blank" rel="noopener noreferrer">
        <img
          src={`/api/documents/${document.id}`}
          alt={label}
          className="h-32 w-full rounded-md border border-gray-200 object-cover"
        />
      </a>
    </div>
  );
}

export function MaintenancePhotos({
  documents,
  isAdmin,
}: {
  documents: Document[];
  isAdmin: boolean;
}) {
  const fotoAntes = documents.find((d) => d.kind === "ANTES");
  const fotoDespues = documents.find((d) => d.kind === "DESPUES");

  if (!fotoAntes && !fotoDespues) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
        Fotos del mantenimiento
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Antes", document: fotoAntes },
          { label: "Después", document: fotoDespues },
        ].map(({ label, document }) => (
          <div key={label} className="space-y-1">
            <p className="text-xs font-medium text-ink">{label}</p>
            <Photo label={label} document={document} />
            {document && isAdmin && (
              <form action={deleteDocument.bind(null, document.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar la foto de "${label.toLowerCase()}"?`}
                  className="text-xs text-accent hover:underline"
                >
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
