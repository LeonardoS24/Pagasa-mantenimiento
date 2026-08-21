import type { StationTankTechnicalSheet } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { CustomFieldItems } from "@/components/admin/CustomFieldInputs";
import {
  STATION_VALVE_FIELDS,
  stationValveLabels,
  getStationValveVencimiento,
  getStationValveAlertLevel,
  cantidadValvulasSeguridad,
} from "@/lib/station-valves";
import {
  PLANTA_INSTRUMENT_FIELDS,
  plantaInstrumentLabels,
  instrumentFabricacionField,
  instrumentCambioField,
  instrumentInstalacionField,
  getPlantaInstrumentVencimiento,
  getPlantaInstrumentAlertLevel,
} from "@/lib/planta-tank-instruments";
import { valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { SECTION_STYLES } from "@/lib/section-colors";
import { getVisualInspectionAlertLevel, visualInspectionAlertBadgeStyles, visualInspectionAlertLabel } from "@/lib/visual-inspection-alerts";
import { getTightnessTestAlertLevel, tightnessTestAlertBadgeStyles, tightnessTestAlertLabel } from "@/lib/tightness-test-alerts";
import { getInternalVisualInspectionAlertLevel, internalVisualInspectionAlertBadgeStyles, internalVisualInspectionAlertLabel } from "@/lib/internal-visual-inspection-alerts";
import { getUltrasoundAlertLevel, ultrasoundAlertBadgeStyles, ultrasoundAlertLabel } from "@/lib/ultrasound-alerts";
import { getHydrostaticTestAlertLevel, hydrostaticTestAlertBadgeStyles, hydrostaticTestAlertLabel } from "@/lib/hydrostatic-test-alerts";

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
  isPlanta = false,
  showInspecciones = false,
}: {
  sheet: StationTankTechnicalSheet | null;
  camposExtra?: CustomFieldDef[];
  valoresExtra?: Record<string, string>;
  isPlanta?: boolean;
  // Con más de un tanque, las 5 pruebas periódicas se muestran aquí, por
  // tanque (ver el mismo prop en StationTankTechnicalSheetForm.tsx).
  showInspecciones?: boolean;
}) {
  const tieneValvulas =
    !!sheet &&
    (!!sheet.fechaInstalacionValvulas ||
      STATION_VALVE_FIELDS.some((campo) => sheet[campo]) ||
      !!sheet.fechaFabricacionValvulaSeguridad2 ||
      !!sheet.fechaFabricacionValvulaSeguridad3);
  const vencimiento = sheet ? getStationValveVencimiento(sheet) : null;
  const valveAlertLevel = getStationValveAlertLevel(vencimiento);
  const tieneInstrumentos =
    !!sheet &&
    PLANTA_INSTRUMENT_FIELDS.some(
      (campo) =>
        sheet[instrumentFabricacionField(campo)] ||
        sheet[instrumentCambioField(campo)] ||
        sheet[instrumentInstalacionField(campo)]
    );

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

      {isPlanta
        ? tieneInstrumentos && (
            <div className={`rounded-md p-4 ${SECTION_STYLES.valvulas}`}>
              <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
                Válvulas e instrumentos del tanque
              </h3>
              <div className="space-y-4">
                {PLANTA_INSTRUMENT_FIELDS.map((campo) => {
                  const instrumentoVencimiento = sheet ? getPlantaInstrumentVencimiento(sheet, campo) : null;
                  const instrumentoAlertLevel = getPlantaInstrumentAlertLevel(instrumentoVencimiento);
                  const fabricacion = sheet?.[instrumentFabricacionField(campo)];
                  const cambio = sheet?.[instrumentCambioField(campo)];
                  const instalacion = sheet?.[instrumentInstalacionField(campo)];
                  if (!fabricacion && !cambio && !instalacion) return null;
                  return (
                    <div key={campo} className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-medium text-ink">{plantaInstrumentLabels[campo]}</h4>
                        {instrumentoAlertLevel !== "none" && instrumentoVencimiento && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[instrumentoAlertLevel]}`}
                          >
                            {valveAlertLabel(instrumentoAlertLevel, instrumentoVencimiento)}
                          </span>
                        )}
                      </div>
                      <dl className="grid gap-3 sm:grid-cols-3">
                        <Item label="Fecha de fabricación" value={fabricacion ? formatDate(fabricacion) : null} />
                        <Item label="Fecha de cambio" value={cambio ? formatDate(cambio) : null} />
                        <Item label="Fecha de instalación" value={instalacion ? formatDate(instalacion) : null} />
                      </dl>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                La vigencia real de cada instrumento depende de lo que indique el fabricante en su
                hoja de especificaciones; los 5 años son un ciclo de referencia, no un límite fijo.
              </p>
            </div>
          )
        : tieneValvulas && (
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
                {STATION_VALVE_FIELDS.filter((campo) => campo !== "fechaFabricacionValvulaSeguridad").map(
                  (campo) => (
                    <Item
                      key={campo}
                      label={stationValveLabels[campo]}
                      value={sheet?.[campo] ? formatDate(sheet[campo]!) : null}
                    />
                  )
                )}
                {sheet &&
                  Array.from({ length: cantidadValvulasSeguridad(sheet) }, (_, i) => i + 1).map((n) => {
                    const fecha =
                      n === 1
                        ? sheet.fechaFabricacionValvulaSeguridad
                        : n === 2
                          ? sheet.fechaFabricacionValvulaSeguridad2
                          : sheet.fechaFabricacionValvulaSeguridad3;
                    const cantidad = cantidadValvulasSeguridad(sheet);
                    return (
                      <Item
                        key={`seguridad-${n}`}
                        label={cantidad > 1 ? `Válvula de seguridad ${n}` : "Válvula de seguridad"}
                        value={fecha ? formatDate(fecha) : null}
                      />
                    );
                  })}
              </dl>
              <p className="mt-3 text-xs text-gray-500">
                La vigencia real del juego de válvulas depende de lo que indique el fabricante en su
                hoja de especificaciones; los 5 años son un ciclo de referencia, no un límite fijo.
              </p>
            </div>
          )}

      {showInspecciones && sheet && (
        <>
          {(() => {
            const visualAlertLevel = getVisualInspectionAlertLevel(sheet.fechaProximaInspeccionVisual);
            const tightnessAlertLevel = getTightnessTestAlertLevel(sheet.fechaProximaPruebaHermeticidad);
            const internalVisualAlertLevel = getInternalVisualInspectionAlertLevel(
              sheet.fechaProximaInspeccionVisualInterna
            );
            const ultrasoundAlertLevel = getUltrasoundAlertLevel(sheet.fechaProximoUltrasonido);
            const hydrostaticAlertLevel = getHydrostaticTestAlertLevel(sheet.fechaProximaPruebaHidrostatica);
            return (
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
                      value={sheet.ultimaInspeccionVisual ? formatDate(sheet.ultimaInspeccionVisual) : null}
                    />
                    <Item
                      label="Fecha próxima de inspección visual externa"
                      value={sheet.fechaProximaInspeccionVisual ? formatDate(sheet.fechaProximaInspeccionVisual) : null}
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
                      value={sheet.ultimaPruebaHermeticidad ? formatDate(sheet.ultimaPruebaHermeticidad) : null}
                    />
                    <Item
                      label="Fecha próxima de prueba de hermeticidad"
                      value={sheet.fechaProximaPruebaHermeticidad ? formatDate(sheet.fechaProximaPruebaHermeticidad) : null}
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
                      value={
                        sheet.ultimaInspeccionVisualInterna ? formatDate(sheet.ultimaInspeccionVisualInterna) : null
                      }
                    />
                    <Item
                      label="Fecha próxima de inspección visual interna"
                      value={
                        sheet.fechaProximaInspeccionVisualInterna
                          ? formatDate(sheet.fechaProximaInspeccionVisualInterna)
                          : null
                      }
                    />
                  </dl>
                </div>

                <div className={`rounded-md p-4 ${SECTION_STYLES.ultrasonido}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase text-primary-bright">Ultrasonido</h3>
                    {ultrasoundAlertLevel !== "none" && sheet.fechaProximoUltrasonido && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${ultrasoundAlertBadgeStyles[ultrasoundAlertLevel]}`}
                      >
                        {ultrasoundAlertLabel(ultrasoundAlertLevel, sheet.fechaProximoUltrasonido)}
                      </span>
                    )}
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Item label="Número de último ultrasonido" value={sheet.numeroUltimoUltrasonido} />
                    <Item
                      label="Fecha en que se realizó el último ultrasonido"
                      value={sheet.ultimoUltrasonido ? formatDate(sheet.ultimoUltrasonido) : null}
                    />
                    <Item
                      label="Fecha próxima de ultrasonido"
                      value={sheet.fechaProximoUltrasonido ? formatDate(sheet.fechaProximoUltrasonido) : null}
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
                      value={sheet.ultimaPruebaHidrostatica ? formatDate(sheet.ultimaPruebaHidrostatica) : null}
                    />
                    <Item
                      label="Fecha próxima de prueba hidrostática"
                      value={
                        sheet.fechaProximaPruebaHidrostatica ? formatDate(sheet.fechaProximaPruebaHidrostatica) : null
                      }
                    />
                  </dl>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
