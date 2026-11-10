import { prisma } from "./prisma";
import { getVencimientos, type TipoVencimiento, type Vencimiento } from "./vencimientos";
import { getNormasVigentes, getRequisitos } from "./requisitos-runtime";
import { NORMAS_VIGENTES, type NormaVigente, type RequisitoVigente } from "./requisitos-normativos";
import { DICTAMENES } from "./dictamen-alerts";
import { esTanqueDeCarga } from "./kino-sections";

// Expediente de cumplimiento normativo (página /ciudades/[ciudad]/expediente):
// por cada unidad, qué le pide la norma, con qué fundamento, cuándo vence,
// en qué estado está y qué documento lo respalda. Es lo que pediría una
// unidad de verificación o una visita de la ASEA.
//
// Sale de getVencimientos (las mismas fechas y plazos que las alertas) más
// los requisitos que DEBERÍAN tener fecha y no la tienen ("sin dato"): un
// hueco en la captura es un hueco en el expediente, no algo que se esconda.

export type EstadoRequisito = "vencido" | "porVencer" | "vigente" | "sinDato";

export type ElementoExpediente = {
  clave: string;
  requisito: string;
  detalle?: string;
  fundamento: string;
  // Lo que dice la norma (cita corta del catálogo), para quien audita; en las
  // alertas y la ficha solo va la norma y el plazo.
  queDice: string | null;
  vence: Date | null;
  dias: number | null;
  estado: EstadoRequisito;
  // Último registro de ese tipo en la bitácora de la unidad y cuántos
  // documentos tiene adjuntos (la evidencia).
  ultimoRegistro: Date | null;
  documentos: number;
};

export type ExpedienteUnidad = {
  id: string;
  numeroEconomico: string;
  sectionSlug: string;
  sectionName: string;
  cityName: string;
  citySlug: string;
  datos: string; // marca/año/placas, o dirección en estaciones
  elementos: ElementoExpediente[];
  conteo: Record<EstadoRequisito, number>;
};

const NOMBRE_TIPO: Record<TipoVencimiento, string> = {
  ultrasonido: "Medición de espesores por ultrasonido",
  visualExterna: "Inspección visual externa",
  hermeticidad: "Prueba de hermeticidad",
  visualInterna: "Inspección visual interna",
  hidrostatica: "Prueba hidrostática",
  mantenimiento: "Mantenimiento preventivo",
  valvulas: "Vida útil de válvulas",
  mangueras: "Vida útil de manguera",
  dictamen: "Dictamen",
  poliza: "Póliza de seguro",
  propia: "Alerta agregada",
};

// El catálogo junta en un requisito las dos normas cuando aplican a tipos de
// unidad distintos: "NOM-EM-009 (Auto-Tanques) y NOM-EM-008 (Semirremolques)",
// "6.3.2 (Auto-Tanques) · Tabla 3 (Semirremolques)". En el expediente de una
// unidad solo va la parte que le aplica.
export function citaPara(norma: string, numeral: string, slug: string): string {
  const etiqueta =
    slug === "auto-tanques" ? "Auto-Tanques" : slug === "semirremolques" || slug === "tractocamiones" ? "Semirremolques" : null;
  const escoger = (texto: string, separador: RegExp) => {
    if (!etiqueta) return texto;
    const partes = texto.split(separador).map((t) => t.trim());
    const mia = partes.find((t) => t.includes(`(${etiqueta})`));
    return mia ? mia.replace(` (${etiqueta})`, "").replace(`(${etiqueta})`, "").trim() : texto;
  };
  return `${escoger(norma, / y (?=NOM)/)}, ${escoger(numeral, / · /)}`;
}


// La cita del requisito cuyo fundamento (norma y numeral) es este texto.
function queDice(texto: string, slug: string, req: Map<string, RequisitoVigente>): string | null {
  for (const r of req.values()) if (citaPara(r.norma, r.numeral, slug) === texto) return r.cita || null;
  return null;
}

// Las normas que rigen hoy, como las dejó el ADMIN en /admin/normas. Se fija
// al empezar getExpediente (las funciones de abajo son síncronas).
let normasVigentes: NormaVigente[] = NORMAS_VIGENTES;

function normaDeArea(slug: string): string {
  const clave =
    slug === "planta-ficha-tecnica"
      ? "plantas"
      : slug === "estaciones-de-carburacion"
        ? "estaciones"
        : slug === "semirremolques" || slug === "tractocamiones"
          ? "transporte"
          : slug === "auto-tanques"
            ? "distribucion"
            : slug === "vehiculo-con-tanque-de-carburacion"
              ? "carburacion"
              : null;
  return normasVigentes.find((n) => n.clave === clave)?.norma ?? "Criterio interno de mantenimiento";
}

// Con qué requisito del catálogo se fundamenta cada tipo de vencimiento,
// según el tipo de unidad.
function fundamento(tipo: TipoVencimiento, slug: string, detalle: string | undefined, req: Map<string, RequisitoVigente>): string {
  const de = (clave: string) => {
    const r = req.get(clave);
    return r ? citaPara(r.norma, r.numeral, slug) : null;
  };
  const tanqueCarga = esTanqueDeCarga(slug);
  switch (tipo) {
    case "ultrasonido":
      if (tanqueCarga) return de("pruebas-periodicas-tanque") ?? normaDeArea(slug);
      if (slug === "estaciones-de-carburacion") return de("recipiente-estacion-espesores") ?? normaDeArea(slug);
      if (slug === "vehiculo-con-tanque-de-carburacion") return de("dictamen-espesores") ?? normaDeArea(slug);
      return normaDeArea(slug);
    case "visualExterna":
    case "hermeticidad":
    case "visualInterna":
    case "hidrostatica":
      return tanqueCarga ? de("pruebas-periodicas-tanque") ?? normaDeArea(slug) : normaDeArea(slug);
    case "valvulas":
      if (tanqueCarga) return de("valvulas-tanque-carga") ?? normaDeArea(slug);
      if (slug === "vehiculo-con-tanque-de-carburacion") return de("valvulas-carburacion") ?? normaDeArea(slug);
      if (slug === "estaciones-de-carburacion") return de("valvulas-estacion") ?? normaDeArea(slug);
      if (slug === "planta-ficha-tecnica") {
        return (/exceso|relevo/i.test(detalle ?? "") ? de("valvulas-planta") : de("instrumentos-planta")) ?? normaDeArea(slug);
      }
      return normaDeArea(slug);
    case "mangueras":
      if (/conector/i.test(detalle ?? "")) return de("conectores-flexibles") ?? normaDeArea(slug);
      if (slug === "auto-tanques") return de("manguera-trasiego") ?? normaDeArea(slug);
      if (slug === "estaciones-de-carburacion") return de("manguera-estacion") ?? normaDeArea(slug);
      return de("manguera-carburacion") ?? normaDeArea(slug);
    case "dictamen": {
      const campo = DICTAMENES.find((d) => d.nombre === detalle)?.campo;
      if (campo === "fechaDictamenOperacion") return de("dictamen-operacion-mantenimiento") ?? normaDeArea(slug);
      if (campo === "fechaDictamenNom068") return "NOM-EM-008-ASEA-2026, 7.5.3 (dictamen NOM-068-SCT-2-2014)";
      if (campo === "fechaDictamenInstalacion") return de("dictamen-instalacion") ?? normaDeArea(slug);
      if (campo === "fechaDictamenEstacion") return de("dictamen-estacion") ?? normaDeArea(slug);
      return normaDeArea(slug);
    }
    case "mantenimiento":
      return slug === "vehiculo-con-tanque-de-carburacion" || slug === "vehiculo-de-reparto"
        ? de("mantenimiento-preventivo") ?? normaDeArea(slug)
        : "Programa interno de mantenimiento";
    case "poliza":
      return "Requisito de operación del vehículo";
    case "propia":
      return "Criterio interno (alerta agregada)";
  }
}

// Lo que cada tipo de unidad DEBE tener con fecha. Si falta, sale "sin dato".
// Conservador a propósito: solo lo que aplica con seguridad a ese tipo.
function requisitosEsperados(slug: string): { tipo: TipoVencimiento; detalle?: string }[] {
  const dictamenes = DICTAMENES.filter((d) => d.apartados.includes(slug)).map((d) => ({ tipo: "dictamen" as const, detalle: d.nombre }));
  if (slug === "auto-tanques" || slug === "semirremolques") {
    return [
      { tipo: "ultrasonido" },
      { tipo: "visualExterna" },
      { tipo: "hermeticidad" },
      { tipo: "visualInterna" },
      { tipo: "hidrostatica" },
      { tipo: "valvulas" },
      ...(slug === "auto-tanques" ? [{ tipo: "mangueras" as const }] : []),
      { tipo: "mangueras", detalle: "Conector flexible" },
      ...dictamenes,
      { tipo: "poliza" },
    ];
  }
  if (slug === "vehiculo-con-tanque-de-carburacion") return [{ tipo: "valvulas" }, { tipo: "mangueras" }, ...dictamenes];
  if (slug === "vehiculo-de-reparto") return [{ tipo: "mantenimiento" }, { tipo: "poliza" }];
  if (slug === "tractocamiones") return [...dictamenes, { tipo: "poliza" }];
  if (slug === "estaciones-de-carburacion") return [{ tipo: "valvulas" }, { tipo: "mangueras" }, ...dictamenes];
  return [];
}

function estadoDe(dias: number | null): EstadoRequisito {
  if (dias === null) return "sinDato";
  if (dias < 0) return "vencido";
  if (dias <= 30) return "porVencer";
  return "vigente";
}

type Evidencia = Map<string, { fecha: Date | null; documentos: number }>; // `${vehicleId}|${tipo}`

// El registro más reciente de cada bitácora por unidad, con sus documentos.
async function evidencias(ids: string[]): Promise<Evidencia> {
  const mapa: Evidencia = new Map();
  const poner = (vehicleId: string, tipo: TipoVencimiento, fecha: Date | null, documentos: number) => {
    const clave = `${vehicleId}|${tipo}`;
    const actual = mapa.get(clave);
    if (!actual || (fecha && (!actual.fecha || fecha > actual.fecha))) mapa.set(clave, { fecha, documentos });
  };
  const donde = { vehicleRecordId: { in: ids } };
  const docs = { select: { documents: true } } as const;
  const [us, ve, he, vi, hi, va, ma, po, mt] = await Promise.all([
    prisma.ultrasoundLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.visualInspectionLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.tightnessTestLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.internalVisualInspectionLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.hydrostaticTestLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.valveChangeLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaInstalacion: true, _count: docs } }),
    prisma.hoseChangeLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaInstalacion: true, _count: docs } }),
    prisma.insurancePolicyLog.findMany({ where: donde, select: { vehicleRecordId: true, fechaRealizacion: true, _count: docs } }),
    prisma.maintenanceLog.findMany({ where: donde, select: { vehicleRecordId: true, fecha: true, _count: docs } }),
  ]);
  for (const r of us) poner(r.vehicleRecordId, "ultrasonido", r.fechaRealizacion, r._count.documents);
  for (const r of ve) poner(r.vehicleRecordId, "visualExterna", r.fechaRealizacion, r._count.documents);
  for (const r of he) poner(r.vehicleRecordId, "hermeticidad", r.fechaRealizacion, r._count.documents);
  for (const r of vi) poner(r.vehicleRecordId, "visualInterna", r.fechaRealizacion, r._count.documents);
  for (const r of hi) poner(r.vehicleRecordId, "hidrostatica", r.fechaRealizacion, r._count.documents);
  for (const r of va) poner(r.vehicleRecordId, "valvulas", r.fechaInstalacion, r._count.documents);
  for (const r of ma) poner(r.vehicleRecordId, "mangueras", r.fechaInstalacion, r._count.documents);
  for (const r of po) poner(r.vehicleRecordId, "poliza", r.fechaRealizacion, r._count.documents);
  for (const r of mt) poner(r.vehicleRecordId, "mantenimiento", r.fecha, r._count.documents);
  // Dictámenes: el PDF va como documento suelto de la unidad; se cuentan los
  // que dicen "dictamen" en el nombre.
  const dictamenes = await prisma.document.findMany({
    where: { vehicleRecordId: { in: ids }, fileName: { contains: "dictamen" } },
    select: { vehicleRecordId: true, createdAt: true },
  });
  for (const d of dictamenes) if (d.vehicleRecordId) {
    const clave = `${d.vehicleRecordId}|dictamen`;
    const actual = mapa.get(clave);
    mapa.set(clave, { fecha: actual?.fecha && actual.fecha > d.createdAt ? actual.fecha : d.createdAt, documentos: (actual?.documentos ?? 0) + 1 });
  }
  return mapa;
}

export async function getExpediente(
  cityIds: string[],
  filtro: { apartado?: string; unidad?: string } = {}
): Promise<ExpedienteUnidad[]> {
  const [registros, vencimientos, requisitos] = await Promise.all([
    prisma.vehicleRecord.findMany({
      where: {
        activo: true,
        section: { cityId: { in: cityIds }, ...(filtro.apartado ? { slug: filtro.apartado } : {}) },
        ...(filtro.unidad ? { id: filtro.unidad } : {}),
      },
      include: { section: { include: { city: true } } },
      orderBy: [{ section: { city: { order: "asc" } } }, { section: { order: "asc" } }, { numeroEconomico: "asc" }],
    }),
    getVencimientos(cityIds),
    getRequisitos(),
  ]);
  normasVigentes = await getNormasVigentes();
  const req = new Map(requisitos.map((r) => [r.clave, r]));
  const ids = registros.map((r) => r.id);
  const evid = await evidencias(ids);
  const porUnidad = new Map<string, Vencimiento[]>();
  for (const v of vencimientos) porUnidad.set(v.vehicleId, [...(porUnidad.get(v.vehicleId) ?? []), v]);

  return registros.map((r) => {
    const slug = r.section.slug;
    const lista = porUnidad.get(r.id) ?? [];
    const elementos: ElementoExpediente[] = lista.map((v) => {
      const e = evid.get(`${r.id}|${v.tipo}`);
      return {
        clave: v.clave,
        requisito: v.tipo === "propia" ? v.tipoNombre : v.tipo === "dictamen" && v.detalle ? v.detalle : NOMBRE_TIPO[v.tipo],
        detalle: v.tipo === "dictamen" || v.tipo === "propia" ? undefined : v.detalle,
        fundamento: v.tipo === "propia" ? v.fundamento ?? "Criterio interno (alerta agregada)" : fundamento(v.tipo, slug, v.detalle, req),
        queDice: v.tipo === "propia" ? null : queDice(fundamento(v.tipo, slug, v.detalle, req), slug, req),
        vence: v.fecha,
        dias: v.dias,
        estado: estadoDe(v.dias),
        ultimoRegistro: e?.fecha ?? null,
        documentos: e?.documentos ?? 0,
      };
    });
    // Lo que debería tener fecha y no la tiene.
    for (const esperado of requisitosEsperados(slug)) {
      const hay = lista.some(
        (v) =>
          v.tipo === esperado.tipo &&
          (esperado.detalle === undefined ? !(esperado.tipo === "mangueras" && /conector/i.test(v.detalle ?? "")) : v.detalle === esperado.detalle)
      );
      if (hay) continue;
      const e = evid.get(`${r.id}|${esperado.tipo}`);
      elementos.push({
        clave: `falta:${esperado.tipo}:${esperado.detalle ?? ""}`,
        requisito: esperado.tipo === "dictamen" && esperado.detalle ? esperado.detalle : NOMBRE_TIPO[esperado.tipo],
        detalle: esperado.tipo === "dictamen" ? undefined : esperado.detalle,
        fundamento: fundamento(esperado.tipo, slug, esperado.detalle, req),
        queDice: queDice(fundamento(esperado.tipo, slug, esperado.detalle, req), slug, req),
        vence: null,
        dias: null,
        estado: "sinDato",
        ultimoRegistro: e?.fecha ?? null,
        documentos: e?.documentos ?? 0,
      });
    }
    const orden: Record<EstadoRequisito, number> = { vencido: 0, porVencer: 1, sinDato: 2, vigente: 3 };
    elementos.sort((a, b) => orden[a.estado] - orden[b.estado] || (a.vence?.getTime() ?? 0) - (b.vence?.getTime() ?? 0));
    const conteo: Record<EstadoRequisito, number> = { vencido: 0, porVencer: 0, vigente: 0, sinDato: 0 };
    for (const e of elementos) conteo[e.estado]++;
    const esEstacion = slug === "estaciones-de-carburacion" || slug === "planta-ficha-tecnica";
    return {
      id: r.id,
      numeroEconomico: r.numeroEconomico,
      sectionSlug: slug,
      sectionName: r.section.name,
      cityName: r.section.city.name,
      citySlug: r.section.city.slug,
      datos: esEstacion ? r.sucursal ?? "" : [r.sucursal, r.anio, r.placas].filter(Boolean).join(" · "),
      elementos,
      conteo,
    };
  });
}
