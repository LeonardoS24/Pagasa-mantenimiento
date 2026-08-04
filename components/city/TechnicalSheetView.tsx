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
import {
  getMaintenanceAlertLevel,
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
} from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";

// Mismo acento de color por subsección que TechnicalSheetForm, para que la
// vista de solo lectura (LECTOR/USUARIO) se distinga igual de fácil.
const SECTION_STYLES = {
  automovil: "border-l-4 border-l-slate-400 bg-slate-50/60",
  extintor: "border-l-4 border-l-red-400 bg-red-50/60",
  mantenimiento: "border-l-4 border-l-emerald-400 bg-emerald-50/60",
  tanque: "border-l-4 border-l-sky-400 bg-sky-50/60",
  mangueras: "border-l-4 border-l-amber-400 bg-amber-50/60",
  valvulas: "border-l-4 border-l-indigo-400 bg-indigo-50/60",
  ultrasonido: "border-l-4 border-l-cyan-400 bg-cyan-50/60",
  visualExterna: "border-l-4 border-l-purple-400 bg-purple-50/60",
  hermeticidad: "border-l-4 border-l-fuchsia-400 bg-fuchsia-50/60",
  visualInterna: "border-l-4 border-l-violet-400 bg-violet-50/60",
  hidrostatica: "border-l-4 border-l-blue-400 bg-blue-50/60",
} as const;

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
  showValveSection = false,
  showHoseSection = false,
  showTankSection = true,
  showMaintenancePreventiveSection = true,
}: {
  sheet: VehicleTechnicalSheet | null;
  // Formato para Vehículo de reparto y Vehículo con tanque de carburación:
  // dos pesos brutos en vez de "Peso" y "Tanque de carburación" en vez de
  // "Tanque" (ver TechnicalSheetForm).
  useDeliveryFormat?: boolean;
  // Solo Vehículo con tanque de carburación (no Vehículo de reparto).
  showValveSection?: boolean;
  // Solo Vehículo con tanque de carburación.
  showHoseSection?: boolean;
  // false solo para Vehículo de reparto: no tiene tanque.
  showTankSection?: boolean;
  // false solo para Auto-Tanques.
  showMaintenancePreventiveSection?: boolean;
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
  const maintenanceAlertLevel = getMaintenanceAlertLevel(sheet.fechaProximoMantenimiento);
  const valveDates = {
    fechaFabricacionValvulaLlenado: sheet.fechaFabricacionValvulaLlenado,
    fechaFabricacionValvulaServicio: sheet.fechaFabricacionValvulaServicio,
    fechaFabricacionValvulaMaximoLlenado: sheet.fechaFabricacionValvulaMaximoLlenado,
    fechaFabricacionValvulaAlivio: sheet.fechaFabricacionValvulaAlivio,
  };
  const valveAlertLevel = getValveAlertLevel(valveDates);
  const valveVencimiento = getValveVencimiento(valveDates);
  const hoseAlertLevel = getHoseAlertLevel(sheet.fechaFabricacionManguera);
  const hoseVencimiento = getHoseVencimiento(sheet.fechaFabricacionManguera);

  return (
    <div className="space-y-6">
      <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
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

      {showTankSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.tanque}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {useDeliveryFormat ? "Tanque de carburación" : "Tanque"}
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Número de serie" value={sheet.numeroSerieTanque} />
            <Item label="Capacidad (Lts)" value={sheet.capacidadTanque} />
            <Item label="Marca de tanque" value={sheet.marcaTanque} />
            <Item label="Año de fabricación" value={sheet.anioFabricacionTanque} />
            <Item label="Fecha de fabricación" value={formatDate(sheet.fechaFabricacionTanque) || null} />
          </dl>
        </div>
      )}

      {showMaintenancePreventiveSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.mantenimiento}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Mantenimiento preventivo
            </h3>
            {maintenanceAlertLevel !== "none" && sheet.fechaProximoMantenimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceAlertBadgeStyles[maintenanceAlertLevel]}`}
              >
                {maintenanceAlertLabel(
                  maintenanceAlertLevel,
                  sheet.fechaProximoMantenimiento,
                  sheet.kilometrajeProximoMantenimiento
                )}
              </span>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item
              label="Kilometraje del último mantenimiento"
              value={
                sheet.kilometrajeUltimoMantenimiento != null
                  ? `${sheet.kilometrajeUltimoMantenimiento.toLocaleString("es-MX")} km`
                  : null
              }
            />
            <Item
              label="Fecha del último mantenimiento"
              value={formatDate(sheet.fechaUltimoMantenimiento) || null}
            />
            <Item
              label="Próximo mantenimiento preventivo"
              value={
                sheet.fechaProximoMantenimiento
                  ? `${formatDate(sheet.fechaProximoMantenimiento)}${
                      sheet.kilometrajeProximoMantenimiento != null
                        ? ` o a los ${sheet.kilometrajeProximoMantenimiento.toLocaleString("es-MX")} km`
                        : ""
                    }`
                  : null
              }
            />
          </dl>
        </div>
      )}

      <div className={`rounded-md p-4 ${SECTION_STYLES.extintor}`}>
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

      {showHoseSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.mangueras}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Cambio de mangueras
            </h3>
            {hoseAlertLevel !== "none" && hoseVencimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${hoseAlertBadgeStyles[hoseAlertLevel]}`}
              >
                {hoseAlertLabel(hoseAlertLevel, hoseVencimiento)}
              </span>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item
              label="Fecha de instalación"
              value={formatDate(sheet.fechaInstalacionMangueras) || null}
            />
            <Item
              label="Fecha de fabricación de la manguera"
              value={formatDate(sheet.fechaFabricacionManguera) || null}
            />
          </dl>
        </div>
      )}

      {showValveSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.valvulas}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Cambio de válvulas
            </h3>
            {valveAlertLevel !== "none" && valveVencimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[valveAlertLevel]}`}
              >
                {valveAlertLabel(valveAlertLevel, valveVencimiento)}
              </span>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item
              label="Fecha de instalación"
              value={formatDate(sheet.fechaInstalacionValvulas) || null}
            />
            <Item
              label="Válvula de llenado"
              value={formatDate(sheet.fechaFabricacionValvulaLlenado) || null}
            />
            <Item
              label="Válvula de servicio"
              value={formatDate(sheet.fechaFabricacionValvulaServicio) || null}
            />
            <Item
              label="Válvula de máximo llenado"
              value={formatDate(sheet.fechaFabricacionValvulaMaximoLlenado) || null}
            />
            <Item
              label="Válvula de alivio (seguridad)"
              value={formatDate(sheet.fechaFabricacionValvulaAlivio) || null}
            />
          </dl>
        </div>
      )}

      <div className={`rounded-md p-4 ${SECTION_STYLES.visualExterna}`}>
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

      <div className={`rounded-md p-4 ${SECTION_STYLES.hermeticidad}`}>
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

      <div className={`rounded-md p-4 ${SECTION_STYLES.visualInterna}`}>
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

      <div className={`rounded-md p-4 ${SECTION_STYLES.ultrasonido}`}>
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

      <div className={`rounded-md p-4 ${SECTION_STYLES.hidrostatica}`}>
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
