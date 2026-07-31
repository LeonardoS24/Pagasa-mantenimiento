import type { VehicleTechnicalSheet } from "@prisma/client";
import { combustibleLabels, type Combustible } from "@/lib/vehicle-enums";
import { formatDate } from "@/lib/dates";
import {
  getUltrasoundAlertLevel,
  ultrasoundAlertBadgeStyles,
  ultrasoundAlertLabel,
} from "@/lib/ultrasound-alerts";

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function TechnicalSheetView({ sheet }: { sheet: VehicleTechnicalSheet | null }) {
  if (!sheet) {
    return <p className="text-sm text-ink">Sin ficha técnica registrada.</p>;
  }

  const alertLevel = getUltrasoundAlertLevel(sheet.fechaProximoUltrasonido);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Automóvil
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Fabricante" value={sheet.fabricante} />
          <Item label="Marca" value={sheet.marca} />
          <Item label="Línea" value={sheet.linea} />
          <Item label="Modelo" value={sheet.modelo} />
          <Item label="Peso" value={sheet.peso} />
          <Item label="Serie" value={sheet.serie} />
          <Item
            label="Combustible"
            value={sheet.combustible ? combustibleLabels[sheet.combustible as Combustible] : null}
          />
          <Item label="Ubicación" value={sheet.ubicacion} />
          <Item label="Potencia" value={sheet.potencia} />
          <Item label="Horas de uso diario" value={sheet.horasUsoDiario} />
          <Item label="Fecha de adquisición" value={formatDate(sheet.fechaAdquisicion) || null} />
        </dl>
        {sheet.caracteristicas && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Características especiales o técnicas
            </p>
            <p className="text-ink">{sheet.caracteristicas}</p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Tanque</h3>
          {alertLevel !== "none" && sheet.fechaProximoUltrasonido && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${ultrasoundAlertBadgeStyles[alertLevel]}`}
            >
              {ultrasoundAlertLabel(alertLevel, sheet.fechaProximoUltrasonido)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Serie de tanque" value={sheet.serieTanque} />
          <Item label="Capacidad" value={sheet.capacidadTanque} />
          <Item label="Marca de tanque" value={sheet.marcaTanque} />
          <Item label="Año de fabricación" value={sheet.anioFabricacionTanque} />
          <Item label="Número de serie" value={sheet.numeroSerieTanque} />
          <Item label="Número de último ultrasonido" value={sheet.numeroUltimoUltrasonido} />
          <Item
            label="Fecha en que se realizó el último ultrasonido"
            value={formatDate(sheet.ultimoUltrasonido) || null}
          />
          <Item
            label="Fecha próxima de ultrasonido"
            value={formatDate(sheet.fechaProximoUltrasonido) || null}
          />
        </dl>
      </div>
    </div>
  );
}
