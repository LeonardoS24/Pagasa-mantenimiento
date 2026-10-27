import { esTanqueDeCarga } from "@/lib/kino-sections";
import { FundamentoNormativo } from "@/components/normas/FundamentoNormativo";
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
import {
  aniosVigenciaValvulas,
  getValveAlertLevel,
  getValveVencimiento,
  valveAlertBadgeStyles,
  valveAlertLabel,
  valveDatesFromSheet,
} from "@/lib/valve-alerts";
import {
  VALVULAS_TANQUE_CARGA,
  VALVULAS_CARBURACION,
  VALVULA_MAXIMO_LLENADO_85,
  ACOPLAMIENTO_DESCONEXION_SECA,
  CAMPOS_TRACTOCAMION,
  CAMPOS_SEMIRREMOLQUE,
  type ValvulaDef,
} from "@/lib/ficha-campos";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";
import { SECTION_STYLES } from "@/lib/section-colors";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { CustomFieldItems } from "@/components/admin/CustomFieldInputs";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";
import { dictamenesDeApartado, getDictamenVencimiento, getDictamenAlertLevel, dictamenAlertLabel } from "@/lib/dictamen-alerts";

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// Fecha de fabricación de la válvula y, si se capturó, su número de serie.
function valvulaTexto(sheet: VehicleTechnicalSheet, valvula: ValvulaDef): string | null {
  const fecha = formatDate(sheet[valvula.fecha]);
  const codigo = sheet[valvula.codigo];
  if (fecha && codigo) return `${fecha} · No. de serie ${codigo}`;
  return fecha || (codigo ? `No. de serie ${codigo}` : null);
}

export function TechnicalSheetView({
  sheet,
  sectionSlug,
  useDeliveryFormat = false,
  showValveSection = false,
  showHoseSection = false,
  showTankSection = true,
  showTankNameplateSection = false,
  showInspeccionesSection = true,
  showMaintenancePreventiveSection = true,
  showAutomovilSection = true,
  showExtintorSection = true,
  showGobernadorSection = false,
  showTractocamionSection = false,
  showSemirremolqueSection = false,
  showUnidadAsignada = false,
  camposExtra = [],
  valoresExtra = {},
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
  // Solo Auto-Tanques: transcripción literal de la placa metálica del
  // tanque (ver comentario en prisma/schema.prisma).
  showTankNameplateSection?: boolean;
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
  // false solo para Vehículo con tanque de carburación cuando se imprime
  // junto con su pareja Auto-Tanques: es la misma unidad física, así que el
  // extintor (igual que el mantenimiento preventivo) solo se imprime una vez,
  // desde Auto-Tanques (ver imprimir/page.tsx y lib/alert-visibility.ts, que
  // ya trata a Auto-Tanques como el dueño del extintor en ese par).
  showExtintorSection?: boolean;
  // Ver TechnicalSheetForm (Auto-Tanques/Tractocamiones y Transportadora Kino).
  showGobernadorSection?: boolean;
  showTractocamionSection?: boolean;
  showSemirremolqueSection?: boolean;
  showUnidadAsignada?: boolean;
  // Recuadros extra agregados desde /admin/campos (ver lib/custom-fields.ts).
  camposExtra?: CustomFieldDef[];
  valoresExtra?: Record<string, string>;
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
  const valveDates = valveDatesFromSheet(sheet);
  const valveAlertLevel = getValveAlertLevel(valveDates, aniosVigenciaValvulas(sectionSlug));
  const valveVencimiento = getValveVencimiento(valveDates, aniosVigenciaValvulas(sectionSlug));
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
            <CustomFieldItems campos={camposExtra} seccion="automovil" valores={valoresExtra} />
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

      {showAutomovilSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            Chofer y póliza
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Chofer" value={sheet.chofer} />
            <Item label="Número de póliza" value={sheet.numeroPoliza} />
            <Item label="Inciso" value={sheet.inciso} />
            {showUnidadAsignada && (
              <Item
                label={showTractocamionSection ? "Semirremolques asignados" : "Tractocamión asignado"}
                value={sheet.unidadAsignada}
              />
            )}
            <CustomFieldItems campos={camposExtra} seccion="automovil" valores={valoresExtra} />
          </dl>
        </div>
      )}

      {showTractocamionSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Datos del tractocamión</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS_TRACTOCAMION.flatMap((grupo) => grupo.campos).map(({ campo, etiqueta }) => (
              <Item key={campo} label={etiqueta} value={sheet[campo]} />
            ))}
          </dl>
        </div>
      )}

      {showGobernadorSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Gobernador de velocidad</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="¿Tiene gobernador?" value={sheet.tieneGobernador ? "Sí" : "No"} />
            {sheet.tieneGobernador && (
              <>
                <Item label="Número de identificación" value={sheet.numeroGobernador} />
                <Item label="Empresa que lo instaló" value={sheet.empresaGobernador} />
              </>
            )}
          </dl>
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
            {showTankNameplateSection && (
              <>
                <Item label="Presión máxima de trabajo (kg/cm²)" value={sheet.placaPresionMaximaTrabajo} />
                <Item label="Temperatura de diseño (°C)" value={sheet.placaTemperaturaDiseno} />
                <Item label="Cabezales" value={sheet.placaCabezales} />
                <Item label="Diámetro exterior (m)" value={sheet.placaDiametroExterior} />
                <Item label="Longitud total (m)" value={sheet.placaLongitudTotal} />
                <Item label="Espesor mín. placa cuerpo (mm)" value={sheet.placaEspesorMinPlacaCuerpo} />
                <Item label="Material cuerpo" value={sheet.placaMaterialCuerpo} />
                <Item label="Espesor mín. placa cabeza (mm)" value={sheet.placaEspesorMinPlacaCabeza} />
                <Item label="Material cabeza" value={sheet.placaMaterialCabeza} />
                <Item label="Norma de fabricación" value={sheet.placaNormaFabricacion} />
                <Item label="D.T." value={sheet.placaDT} />
                <Item label="No. de serie propietario" value={sheet.placaNumeroSeriePropietario} />
                <Item label="Capacidad (%)" value={sheet.placaCapacidadPorcentaje} />
                <Item label="Capacidad (kg)" value={sheet.placaCapacidadKg} />
                <Item label="Tara (kg)" value={sheet.placaTara} />
                <Item label="Rayos X cuerpo (%)" value={sheet.placaRayosXCuerpo} />
                <Item label="Relevo (%)" value={sheet.placaRelevo} />
                <Item label="Rayos X cabeza (%)" value={sheet.placaRayosXCabeza} />
                <Item label="Presión de diseño (kg/cm²)" value={sheet.placaPresionDiseno} />
                <Item label="Fecha prueba original" value={sheet.placaFechaPruebaOriginal} />
                <Item label="Presión máxima de vapor (kg/cm²)" value={sheet.placaPresionMaximaVapor} />
                <Item label="Contenido" value={sheet.placaContenido} />
              </>
            )}
            <CustomFieldItems campos={camposExtra} seccion="tanque" valores={valoresExtra} />
          </dl>
        </div>
      )}

      {showSemirremolqueSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.tanque}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Datos del semirremolque</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS_SEMIRREMOLQUE.flatMap((grupo) => grupo.campos).map(({ campo, etiqueta }) => (
              <Item key={campo} label={etiqueta} value={sheet[campo]} />
            ))}
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
            <CustomFieldItems campos={camposExtra} seccion="mantenimiento" valores={valoresExtra} />
          </dl>
        </div>
      )}

      {showExtintorSection && (
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
            <CustomFieldItems campos={camposExtra} seccion="extintor" valores={valoresExtra} />
          </dl>
        </div>
      )}

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
          <FundamentoNormativo claves={["manguera-carburacion"]} className="mb-4" />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item
              label="Fecha de instalación"
              value={formatDate(sheet.fechaInstalacionMangueras) || null}
            />
            <Item
              label="Fecha de fabricación de la manguera"
              value={formatDate(sheet.fechaFabricacionManguera) || null}
            />
            <CustomFieldItems campos={camposExtra} seccion="mangueras" valores={valoresExtra} />
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
          <FundamentoNormativo
            claves={
              sectionSlug === "vehiculo-con-tanque-de-carburacion"
                ? ["valvulas-carburacion"]
                : esTanqueDeCarga(sectionSlug)
                  ? ["valvulas-tanque-carga", ...(sectionSlug === "auto-tanques" ? ["manguera-trasiego"] : [])]
                  : []
            }
            className="mb-4"
          />
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
              {VALVULAS_CARBURACION.map((valvula) => (
                <Item key={valvula.fecha} label={valvula.etiqueta} value={valvulaTexto(sheet, valvula)} />
              ))}
              <CustomFieldItems campos={camposExtra} seccion="valvulas" valores={valoresExtra} />
            </dl>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VALVULAS_TANQUE_CARGA.map((valvula) => (
                <Item
                  key={valvula.fecha}
                  label={valvula.entraEnAlerta ? valvula.etiqueta : `${valvula.etiqueta} (referencia)`}
                  value={valvulaTexto(sheet, valvula)}
                />
              ))}
              {sectionSlug === "auto-tanques" && sheet.fechaFabricacionAcoplamientoSeco && (
                <Item
                  label={ACOPLAMIENTO_DESCONEXION_SECA.etiqueta}
                  value={valvulaTexto(sheet, ACOPLAMIENTO_DESCONEXION_SECA)}
                />
              )}
              {sheet.tieneValvulaMaximoLlenado85 && (
                <Item
                  label={VALVULA_MAXIMO_LLENADO_85.etiqueta}
                  value={valvulaTexto(sheet, VALVULA_MAXIMO_LLENADO_85)}
                />
              )}
              <Item
                label="Manguera de surtir"
                value={
                  [formatDate(sheet.fechaFabricacionMangueraSurtir), sheet.medidaMangueraSurtir]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
              <Item label="Conector flexible (fabricación)" value={formatDate(sheet.fechaFabricacionConectorFlexible) || null} />
            </dl>
          )}
        </div>
      )}

      {dictamenesDeApartado(sectionSlug).some((d) => sheet[d.campo]) && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.valvulas}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Dictámenes (vigencia de 1 año)</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {dictamenesDeApartado(sectionSlug).map((d) => {
              const emision = sheet[d.campo];
              if (!emision) return null;
              const vence = getDictamenVencimiento(emision)!;
              const nivel = getDictamenAlertLevel(vence);
              return (
                <Item
                  key={d.campo}
                  label={d.nombre}
                  value={`Emitido ${formatDate(emision)} · ${nivel === "none" ? `vigente hasta ${formatDate(vence)}` : dictamenAlertLabel(nivel, vence)}`}
                />
              );
            })}
          </dl>
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
          <CustomFieldItems campos={camposExtra} seccion="visualExterna" valores={valoresExtra} />
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
          <CustomFieldItems campos={camposExtra} seccion="hermeticidad" valores={valoresExtra} />
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
          <CustomFieldItems campos={camposExtra} seccion="visualInterna" valores={valoresExtra} />
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
          <CustomFieldItems campos={camposExtra} seccion="ultrasonido" valores={valoresExtra} />
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
          <CustomFieldItems campos={camposExtra} seccion="hidrostatica" valores={valoresExtra} />
        </dl>
      </div>
      </>
      )}
    </div>
  );
}
