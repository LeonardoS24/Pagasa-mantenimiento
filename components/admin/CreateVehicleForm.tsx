import { createVehicleRecord } from "@/actions/vehicle-actions";
import { VehicleForm } from "./VehicleForm";

export function CreateVehicleForm({
  sectionId,
  sectionSlug,
}: {
  sectionId: string;
  sectionSlug: string;
}) {
  const action = createVehicleRecord.bind(null, sectionId);
  const isEstacion = sectionSlug === "estaciones-de-carburacion";

  return (
    <details className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        {isEstacion ? "Agregar estación" : "Agregar número económico"}
      </summary>
      <div className="mt-3">
        <VehicleForm action={action} submitLabel="Agregar" isEstacion={isEstacion} />
      </div>
    </details>
  );
}
