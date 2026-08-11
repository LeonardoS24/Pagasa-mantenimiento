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
import { SECTION_STYLES } from "@/lib/section-colors";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function TechnicalSheetView({
  sheet,
  sectionSlug,
  useDeliveryFormat = false,
  showValveSection = false,
  showHoseSection = false,
  showTankSection = true,
  showInspeccionesSection = true,
  showMaintenancePreventiveSection = true,
  showAutomovilSection = true,
}: {
  sheet: VehicleTechnicalSheet | null;
  // Para no repetir la alerta de extintor/mantenimiento preventivo cuando la
  // misma unidad vive también en Vehículo con tanque de carburación (ver
  // lib/alert-visibility.ts).
  sectionSlug: string;
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
  // false solo para Vehículo de reparto: sus 5 pruebas de tanque viven en
  // Auto-Tanques y en Vehículo con tanque de carburación.
  showInspeccionesSection?: boolean;
  // false solo para Vehículo con tanque de carburación: cuando la unidad se
  // repite en Auto-Tanques, el mantenimiento preventivo se lleva desde ahí
  // para no duplicarlo (ver también lib/alert-visibility.ts).
  showMaintenancePreventiveSection?: boolean;
  // false cuando esta ficha se imprime junto con la de su unidad pareja
  // (Auto-Tanques y Vehículo con tanque de carburación con el mismo número
  // económico): los datos del automóvil son el mismo vehículo físico, así
  // que solo se imprimen una vez (ver imprimir/page.tsx).
  showAutomovilSection?: boolean;
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
    fechaFabricacionValvulaNoRetroceso: sheet.fechaFabricacionValvulaNoRetroceso,
    fechaFabricacionValvulaBypass: sheet.fechaFabricacionValvulaBypass,
    fechaFabricacionValvulaRetornoVapores: sheet.fechaFabricacionValvulaRetornoVapores,
    fechaFabricacionValvulaServicio: sheet.fechaFabricacionValvulaServicio,
    fechaFabricacionValvulaMaximoLlenado: sheet.fechaFabricacionValvulaMaximoLlenado,
    fechaFabricacionValvulaMaximoLlenado85: sheet.fechaFabricacionValvulaMaximoLlenado85,
    fechaFabricacionValvulaAlivio: sheet.fechaFabricacionValvulaAlivio,
    fechaFabricacionValvulaDescargaEmergencia: sheet.fechaFabricacionValvulaDescargaEmergencia,
  };
  const valveAlertLevel = getValveAlertLevel(valveDates);
  const valveVencimiento = getValveVencimiento(valveDates);
  const hoseAlertLevel = getHoseAlertLevel(sheet.fechaFabricacionManguera);
  const hoseVencimiento = getHoseVencimiento(sheet.fechaFabricacionManguera);

  return (
    <div className="space-y-6">
      {showAutomovilSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
              <p className="text-xs font-semibold uppercase text-gray-500">
                Características especiales o técnicas
              </p>
              <p className="text-ink">{sheet.caracteristicas}</p>
            </div>
          )}
        </div>
      )}

      {showTankSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.tanque}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
              Mantenimiento preventivo
            </h3>
            {maintenanceAlertLevel !== "none" &&
              sheet.fechaProximoMantenimiento &&
              isAlertVisibleForSection("mantenimiento", sectionSlug) && (
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
              label="Kilometraje actual"
              value={
                sheet.kilometrajeUltimoMantenimiento != null
                  ? `${sheet.kilometrajeUltimoMantenimiento.toLocaleString("es-MX")} km`
                  : null
              }
            />
            <Item
              label="Fecha del último mantenimiento preventivo"
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
          <h3 className="text-sm font-semibold uppercase text-primary-bright">Extintor</h3>
          {extinguisherAlertLevel !== "none" && isAlertVisibleForSection("extintor", sectionSlug) && (
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
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
          {sheet.fechaInstalacionValvulas && (
            <div className="mb-4 max-w-xs rounded-md border-2 border-primary/40 bg-primary/5 p-3">
              <dt className="text-xs font-semibold uppercase text-gray-500">
                Fecha de instalación del juego de válvulas
              </dt>
              <dd className="text-ink">{formatDate(sheet.fechaInstalacionValvulas)}</dd>
            </div>
          )}
          {sectionSlug === "vehiculo-con-tanque-de-carburacion" ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Item
                label="Válvula de llenado (Doble check)"
                value={formatDate(sheet.fechaFabricacionValvulaLlenado) || null}
              />
              <Item
                label="Válvula de máximo llenado (purgador)"
                value={formatDate(sheet.fechaFabricacionValvulaMaximoLlenado) || null}
              />
              <Item
                label="Válvula de servicio (reguladora)"
                value={formatDate(sheet.fechaFabricacionValvulaServicio) || null}
              />
              <Item
                label="Válvula de seguridad"
                value={formatDate(sheet.fechaFabricacionValvulaAlivio) || null}
              />
            </dl>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Item
                label="Válvula de llenado"
                value={formatDate(sheet.fechaFabricacionValvulaLlenado) || null}
              />
              <Item
                label="Válvula de no retroceso (check)"
                value={formatDate(sheet.fechaFabricacionValvulaNoRetroceso) || null}
              />
              <Item
                label="Válvula de retroceso (bypass)"
                value={formatDate(sheet.fechaFabricacionValvulaBypass) || null}
              />
              <Item
                label="Válvula de retorno de vapores"
                value={formatDate(sheet.fechaFabricacionValvulaRetornoVapores) || null}
              />
              <Item
                label="Válvula de servicio de vapor"
                value={formatDate(sheet.fechaFabricacionValvulaServicio) || null}
              />
              <Item
                label="Válvula de máximo llenado 90%"
                value={formatDate(sheet.fechaFabricacionValvulaMaximoLlenado) || null}
              />
              {sheet.tieneValvulaMaximoLlenado85 && (
                <Item
                  label="Válvula de máximo llenado 85%"
                  value={formatDate(sheet.fechaFabricacionValvulaMaximoLlenado85) || null}
                />
              )}
              <Item
                label="Válvula de seguridad"
                value={formatDate(sheet.fechaFabricacionValvulaAlivio) || null}
              />
              <Item
                label="Válvula de descarga de emergencia"
                value={formatDate(sheet.fechaFabricacionValvulaDescargaEmergencia) || null}
              />
            </dl>
          )}
        </div>
      )}

      {showInspeccionesSection && (
      <>
      <div className={`rounded-md p-4 ${SECTION_STYLES.visualExterna}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
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
      </>
      )}
    </div>
  );
}
