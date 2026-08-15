import type { StationTankTechnicalSheet } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { CustomFieldItems } from "@/components/admin/CustomFieldInputs";
import {
  STATION_VALVE_FIELDS,
  stationValveLabels,
  getStationValveVencimiento,
  getStationValveAlertLevel,
} from "@/lib/station-valves";
import { valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { SECTION_STYLES } from "@/lib/section-colors";

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
export function StationTankTechnicalSheetView({
  sheet,
  camposExtra = [],
  valoresExtra = {},
}: {
  sheet: StationTankTechnicalSheet | null;
  camposExtra?: CustomFieldDef[];
  valoresExtra?: Record<string, string>;
}) {
  const tieneValvulas =
    !!sheet && (!!sheet.fechaInstalacionValvulas || STATION_VALVE_FIELDS.some((campo) => sheet[campo]));
  const vencimiento = sheet ? getStationValveVencimiento(sheet) : null;
  const valveAlertLevel = getStationValveAlertLevel(vencimiento);

  return (
    <div className="space-y-4">
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
        <CustomFieldItems campos={camposExtra} seccion="tanque" valores={valoresExtra} />
      </dl>

      {tieneValvulas && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.valvulas}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase text-primary-bright">Cambio de válvulas</h3>
            {valveAlertLevel !== "none" && vencimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[valveAlertLevel]}`}
              >
                {valveAlertLabel(valveAlertLevel, vencimiento)}
              </span>
            )}
          </div>
          {sheet?.fechaInstalacionValvulas && (
            <div className="mb-4 max-w-xs rounded-md border-2 border-primary/40 bg-primary/5 p-3">
              <dt className="text-xs font-semibold uppercase text-gray-500">
                Fecha de instalación del juego de válvulas
              </dt>
              <dd className="text-ink">{formatDate(sheet.fechaInstalacionValvulas)}</dd>
            </div>
          )}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STATION_VALVE_FIELDS.map((campo) => (
              <Item
                key={campo}
                label={stationValveLabels[campo]}
                value={sheet?.[campo] ? formatDate(sheet[campo]!) : null}
              />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
