import Link from "next/link";
import { semaforoDotStyles, semaforoLabels, type SemaforoLevel } from "@/lib/vehicle-semaforo";

export interface PlantaCardData {
  id: string;
  numeroEconomico: string;
  permisionaria: string | null;
  permiso: string | null;
  sucursal: string;
  activo: boolean;
  motivoBaja: string | null;
  semaforoLevel: SemaforoLevel;
  citySlug: string;
  cityName?: string;
}

function PlantaCard({ record }: { record: PlantaCardData }) {
  return (
    <div
      className={`relative rounded-lg border p-4 hover:bg-gray-50 ${
        record.activo ? "border-gray-200 bg-white" : "border-orange-200 bg-orange-50"
      }`}
    >
      <Link
        href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
        className="absolute inset-0"
        aria-label={record.numeroEconomico}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {record.semaforoLevel !== "none" && (
          <span
            className={`inline-block h-3 w-3 rounded-full ${semaforoDotStyles[record.semaforoLevel]}`}
            title={semaforoLabels[record.semaforoLevel]}
          />
        )}
        <Link
          href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
          className="relative font-medium text-primary hover:underline"
          tabIndex={-1}
        >
          {record.numeroEconomico}
        </Link>
        {record.cityName && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {record.cityName}
          </span>
        )}
        {!record.activo && (
          <span
            className="rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"
            title={record.motivoBaja ? `Motivo: ${record.motivoBaja}` : undefined}
          >
            Dado de baja
          </span>
        )}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-gray-500">Permisionaria</dt>
          <dd className="text-ink">{record.permisionaria || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-gray-500">Permiso</dt>
          <dd className="text-ink">{record.permiso || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase text-gray-500">Dirección</dt>
          <dd className="whitespace-pre-wrap text-ink">{record.sucursal || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

// Reemplaza el listado tipo tabla (VehicleTable/AggregateVehicleTable) solo
// para "Planta" (planta-ficha-tecnica): como es una sola por ciudad, no
// tiene caso obligar a entrar a una tabla de un solo renglón para ver sus
// datos — el recuadro ya trae el nombre y todo lo que antes se veía en el
// listado (Permisionaria/Permiso/Dirección), y da clic directo a la ficha.
export function PlantaCardGrid({ records }: { records: PlantaCardData[] }) {
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay planta registrada en este apartado.
      </p>
    );
  }

  const activas = records.filter((r) => r.activo);
  const inactivas = records.filter((r) => !r.activo);

  return (
    <div className="space-y-6">
      {activas.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activas.map((record) => (
            <PlantaCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          No hay planta activa.
        </p>
      )}

      {inactivas.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Dadas de baja</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactivas.map((record) => (
              <PlantaCard key={record.id} record={record} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
