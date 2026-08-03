import type { VehicleTechnicalSheet } from "@prisma/client";
import { combustibleLabels, calidadExtintorLabels, type Combustible, type CalidadExtintor } from "@/lib/vehicle-enums";
import { formatDate } from "@/lib/dates";
import {
  getExtinguisherAlertLevel,
  extinguisherAlertBadgeStyles,
  extinguisherAlertLabel,
} from "@/lib/extinguisher-alerts";
import {
  getUltrasoundAlertLevel,
  ultrasoundAlertBadgeStyles,
  ultrasoundAlertLabel,
} from "@/lib/ultrasound-alerts";
import {
  getVisualInspectionAlertLevel,
  visualInspectionAlertBadgeStyles,
  visualInspectionAlertLabel,
} from "@/lib/visual-inspection-alerts";
import {
  getTightnessTestAlertLevel,
  tightnessTestAlertBadgeStyles,
  tightnessTestAlertLabel,
} from "@/lib/tightness-test-alerts";
import {
  getInternalVisualInspectionAlertLevel,
  internalVisualInspectionAlertBadgeStyles,
  internalVisualInspectionAlertLabel,
} from "@/lib/internal-visual-inspection-alerts";
import {
  getHydrostaticTestAlertLevel,
  hydrostaticTestAlertBadgeStyles,
  hydrostaticTestAlertLabel,
} from "@/lib/hydrostatic-test-alerts";

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function TechnicalSheetView({
  sheet,
  useDeliveryFormat = false,
}: {
  sheet: VehicleTechnicalSheet | null;
  // Formato para Vehículo de reparto y Vehículo con tanque de carburación:
  // dos pesos brutos en vez de "Peso" y "Tanque de carburación" en vez de
  // "Tanque" (ver TechnicalSheetForm).
  useDeliveryFormat?: boolean;
}) {
  if (!sheet) {
    return <p className="text-sm text-ink">Sin ficha técnica registrada.</p>;
  }

  const alertLevel = getUltrasoundAlertLevel(sheet.fechaProximoUltrasonido);
  const visualAlertLevel = getVisualInspectionAlertLevel(sheet.fechaProximaInspeccionVisual);
  const tightnessAlertLevel = getTightnessTestAlertLevel(sheet.fechaProximaPruebaHermeticidad);
  const internalVisualAlertLevel = getInternalVisualInspectionAlertLevel(
    sheet.fechaProximaInspeccionVisualInterna
  );
  const hydrostaticAlertLevel = getHydrostaticTestAlertLevel(sheet.fechaProximaPruebaHidrostatica);
  const extinguisherAlertLevel = getExtinguisherAlertLevel(
    sheet.calidadExtintor,
    sheet.fechaCalidadMalaExtintor
  );

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
          {useDeliveryFormat ? (
            <>
              <Item label="Peso bruto de unidad vacía" value={sheet.pesoBrutoVacio} />
              <Item label="Peso bruto de unidad con peso máximo" value={sheet.pesoBrutoMaximo} />
            </>
          ) : (
            <Item label="Peso" value={sheet.peso} />
          )}
          <Item label="Serie" value={sheet.serie} />
          <Item
            label="Combustible"
            value={sheet.combustible ? combustibleLabels[sheet.combustible as Combustible] : null}
          />
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Extintor</h3>
          {extinguisherAlertLevel !== "none" && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${extinguisherAlertBadgeStyles[extinguisherAlertLevel]}`}
            >
              {extinguisherAlertLabel(extinguisherAlertLevel, sheet.fechaCalidadMalaExtintor)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item
            label="Fecha de instalación"
            value={formatDate(sheet.fechaInstalacionExtintor) || null}
          />
          <Item
            label="Fecha de vencimiento"
            value={formatDate(sheet.fechaVencimientoExtintor) || null}
          />
          <Item
            label="Calidad"
            value={
              sheet.calidadExtintor
                ? calidadExtintorLabels[sheet.calidadExtintor as CalidadExtintor]
                : null
            }
          />
        </dl>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {useDeliveryFormat ? "Tanque de carburación" : "Tanque"}
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Serie de tanque" value={sheet.serieTanque} />
          <Item label="Capacidad" value={sheet.capacidadTanque} />
          <Item label="Marca de tanque" value={sheet.marcaTanque} />
          <Item label="Año de fabricación" value={sheet.anioFabricacionTanque} />
          <Item label="Fecha de fabricación" value={formatDate(sheet.fechaFabricacionTanque) || null} />
          <Item label="Número de serie" value={sheet.numeroSerieTanque} />
        </dl>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Ultrasonido
          </h3>
          {alertLevel !== "none" && sheet.fechaProximoUltrasonido && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${ultrasoundAlertBadgeStyles[alertLevel]}`}
            >
              {ultrasoundAlertLabel(alertLevel, sheet.fechaProximoUltrasonido)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inspección Visual Externa
          </h3>
          {visualAlertLevel !== "none" && sheet.fechaProximaInspeccionVisual && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${visualInspectionAlertBadgeStyles[visualAlertLevel]}`}
            >
              {visualInspectionAlertLabel(visualAlertLevel, sheet.fechaProximaInspeccionVisual)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Número de última inspección visual externa" value={sheet.numeroUltimaInspeccionVisual} />
          <Item
            label="Fecha en que se realizó la última inspección visual externa"
            value={formatDate(sheet.ultimaInspeccionVisual) || null}
          />
          <Item
            label="Fecha próxima de inspección visual externa"
            value={formatDate(sheet.fechaProximaInspeccionVisual) || null}
          />
        </dl>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Prueba de Hermeticidad
          </h3>
          {tightnessAlertLevel !== "none" && sheet.fechaProximaPruebaHermeticidad && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${tightnessTestAlertBadgeStyles[tightnessAlertLevel]}`}
            >
              {tightnessTestAlertLabel(tightnessAlertLevel, sheet.fechaProximaPruebaHermeticidad)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Número de última prueba de hermeticidad" value={sheet.numeroUltimaPruebaHermeticidad} />
          <Item
            label="Fecha en que se realizó la última prueba de hermeticidad"
            value={formatDate(sheet.ultimaPruebaHermeticidad) || null}
          />
          <Item
            label="Fecha próxima de prueba de hermeticidad"
            value={formatDate(sheet.fechaProximaPruebaHermeticidad) || null}
          />
        </dl>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inspección Visual Interna
          </h3>
          {internalVisualAlertLevel !== "none" && sheet.fechaProximaInspeccionVisualInterna && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${internalVisualInspectionAlertBadgeStyles[internalVisualAlertLevel]}`}
            >
              {internalVisualInspectionAlertLabel(
                internalVisualAlertLevel,
                sheet.fechaProximaInspeccionVisualInterna
              )}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item
            label="Número de última inspección visual interna"
            value={sheet.numeroUltimaInspeccionVisualInterna}
          />
          <Item
            label="Fecha en que se realizó la última inspección visual interna"
            value={formatDate(sheet.ultimaInspeccionVisualInterna) || null}
          />
          <Item
            label="Fecha próxima de inspección visual interna"
            value={formatDate(sheet.fechaProximaInspeccionVisualInterna) || null}
          />
        </dl>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Prueba Hidrostática
          </h3>
          {hydrostaticAlertLevel !== "none" && sheet.fechaProximaPruebaHidrostatica && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${hydrostaticTestAlertBadgeStyles[hydrostaticAlertLevel]}`}
            >
              {hydrostaticTestAlertLabel(hydrostaticAlertLevel, sheet.fechaProximaPruebaHidrostatica)}
            </span>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Número de última prueba hidrostática" value={sheet.numeroUltimaPruebaHidrostatica} />
          <Item
            label="Fecha en que se realizó la última prueba hidrostática"
            value={formatDate(sheet.ultimaPruebaHidrostatica) || null}
          />
          <Item
            label="Fecha próxima de prueba hidrostática"
            value={formatDate(sheet.fechaProximaPruebaHidrostatica) || null}
          />
        </dl>
      </div>
    </div>
  );
}
