import type { StationTankTechnicalSheet } from "@prisma/client";
import { formatDate } from "@/lib/dates";

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// Vista de solo lectura de StationTankTechnicalSheetForm, para USUARIO (que
// puede ver la ficha técnica del tanque pero no editarla) y para la hoja de
// impresión.
export function StationTankTechnicalSheetView({ sheet }: { sheet: StationTankTechnicalSheet | null }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Item label="Número de serie" value={sheet?.numeroSerie} />
      <Item label="Marca" value={sheet?.marca} />
      <Item label="Modelo" value={sheet?.modelo} />
      <Item label="Tipo" value={sheet?.tipo} />
      <Item label="Año de fabricación" value={sheet?.anioFabricacion} />
      <Item label="Fecha de fabricación" value={sheet?.fechaFabricacion ? formatDate(sheet.fechaFabricacion) : null} />
      <Item label="Capacidad (lts)" value={sheet?.capacidad} />
      <Item label="Presión de diseño" value={sheet?.presionDiseno} />
      <Item label="Longitud total" value={sheet?.longitudTotal} />
      <Item label="Forma de la cabeza" value={sheet?.formaCabeza} />
      <Item label="Espesor nominal del cuerpo" value={sheet?.espesorNominalCuerpo} />
      <Item label="Espesor nominal de la cabeza" value={sheet?.espesorNominalCabeza} />
      <Item label="Material del cuerpo" value={sheet?.materialCuerpo} />
      <Item label="Material cabeza" value={sheet?.materialCabeza} />
      <Item label="Diámetro interior" value={sheet?.diametroInterior} />
      <Item label="Tara" value={sheet?.tara} />
    </dl>
  );
}
