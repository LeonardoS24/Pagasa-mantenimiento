import Link from "next/link";
import type { AggregateVehicleRow } from "@/lib/aggregate-listings";
import { semaforoDotStyles, semaforoLabels } from "@/lib/vehicle-semaforo";
import { VehicleEstatusControl } from "./VehicleEstatusControl";

function VehicleRow({ record, isEstacion }: { record: AggregateVehicleRow; isEstacion: boolean }) {
  return (
    <tr
      className={`relative border-t border-gray-100 hover:bg-gray-50 ${!record.activo ? "bg-orange-50" : ""}`}
      title={!record.activo && record.motivoBaja ? `Motivo de la baja: ${record.motivoBaja}` : undefined}
    >
      <td className="whitespace-nowrap px-2 py-2">
        {record.semaforoLevel !== "none" && (
          <span
            className={`inline-block h-3 w-3 rounded-full ${semaforoDotStyles[record.semaforoLevel]}`}
            title={semaforoLabels[record.semaforoLevel]}
          />
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
        {/* Estira el link a toda la fila (no solo esta celda), mismo
            truco que VehicleTable.tsx. */}
        <Link
          href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
          className="absolute inset-0"
          aria-label={record.numeroEconomico}
        />
        <Link
          href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
          className="relative hover:underline"
          tabIndex={-1}
        >
          {record.numeroEconomico}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-ink">{record.cityName}</td>
      {isEstacion ? (
        <>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.permisionaria || "—"}</td>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.permiso || "—"}</td>
          <td className="max-w-xs whitespace-pre-wrap px-4 py-2 text-ink">{record.sucursal || "—"}</td>
        </>
      ) : (
        <>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.anio}</td>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
          <td className="whitespace-nowrap px-4 py-2 text-ink">{record.serie || "—"}</td>
          <td className="relative z-10 whitespace-nowrap px-4 py-2">
            <VehicleEstatusControl vehicleId={record.id} estatus={record.estatus} />
          </td>
        </>
      )}
    </tr>
  );
}

function VehicleTableHead({ isEstacion }: { isEstacion: boolean }) {
  return (
    <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
      <tr>
        <th className="whitespace-nowrap px-2 py-2" title="Semáforo de vencimientos próximos" aria-label="Semáforo">
          <span className="sr-only">Estado</span>
        </th>
        <th className="whitespace-nowrap px-4 py-2">{isEstacion ? "Nombre" : "Número económico"}</th>
        <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
        {isEstacion ? (
          <>
            <th className="whitespace-nowrap px-4 py-2">Permisionaria</th>
            <th className="whitespace-nowrap px-4 py-2">Permiso</th>
            <th className="whitespace-nowrap px-4 py-2">Dirección</th>
          </>
        ) : (
          <>
            <th className="whitespace-nowrap px-4 py-2">Marca</th>
            <th className="whitespace-nowrap px-4 py-2">Año</th>
            <th className="whitespace-nowrap px-4 py-2">Placas</th>
            <th className="whitespace-nowrap px-4 py-2">Número de serie</th>
            <th className="whitespace-nowrap px-4 py-2">Estatus</th>
          </>
        )}
      </tr>
    </thead>
  );
}

// Listado combinado de unidades de todas las ciudades reales, solo en
// Administración (ver lib/aggregate-city.ts y lib/aggregate-listings.ts):
// a diferencia de VehicleTable (una sola ciudad), cada fila dice de qué
// ciudad es. Las dadas de baja ya no se mezclan en la misma tabla: se ven
// como su propio apartado aparte, con su propio encabezado.
export function AggregateVehicleTable({
  records,
  sectionSlug,
}: {
  records: AggregateVehicleRow[];
  sectionSlug: string;
}) {
  // "Estaciones de carburación" y "Planta" (su hijo "planta-ficha-tecnica")
  // reutilizan numeroEconomico/sucursal como "Nombre"/"Dirección" (ver
  // components/city/VehicleTable.tsx, mismo criterio).
  const isEstacion = sectionSlug === "estaciones-de-carburacion" || sectionSlug === "planta-ficha-tecnica";

  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        {isEstacion
          ? "Todavía no hay estaciones registradas en ninguna ciudad para este apartado."
          : "Todavía no hay unidades registradas en ninguna ciudad para este apartado."}
      </p>
    );
  }

  const activos = records.filter((r) => r.activo);
  const inactivos = records.filter((r) => !r.activo);

  return (
    <div className="space-y-6">
      {activos.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <VehicleTableHead isEstacion={isEstacion} />
            <tbody>
              {activos.map((record) => (
                <VehicleRow key={record.id} record={record} isEstacion={isEstacion} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          {isEstacion ? "No hay estaciones activas." : "No hay unidades activas."}
        </p>
      )}

      {inactivos.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Dadas de baja
          </h3>
          <div className="overflow-x-auto rounded-lg border border-orange-200 bg-white">
            <table className="w-full text-left text-sm">
              <VehicleTableHead isEstacion={isEstacion} />
              <tbody>
                {inactivos.map((record) => (
                  <VehicleRow key={record.id} record={record} isEstacion={isEstacion} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
