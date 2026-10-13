// Llena las válvulas, la manguera de surtir, el gobernador y los dictámenes
// de ultrasonido de las unidades con el Excel de flotilla que se levantó en
// campo ("Flotilla Pagasa - Unidades_1.xlsx", que es la descarga de Excel
// del propio sistema con esas columnas agregadas a mano).
//
// Se corre en la computadora que tiene los datos reales (ver DESPLIEGUE.md),
// después de `npx prisma migrate deploy`:
//
//     npx tsx scripts/importar-valvulas-flotilla.mts "D:\Flotilla Pagasa - Unidades_1.xlsx"
//     npx tsx scripts/importar-valvulas-flotilla.mts "D:\Flotilla Pagasa - Unidades_1.xlsx" --apply
//
// Sin --apply solo simula e imprime qué haría.
//
// Reglas:
// - Solo llena campos VACÍOS. Si la base ya tiene un valor distinto al del
//   Excel, no lo pisa: lo reporta para revisarlo a mano (puede ser un cambio
//   de válvulas registrado después de levantar el Excel).
// - La columna "Fecha de fabricación" de cada válvula trae solo el año. El
//   mes se toma del código grabado cuando tiene la forma mes + lote + año
//   ("03C26" = marzo 2026) y el año coincide; si no, se usa el 1 de enero de
//   ese año. Es la opción conservadora: la alerta (5 años desde la más
//   antigua, ver lib/valve-alerts.ts) avisa antes, nunca después.
// - Una unidad se busca por ciudad + número económico dentro de su apartado.
//   Si no existe, se DA DE ALTA con los datos generales y de ficha de su fila
//   (así lo que viene en el Excel no se pierde); si la fila no trae ciudad,
//   no hay dónde darla de alta y se reporta. Si coinciden varias, se reporta
//   y se salta para no llenar la equivocada.
import XLSX from "xlsx";
import { prisma } from "../lib/prisma";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const EXCEL = args.find((a) => !a.startsWith("--"));
if (!EXCEL) {
  console.error('Uso: npx tsx scripts/importar-valvulas-flotilla.mts "<ruta del Excel>" [--apply]');
  process.exit(1);
}

type Fila = Record<string, string>;

const HOJAS: { prefijo: string; slug: string; valvulas: [string, string, string][] }[] = [
  {
    prefijo: "Auto-Tanques",
    slug: "auto-tanques",
    // [encabezado en el Excel, campo de fecha, campo de código]
    valvulas: [
      ["Válvula de llenado", "fechaFabricacionValvulaLlenado", "codigoValvulaLlenado"],
      ["Válvula de no retroceso", "fechaFabricacionValvulaNoRetroceso", "codigoValvulaNoRetroceso"],
      ["Válvula de bypass", "fechaFabricacionValvulaBypass", "codigoValvulaBypass"],
      ["Válvula de retorno de vapores", "fechaFabricacionValvulaRetornoVapores", "codigoValvulaRetornoVapores"],
      ["Válvula de servicio", "fechaFabricacionValvulaServicio", "codigoValvulaServicio"],
      ["Válvula de máximo llenado 90%", "fechaFabricacionValvulaMaximoLlenado", "codigoValvulaMaximoLlenado"],
      ["Válvula de alivio (seguridad)", "fechaFabricacionValvulaAlivio", "codigoValvulaAlivio"],
      ["Válvula de exceso de flujo (litrómetro)", "fechaFabricacionValvulaExcesoFlujo", "codigoValvulaExcesoFlujo"],
      ["Válvula check lock", "fechaFabricacionValvulaCheckLock", "codigoValvulaCheckLock"],
      ["Válvula interna", "fechaFabricacionValvulaInterna", "codigoValvulaInterna"],
    ],
  },
  {
    prefijo: "Vehículo con tanque de carburac",
    slug: "vehiculo-con-tanque-de-carburacion",
    valvulas: [
      ["Válvula de llenado", "fechaFabricacionValvulaLlenado", "codigoValvulaLlenado"],
      ["Válvula de servicio", "fechaFabricacionValvulaServicio", "codigoValvulaServicio"],
      ["Válvula de máximo llenado 90%", "fechaFabricacionValvulaMaximoLlenado", "codigoValvulaMaximoLlenado"],
      ["Válvula de alivio (seguridad)", "fechaFabricacionValvulaAlivio", "codigoValvulaAlivio"],
    ],
  },
];

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};

const t = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const norm = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");

// "23 may 2023" (así lo escribe formatDate, ver lib/dates.ts).
function parseFechaCorta(texto: string): Date | null {
  const m = t(texto).toLowerCase().match(/^(\d{1,2})\s+([a-zé]+)\.?\s+(\d{4})$/);
  if (!m) return null;
  const mes = MESES[m[2]];
  if (mes === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), mes, Number(m[1])));
}

// Año suelto de la columna "Fecha de fabricación" + código grabado.
function fechaValvula(anioTexto: string, codigo: string): { fecha: Date; conMes: boolean } | null {
  const anio = Number(t(anioTexto));
  if (!Number.isInteger(anio) || anio < 1980 || anio > new Date().getUTCFullYear() + 1) return null;
  // "03C26", "2C17", "10 E 25", "07E2025", "3D22 (3)"
  const m = t(codigo).toUpperCase().replace(/\(.*?\)/g, "").trim().match(/^(\d{1,2})\s*[A-Z]\s*(\d{2}|\d{4})$/);
  if (m) {
    const mes = Number(m[1]);
    const anioCodigo = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    if (mes >= 1 && mes <= 12 && anioCodigo === anio) {
      return { fecha: new Date(Date.UTC(anio, mes - 1, 1)), conMes: true };
    }
  }
  return { fecha: new Date(Date.UTC(anio, 0, 1)), conMes: false };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

const wb = XLSX.readFile(EXCEL);
const resumen = { unidades: 0, camposLlenados: 0, conflictos: 0, sinMatch: 0, sinCambios: 0, altas: 0 };
const altas: string[] = [];

const COMBUSTIBLES: Record<string, string> = {
  "gas lp": "GAS_LP",
  gasolina: "GASOLINA",
  diesel: "DIESEL",
  "diésel": "DIESEL",
  "energía eléctrica": "ELECTRICA",
  "gas lp/gasolina": "GAS_LP_GASOLINA",
};

// Datos generales y de ficha de una fila, para dar de alta una unidad que
// no existía (mismos encabezados que la descarga de Excel del sistema).
function datosDeAlta(fila: Fila, slug: string) {
  const v = (k: string) => t(fila[k]) || null;
  const baja = t(fila["Estado"]).toLowerCase().startsWith("dado de baja");
  const tanque = slug === "auto-tanques" ? "Tanque" : "Tanque de carburación";
  return {
    registro: {
      numeroEconomico: t(fila["Número económico"]),
      sucursal: t(fila["Marca (datos generales)"]) || t(fila["Marca (ficha técnica)"]) || "Sin marca",
      anio: v("Año"),
      placas: v("Placas"),
      observaciones: v("Observaciones"),
      activo: !baja,
      fechaBaja: baja ? parseFechaCorta(fila["Fecha de baja"]) ?? new Date() : null,
      motivoBaja: baja ? v("Motivo de baja") : null,
    },
    ficha: {
      marca: v("Marca (ficha técnica)"),
      linea: v("Línea"),
      modelo: v("Modelo"),
      serie: v("Serie"),
      combustible: COMBUSTIBLES[t(fila["Combustible"]).toLowerCase()] ?? null,
      chofer: v("Chofer"),
      numeroPoliza: v("Número de póliza"),
      inciso: v("Inciso"),
      numeroSerieTanque: v(`${tanque} — Número de serie`),
      capacidadTanque: v(`${tanque} — Capacidad`),
      marcaTanque: v(`${tanque} — Marca`),
      anioFabricacionTanque: v(`${tanque} — Año de fabricación`),
    },
  };
}
const conflictos: string[] = [];
const sinMatch: string[] = [];

for (const hoja of HOJAS) {
  const nombreHoja = wb.SheetNames.find((n) => n.startsWith(hoja.prefijo));
  if (!nombreHoja) {
    console.log(`(No hay hoja "${hoja.prefijo}" en el Excel)`);
    continue;
  }
  const filas = XLSX.utils.sheet_to_json<Fila>(wb.Sheets[nombreHoja], { defval: "", raw: false });
  const registros = await prisma.vehicleRecord.findMany({
    where: { section: { slug: hoja.slug } },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });
  const secciones = await prisma.section.findMany({
    where: { slug: hoja.slug, parent: { slug: "unidad-de-distribucion" } },
    include: { city: true },
  });

  console.log(`\n=== ${nombreHoja}: ${filas.length} filas`);

  for (const fila of filas) {
    const ciudad = t(fila["Ciudad"]);
    const numero = t(fila["Número económico"]);
    if (!numero) continue;
    const etiqueta = `${ciudad || "(sin ciudad)"} / ${numero}`;

    const enCiudad = registros.filter((r) => !ciudad || r.section.city.name === ciudad);
    let candidatos = enCiudad.filter((r) => t(r.numeroEconomico) === numero);
    if (candidatos.length === 0) candidatos = enCiudad.filter((r) => norm(r.numeroEconomico) === norm(numero));
    let registroId: string | null = candidatos.length === 1 ? candidatos[0].id : null;
    let ficha = (candidatos[0]?.technicalSheet ?? {}) as Record<string, unknown>;
    if (candidatos.length > 1) {
      resumen.sinMatch++;
      sinMatch.push(`${nombreHoja} · ${etiqueta}: ${candidatos.length} registros coinciden`);
      continue;
    }
    if (candidatos.length === 0) {
      const seccion = secciones.find((sec) => sec.city.name === ciudad);
      if (!ciudad || !seccion) {
        resumen.sinMatch++;
        sinMatch.push(`${nombreHoja} · ${etiqueta}: no existe y ${ciudad ? "esa ciudad no tiene este apartado" : "la fila no trae ciudad"}; no se puede dar de alta`);
        continue;
      }
      const { registro: datos, ficha: fichaAlta } = datosDeAlta(fila, hoja.slug);
      const fichaLimpia = Object.fromEntries(Object.entries(fichaAlta).filter(([, x]) => x !== null));
      resumen.altas++;
      altas.push(`${nombreHoja} · ${etiqueta}${datos.activo ? "" : " (dada de baja)"}`);
      ficha = { ...fichaLimpia };
      if (APPLY) {
        const max = await prisma.vehicleRecord.aggregate({ where: { sectionId: seccion.id }, _max: { order: true } });
        const creado = await prisma.vehicleRecord.create({
          data: { ...datos, sectionId: seccion.id, order: (max._max.order ?? -1) + 1, technicalSheet: { create: fichaLimpia } },
        });
        registroId = creado.id;
      }
    }
    const cambios: Record<string, unknown> = {};

    const llenar = (campo: string, valor: unknown, mostrar: (v: unknown) => string = (v) => String(v)) => {
      if (valor === null || valor === undefined || valor === "") return;
      const actual = ficha[campo];
      const vacio = actual === null || actual === undefined || actual === "";
      if (vacio) {
        cambios[campo] = valor;
        return;
      }
      const igual = actual instanceof Date && valor instanceof Date ? actual.getTime() === valor.getTime() : actual === valor;
      if (!igual) {
        resumen.conflictos++;
        conflictos.push(`${etiqueta} · ${campo}: base=${mostrar(actual)} excel=${mostrar(valor)}`);
      }
    };
    const fechaTxt = (v: unknown) => (v instanceof Date ? iso(v) : String(v));

    for (const [encabezado, campoFecha, campoCodigo] of hoja.valvulas) {
      const codigo = t(fila[`${encabezado} — Número de serie`]);
      const anio = t(fila[`${encabezado} — Fecha de fabricación`]);
      const fecha = fechaValvula(anio, codigo);
      if (fecha) llenar(campoFecha, fecha.fecha, fechaTxt);
      if (codigo) llenar(campoCodigo, codigo);
    }

    // La fecha de instalación del juego no puede quedar antes que la
    // fabricación de ninguna válvula (ver el superRefine de
    // actions/vehicle-actions.ts): si pasa, es error de captura y se reporta.
    const instalacion = parseFechaCorta(fila["Válvulas — Fecha de instalación del juego"]);
    if (instalacion) {
      const fabricaciones = hoja.valvulas
        .filter(([, campo]) => campo !== "fechaFabricacionValvulaInterna")
        .map(([, campo]) => (cambios[campo] ?? ficha[campo]) as Date | null | undefined)
        .filter((f): f is Date => f instanceof Date);
      const posterior = fabricaciones.find((f) => f.getTime() > instalacion.getTime());
      if (posterior) {
        conflictos.push(`${etiqueta} · instalación del juego (${iso(instalacion)}) anterior a una válvula fabricada ${iso(posterior)}: no se cargó`);
        resumen.conflictos++;
      } else {
        llenar("fechaInstalacionValvulas", instalacion, fechaTxt);
      }
    }

    if (hoja.slug === "auto-tanques") {
      const manguera = fechaValvula(t(fila["Manguera de surtir — Fecha de fabricación"]), "");
      if (manguera) llenar("fechaFabricacionMangueraSurtir", manguera.fecha, fechaTxt);
      llenar("medidaMangueraSurtir", t(fila["Manguera de surtir — Medida"]));

      if (t(fila["¿Tiene gobernador?"]).toLowerCase().startsWith("s")) {
        if (!ficha.tieneGobernador) cambios.tieneGobernador = true;
        llenar("numeroGobernador", t(fila["Gobernador — Número de identificación"]));
        llenar("empresaGobernador", t(fila["Gobernador — Empresa que lo instaló"]));
      }
    }

    // Dictamen de ultrasonido. "0" en el número es "sin dictamen" en el
    // Excel de carburación.
    const numeroUltrasonido = t(fila["Ultrasonido — Número"]);
    if (numeroUltrasonido && numeroUltrasonido !== "0") llenar("numeroUltimoUltrasonido", numeroUltrasonido);
    llenar("ultimoUltrasonido", parseFechaCorta(fila["Ultrasonido — Última fecha"]), fechaTxt);
    llenar("fechaProximoUltrasonido", parseFechaCorta(fila["Ultrasonido — Próxima fecha"]), fechaTxt);

    const campos = Object.keys(cambios);
    if (campos.length === 0) {
      resumen.sinCambios++;
      continue;
    }
    resumen.unidades++;
    resumen.camposLlenados += campos.length;
    console.log(`  ${etiqueta}: ${campos.length} campo(s) — ${campos.join(", ")}`);

    if (APPLY && registroId) {
      await prisma.vehicleTechnicalSheet.upsert({
        where: { vehicleRecordId: registroId },
        update: cambios,
        create: { vehicleRecordId: registroId, ...cambios },
      });
    }
  }
}

console.log("\n=== Resumen");
console.log(`  Unidades con datos nuevos: ${resumen.unidades} (${resumen.camposLlenados} campos)`);
console.log(`  Unidades ya al día: ${resumen.sinCambios}`);
console.log(`  Unidades que no existían y se dieron de alta: ${resumen.altas}`);
for (const a of altas) console.log(`    - ${a}`);
console.log(`  Filas que no se pudieron cargar: ${resumen.sinMatch}`);
for (const s of sinMatch) console.log(`    - ${s}`);
console.log(`  Diferencias que NO se pisaron: ${resumen.conflictos}`);
for (const c of conflictos) console.log(`    - ${c}`);
console.log(APPLY ? "\nCambios guardados." : "\nSimulación: no se guardó nada. Corre con --apply para guardar.");

await prisma.$disconnect();
