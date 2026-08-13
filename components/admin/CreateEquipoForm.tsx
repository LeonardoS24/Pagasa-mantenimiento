import { createEquipo } from "@/actions/equipo-actions";
import { EquipoForm } from "./EquipoForm";

export function CreateEquipoForm({
  sectionId,
  vehicleRecordId = null,
}: {
  sectionId: string;
  // Solo cuando el equipo pertenece a una Estación de carburación en
  // particular, no a los "Equipos de planta" a nivel ciudad (ver
  // Equipo.vehicleRecordId en el schema).
  vehicleRecordId?: string | null;
}) {
  const action = createEquipo.bind(null, sectionId, vehicleRecordId);

  return (
    <details className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">Agregar equipo</summary>
      <div className="mt-3">
        <EquipoForm action={action} submitLabel="Agregar equipo" allowFiles />
      </div>
    </details>
  );
}
