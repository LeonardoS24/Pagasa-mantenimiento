import { asegurarPlazos } from "@/lib/requisitos-runtime";
import { prisma } from "@/lib/prisma";
import { daysUntil } from "@/lib/ultrasound-alerts";
import { isAlertVisibleForSection, type AlertType } from "@/lib/alert-visibility";
import {
  aniosVigenciaValvulas,
  getValveVencimiento,
  oldestValve,
  valveDatesFromSheet,
  valveLabels,
} from "@/lib/valve-alerts";
import { getHoseVencimiento, mangueraParaAlerta } from "@/lib/hose-alerts";
import {
  getStationValveVencimiento,
  oldestStationValve,
  stationValveFieldLabel,
} from "@/lib/station-valves";
import {
  PLANTA_INSTRUMENT_FIELDS,
  getPlantaInstrumentVencimiento,
  plantaInstrumentLabels,
} from "@/lib/planta-tank-instruments";
import { ESTACION_LIKE_SECTION_SLUGS } from "@/lib/estacion-sections";

// Todos los vencimientos con fecha del sistema en UNA lista plana, sin el
// recorte de 30 días de las alertas: es lo que alimenta el calendario y los
// reportes por correo. Usa las mismas fechas, plazos (catálogo de
// /admin/normas) y reglas de visibilidad que getAllVehicleAlerts
// (lib/vehicle-alerts-summary.ts); la prueba de que coinciden es que el nivel
// rojo/amarillo de cada tipo cuadra con los paneles de Inicio.
//
// El extintor no entra: su alerta es por estado ("calidad mala"), no por una
// fecha de vencimiento.
export type TipoVencimiento =
  | "ultrasonido"
  | "visualExterna"
  | "hermeticidad"
  | "visualInterna"
  | "hidrostatica"
  | "mantenimiento"
  | "valvulas"
  | "mangueras"
  | "poliza";

export const TIPOS_VENCIMIENTO: { tipo: TipoVencimiento; nombre: string }[] = [
  { tipo: "ultrasonido", nombre: "Ultrasonido" },
  { tipo: "visualExterna", nombre: "Inspección visual externa" },
  { tipo: "hermeticidad", nombre: "Prueba de hermeticidad" },
  { tipo: "visualInterna", nombre: "Inspección visual interna" },
  { tipo: "hidrostatica", nombre: "Prueba hidrostática" },
  { tipo: "mantenimiento", nombre: "Mantenimiento preventivo" },
  { tipo: "valvulas", nombre: "Cambio de válvulas" },
  { tipo: "mangueras", nombre: "Cambio de manguera" },
  { tipo: "poliza", nombre: "Póliza de seguro" },
];

export function nombreTipoVencimiento(tipo: TipoVencimiento): string {
  return TIPOS_VENCIMIENTO.find((t) => t.tipo === tipo)?.nombre ?? tipo;
}

// "ok" = falta más de 30 días. Mismos umbrales que las alertas: rojo a 7 días
// o menos (incluye vencido), amarillo a 30.
export type NivelVencimiento = "red" | "yellow" | "ok";

export function nivelDeDias(dias: number): NivelVencimiento {
  if (dias <= 7) return "red";
  if (dias <= 30) return "yellow";
  return "ok";
}

export type Vencimiento = {
  // Único en toda la lista (sirve de key en React).
  clave: string;
  tipo: TipoVencimiento;
  tipoNombre: string;
  vehicleId: string;
  numeroEconomico: string;
  sectionSlug: string;
  sectionName: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  dias: number;
  nivel: NivelVencimiento;
  // Qué tanque / qué válvula o instrumento, cuando hace falta distinguir.
  detalle?: string;
};

// Día de calendario (AAAA-MM-DD) de una fecha guardada. Las fechas del
// sistema se guardan a medianoche UTC, por eso se leen con getUTC*.
export function diaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export async function getVencimientos(cityIds: string[]): Promise<Vencimiento[]> {
  await asegurarPlazos();
  const registros = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    include: {
      technicalSheet: true,
      stationTankTechnicalSheets: true,
      insurancePolicyLogs: { orderBy: { fechaVencimiento: "desc" }, take: 1 },
      section: { include: { city: true } },
    },
  });

  const lista: Vencimiento[] = [];
  for (const r of registros) {
    const slug = r.section.slug;
    const esEstacion = (ESTACION_LIKE_SECTION_SLUGS as readonly string[]).includes(slug);
    const base = {
      vehicleId: r.id,
      numeroEconomico: r.numeroEconomico,
      sectionSlug: slug,
      sectionName: r.section.name,
      citySlug: r.section.city.slug,
      cityName: r.section.city.name,
    };
    const agregar = (tipo: TipoVencimiento, fecha: Date | null | undefined, detalle?: string) => {
      if (!fecha) return;
      const dias = daysUntil(fecha);
      lista.push({
        clave: `${tipo}:${r.id}:${detalle ?? ""}`,
        tipo,
        tipoNombre: nombreTipoVencimiento(tipo),
        ...base,
        fecha,
        dias,
        nivel: nivelDeDias(dias),
        detalle,
      });
    };
    const visible = (a: AlertType) => isAlertVisibleForSection(a, slug);

    // Las 5 pruebas periódicas: una estación/planta con más de un tanque las
    // lleva por tanque; en el resto salen de la ficha del registro.
    const variosTanques = esEstacion && r.stationTankTechnicalSheets.length > 1;
    const pruebas: [TipoVencimiento, AlertType, keyof NonNullable<typeof r.technicalSheet>][] = [
      ["ultrasonido", "ultrasonido", "fechaProximoUltrasonido"],
      ["visualExterna", "visualExterna", "fechaProximaInspeccionVisual"],
      ["hermeticidad", "hermeticidad", "fechaProximaPruebaHermeticidad"],
      ["visualInterna", "visualInterna", "fechaProximaInspeccionVisualInterna"],
      ["hidrostatica", "hidrostatica", "fechaProximaPruebaHidrostatica"],
    ];
    for (const [tipo, alerta, campo] of pruebas) {
      if (!visible(alerta)) continue;
      if (variosTanques) {
        for (const tanque of r.stationTankTechnicalSheets) {
          agregar(tipo, tanque[campo as keyof typeof tanque] as Date | null, tanque.etiqueta);
        }
      } else {
        agregar(tipo, r.technicalSheet?.[campo] as Date | null | undefined);
      }
    }

    if (visible("mantenimiento")) agregar("mantenimiento", r.technicalSheet?.fechaProximoMantenimiento);

    if (visible("valvulas")) {
      const dates = valveDatesFromSheet(r.technicalSheet);
      const masAntigua = oldestValve(dates);
      agregar(
        "valvulas",
        getValveVencimiento(dates, aniosVigenciaValvulas(slug)),
        masAntigua ? valveLabels[masAntigua.key] : undefined
      );
      if (esEstacion) {
        for (const tanque of r.stationTankTechnicalSheets) {
          const antigua = oldestStationValve(tanque);
          const nombre = antigua ? stationValveFieldLabel(antigua.key) : undefined;
          agregar(
            "valvulas",
            getStationValveVencimiento(tanque),
            variosTanques ? [tanque.etiqueta, nombre].filter(Boolean).join(" · ") : nombre
          );
          if (slug === "planta-ficha-tecnica") {
            for (const campo of PLANTA_INSTRUMENT_FIELDS) {
              agregar(
                "valvulas",
                getPlantaInstrumentVencimiento(tanque, campo),
                [variosTanques ? tanque.etiqueta : null, plantaInstrumentLabels[campo]].filter(Boolean).join(" · ")
              );
            }
          }
        }
      }
    }

    if (visible("mangueras")) {
      const manguera = mangueraParaAlerta(slug, r.technicalSheet);
      agregar("mangueras", getHoseVencimiento(manguera.fecha, manguera.anios));
    }

    // La póliza vigente es la de vencimiento más lejano (ver
    // getAllVehicleAlerts): la consulta ya viene ordenada así.
    if (visible("poliza")) agregar("poliza", r.insurancePolicyLogs[0]?.fechaVencimiento);
  }

  return lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}
