import { prisma } from "./prisma";
import { daysUntil } from "./ultrasound-alerts";
import {
  ALERTAS_DE_FABRICA,
  REGISTROS_PARA_ALERTAS,
  anclaDeCampo,
  anclaDeCampoFicha,
  leerApartados,
  leerFechaDeCampo,
  nivelDeAlertaPropia,
  vencimientoDeAlertaPropia,
  type TipoAlertaFabrica,
} from "./alertas-catalogo";
import { getRequisitos } from "./requisitos-runtime";

// Lo que el ADMIN cambió de las alertas (ver lib/alertas-catalogo.ts).

export type ConfigAlertas = {
  activa: Record<TipoAlertaFabrica, boolean>;
  titulo: Record<TipoAlertaFabrica, string>;
};

export async function getConfigAlertas(): Promise<ConfigAlertas> {
  const ajustes = new Map((await prisma.alertaAjuste.findMany()).map((a) => [a.tipo, a]));
  const activa = {} as Record<TipoAlertaFabrica, boolean>;
  const titulo = {} as Record<TipoAlertaFabrica, string>;
  for (const a of ALERTAS_DE_FABRICA) {
    const ajuste = ajustes.get(a.tipo);
    activa[a.tipo] = ajuste?.activa ?? true;
    titulo[a.tipo] = ajuste?.nombre || a.nombre;
  }
  return { activa, titulo };
}

// Una alerta agregada que toca a una unidad. `dias` < 0 = vencida.
export type AlertaPropiaCalculada = {
  alertaId: string;
  alertaNombre: string;
  fundamento: string | null;
  id: string;
  numeroEconomico: string;
  sectionSlug: string;
  sectionName: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  vencimiento: Date;
  dias: number;
  level: "red" | "yellow" | "none";
  ancla: string;
};

type Registro = {
  id: string;
  numeroEconomico: string;
  section: { slug: string; name: string; city: { slug: string; name: string } };
};

// Todas las alertas agregadas activas, con su vencimiento en cada unidad
// (aunque falte mucho: `level` "none"). Las pantallas de alertas se quedan
// con las rojas y amarillas; el calendario y el tablero, con todas.
export async function calcularAlertasPropias(cityIds: string[]): Promise<AlertaPropiaCalculada[]> {
  const alertas = await prisma.alertaPropia.findMany({ where: { activa: true }, orderBy: { createdAt: "asc" } });
  if (alertas.length === 0 || cityIds.length === 0) return [];

  const requisitos = new Map((await getRequisitos({ incluirQuitados: true })).map((r) => [r.clave, r]));
  const salida: AlertaPropiaCalculada[] = [];

  for (const alerta of alertas) {
    const apartados = leerApartados(alerta.apartados);
    if (apartados.length === 0) continue;
    const req = alerta.requisitoClave ? requisitos.get(alerta.requisitoClave) : undefined;
    const fundamento = req ? `${req.norma}${req.numeral ? `, ${req.numeral}` : ""}` : null;
    const donde = { activo: true, section: { cityId: { in: cityIds }, slug: { in: apartados } } };
    const incluirSeccion = { section: { select: { slug: true, name: true, city: { select: { slug: true, name: true } } } } };

    // Fecha que vigila esta alerta en cada unidad.
    const fechas: { r: Registro; fecha: Date; ancla: string }[] = [];

    if (alerta.fuente === "CAMPO") {
      const campo = await prisma.customField.findUnique({ where: { id: alerta.fuenteClave } });
      if (!campo) continue;
      const valores = await prisma.customFieldValue.findMany({
        where: { fieldId: campo.id, vehicleRecord: donde },
        include: { vehicleRecord: { select: { id: true, numeroEconomico: true, ...incluirSeccion } } },
      });
      for (const v of valores) {
        const fecha = leerFechaDeCampo(v.valor);
        if (fecha) fechas.push({ r: v.vehicleRecord, fecha, ancla: anclaDeCampo(campo.seccion) });
      }
    } else if (alerta.fuente === "FICHA") {
      const campo = alerta.fuenteClave;
      const registros = await prisma.vehicleRecord.findMany({
        where: donde,
        select: { id: true, numeroEconomico: true, ...incluirSeccion, technicalSheet: true },
      });
      for (const r of registros) {
        const valor = (r.technicalSheet as Record<string, unknown> | null)?.[campo];
        if (valor instanceof Date) fechas.push({ r, fecha: valor, ancla: anclaDeCampoFicha(campo) });
      }
    } else if (alerta.fuente === "REGISTRO") {
      const reg = REGISTROS_PARA_ALERTAS.find((x) => x.clave === alerta.fuenteClave);
      if (!reg) continue;
      for (const { r, fecha } of await ultimoRegistro(alerta.fuenteClave, donde, incluirSeccion)) {
        fechas.push({ r, fecha, ancla: reg.ancla });
      }
    }

    for (const { r, fecha, ancla } of fechas) {
      const vencimiento = vencimientoDeAlertaPropia(fecha, alerta);
      const dias = daysUntil(vencimiento);
      salida.push({
        alertaId: alerta.id,
        alertaNombre: alerta.nombre,
        fundamento,
        id: r.id,
        numeroEconomico: r.numeroEconomico,
        sectionSlug: r.section.slug,
        sectionName: r.section.name,
        citySlug: r.section.city.slug,
        cityName: r.section.city.name,
        fecha,
        vencimiento,
        dias,
        level: nivelDeAlertaPropia(dias, alerta.diasAviso),
        ancla,
      });
    }
  }
  return salida;
}

// Fecha del registro más reciente de una bitácora, por unidad.
async function ultimoRegistro(
  clave: string,
  donde: object,
  incluirSeccion: object
): Promise<{ r: Registro; fecha: Date }[]> {
  const base = { id: true, numeroEconomico: true, ...incluirSeccion };
  const uno = { take: 1 } as const;
  const registros = (await prisma.vehicleRecord.findMany({
    where: donde,
    select: {
      ...base,
      ...(clave === "mantenimiento" && { maintenanceLogs: { ...uno, orderBy: { fecha: "desc" }, select: { fecha: true } } }),
      ...(clave === "extintor" && { extinguisherChangeLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "extintorVencimiento" && { extinguisherChangeLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaVencimiento: true } } }),
      ...(clave === "mangueras" && { hoseChangeLogs: { ...uno, orderBy: { fechaInstalacion: "desc" }, select: { fechaInstalacion: true } } }),
      ...(clave === "valvulas" && { valveChangeLogs: { ...uno, orderBy: { fechaInstalacion: "desc" }, select: { fechaInstalacion: true } } }),
      ...(clave === "valvulasCorrectivo" && { valveCorrectiveMaintenanceLogs: { ...uno, orderBy: { fecha: "desc" }, select: { fecha: true } } }),
      ...(clave === "visualExterna" && { visualInspectionLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "hermeticidad" && { tightnessTestLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "visualInterna" && { internalVisualInspectionLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "ultrasonido" && { ultrasoundLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "hidrostatica" && { hydrostaticTestLogs: { ...uno, orderBy: { fechaRealizacion: "desc" }, select: { fechaRealizacion: true } } }),
      ...(clave === "polizaVencimiento" && { insurancePolicyLogs: { ...uno, orderBy: { fechaVencimiento: "desc" }, select: { fechaVencimiento: true } } }),
      ...(clave === "sellos" && { sealLogs: { ...uno, orderBy: { fechaInstalacion: "desc" }, select: { fechaInstalacion: true } } }),
    },
  })) as unknown as (Registro & Record<string, unknown>)[];

  const salida: { r: Registro; fecha: Date }[] = [];
  for (const r of registros) {
    for (const valor of Object.values(r)) {
      if (!Array.isArray(valor) || valor.length === 0) continue;
      const fila = valor[0] as Record<string, unknown>;
      const fecha = Object.values(fila).find((x): x is Date => x instanceof Date);
      if (fecha) salida.push({ r, fecha });
    }
  }
  return salida;
}
