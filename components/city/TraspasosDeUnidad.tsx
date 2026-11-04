import { formatDate } from "@/lib/dates";

type Traspaso = {
  id: string;
  origenCiudadNombre: string;
  destinoCiudadNombre: string;
  motivo: string | null;
  username: string;
  createdAt: Date;
};

// Historial de ciudades de la unidad (ver TraspasoUnidad): de dónde a dónde,
// cuándo, quién y por qué. Solo se muestra si la unidad ha cambiado de ciudad.
export function TraspasosDeUnidad({ traspasos }: { traspasos: Traspaso[] }) {
  if (traspasos.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Historial de ciudades</h2>
      <ul className="space-y-2 text-sm text-ink">
        {traspasos.map((traspaso) => (
          <li key={traspaso.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <p>
              <span className="font-medium">{formatDate(traspaso.createdAt)}</span> · Estuvo en{" "}
              <span className="font-medium">{traspaso.origenCiudadNombre}</span> y pasó a{" "}
              <span className="font-medium">{traspaso.destinoCiudadNombre}</span>
            </p>
            <p className="text-xs text-gray-500">
              Por {traspaso.username}
              {traspaso.motivo ? ` · ${traspaso.motivo}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
