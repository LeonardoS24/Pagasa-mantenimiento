// Llena la fecha de fabricación de la manguera de surtir (trasiego) de los
// Auto-Tanques y Semirremolques con la lista que pasó el área de
// normatividad (octubre 2026). Esa fecha alimenta la alerta de manguera a 5
// años (ver mangueraParaAlerta en lib/hose-alerts.ts).
//
// Se corre en la computadora que tiene los datos reales (ver DESPLIEGUE.md):
//
//     npx tsx scripts/importar-mangueras-surtir.mts
//     npx tsx scripts/importar-mangueras-surtir.mts --apply
//     npx tsx scripts/importar-mangueras-surtir.mts --apply --sobrescribir
//
// Sin --apply solo simula e imprime qué haría (y cómo quedaría cada alerta).
//
// Reglas (las mismas de importar-valvulas-flotilla.mts):
// - Por defecto solo llena campos VACÍOS. Si la unidad ya tiene una fecha
//   distinta, no la pisa: la reporta para revisarla a mano (puede ser un
//   cambio de manguera registrado después de levantar la lista).
// - Con --sobrescribir SÍ reemplaza la fecha distinta por la de la lista, y
//   muestra la anterior. Úsalo cuando la lista sea la fecha de fabricación
//   correcta (el Excel de flotilla solo traía el año, que se guardó como el
//   1 de enero de ese año).
// - La unidad se busca por número económico, ignorando mayúsculas, espacios y
//   guiones ("Kg 133" = "KG-133"), solo en Auto-Tanques y Semirremolques. Si
//   no existe o coinciden varias, se reporta y se salta: aquí NO se dan de
//   alta unidades.
// - No toca bitácoras ni ningún otro campo.
import { prisma } from "../lib/prisma";
import { getHoseVencimiento, getHoseAlertLevel } from "../lib/hose-alerts";
import { daysUntil } from "../lib/ultrasound-alerts";

const APPLY = process.argv.includes("--apply");
const SOBRESCRIBIR = process.argv.includes("--sobrescribir");

// Fechas tal como llegaron: mes/día/año con el año en dos dígitos (se sabe
// que es mes/día porque hay 12/13/25, 05/29/24, 05/20/24 y 03/29/25).
// "AM" venía en cada renglón; se ignora.
const LISTA: [string, string][] = [
  ["Kg 133", "07/05/23"],
  ["Kg 139", "01/10/26"],
  ["Kg 140", "12/13/25"],
  ["Kg 141", "07/04/23"],
  ["Kg 143", "05/29/24"],
  ["Kg 148", "05/20/24"],
  ["Kg 151", "11/01/25"],
  ["Kg 154", "11/04/25"],
  ["Kg 155", "01/12/26"],
  ["Kg 158", "01/10/26"],
  ["Kg 160", "01/10/26"],
  ["Kg 161", "05/02/23"],
  ["Kg 166", "03/29/25"],
  ["Kg 168", "07/02/24"], // venía repetida con la misma fecha
  ["Kg 019", "02/03/20"],
];

const SLUGS = ["auto-tanques", "semirremolques"];
const norm = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");
const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseMesDiaAnio(texto: string): Date {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) throw new Error(`Fecha con formato inesperado: "${texto}"`);
  const [mes, dia, anio] = [Number(m[1]), Number(m[2]), 2000 + Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) throw new Error(`Fecha inválida: "${texto}"`);
  return fecha;
}

function estado(fabricacion: Date): string {
  const vence = getHoseVencimiento(fabricacion, 5)!;
  const dias = daysUntil(vence);
  const nivel = getHoseAlertLevel(fabricacion, 5);
  if (dias < 0) return `VENCIDA hace ${Math.abs(dias)} día(s)`;
  if (nivel === "red") return `ROJA: vence en ${dias} día(s)`;
  if (nivel === "yellow") return `AMARILLA: vence en ${dias} día(s)`;
  return `ok (vence en ${dias} día(s))`;
}

// Quita repetidas; si una repetida trae otra fecha, no se puede decidir sola.
const porUnidad = new Map<string, { nombre: string; fecha: Date }>();
const conflictos: string[] = [];
for (const [nombre, texto] of LISTA) {
  const fecha = parseMesDiaAnio(texto);
  const previa = porUnidad.get(norm(nombre));
  if (previa && previa.fecha.getTime() !== fecha.getTime()) {
    conflictos.push(`${nombre}: viene con dos fechas distintas (${iso(previa.fecha)} y ${iso(fecha)}). Se salta.`);
    porUnidad.delete(norm(nombre));
    continue;
  }
  if (!previa) porUnidad.set(norm(nombre), { nombre, fecha });
}

const registros = await prisma.vehicleRecord.findMany({
  where: { section: { slug: { in: SLUGS } } },
  select: {
    id: true,
    numeroEconomico: true,
    activo: true,
    section: { select: { slug: true, name: true, city: { select: { name: true } } } },
    technicalSheet: { select: { fechaFabricacionMangueraSurtir: true } },
  },
});

console.log(APPLY ? "== APLICANDO ==" : "== SIMULACIÓN (no se guarda nada; agrega --apply para guardar) ==");
const cuenta = { llena: 0, igual: 0, distinta: 0, reemplazada: 0, noEncontrada: 0, ambigua: 0 };

for (const { nombre, fecha } of porUnidad.values()) {
  const coincidencias = registros.filter((r) => norm(r.numeroEconomico) === norm(nombre));
  if (coincidencias.length === 0) {
    cuenta.noEncontrada++;
    console.log(`✘ ${nombre}: no existe en Auto-Tanques ni Semirremolques. Se salta.`);
    continue;
  }
  if (coincidencias.length > 1) {
    cuenta.ambigua++;
    console.log(
      `✘ ${nombre}: coincide con varias (${coincidencias.map((c) => `${c.section.city.name}/${c.section.name}`).join(", ")}). Se salta.`
    );
    continue;
  }
  const r = coincidencias[0];
  const donde = `${r.numeroEconomico} (${r.section.city.name} · ${r.section.name}${r.activo ? "" : " · dada de baja"})`;
  const actual = r.technicalSheet?.fechaFabricacionMangueraSurtir ?? null;

  if (actual && actual.getTime() === fecha.getTime()) {
    cuenta.igual++;
    console.log(`= ${donde}: ya tiene ${iso(fecha)}.`);
  } else if (actual && SOBRESCRIBIR) {
    cuenta.reemplazada++;
    console.log(`↻ ${donde}: tenía ${iso(actual)} → ahora ${iso(fecha)} · alerta ${estado(fecha)}`);
    if (APPLY) {
      await prisma.vehicleTechnicalSheet.update({
        where: { vehicleRecordId: r.id },
        data: { fechaFabricacionMangueraSurtir: fecha },
      });
    }
  } else if (actual) {
    cuenta.distinta++;
    console.log(`! ${donde}: ya tiene ${iso(actual)} y la lista dice ${iso(fecha)}. NO se cambia (usa --sobrescribir si la lista es la correcta).`);
  } else {
    cuenta.llena++;
    console.log(`✔ ${donde}: manguera de surtir ${iso(fecha)} → alerta ${estado(fecha)}`);
    if (APPLY) {
      await prisma.vehicleTechnicalSheet.upsert({
        where: { vehicleRecordId: r.id },
        update: { fechaFabricacionMangueraSurtir: fecha },
        create: { vehicleRecordId: r.id, fechaFabricacionMangueraSurtir: fecha },
      });
    }
  }
}

for (const c of conflictos) console.log(`✘ ${c}`);
console.log(
  `\nResumen: ${cuenta.llena} ${APPLY ? "llenadas" : "se llenarían"} · ${cuenta.igual} ya estaban igual · ` +
    `${cuenta.reemplazada} ${APPLY ? "reemplazadas" : "se reemplazarían"} · ` +
    `${cuenta.distinta} con otra fecha (no se tocan) · ${cuenta.noEncontrada} no encontradas · ` +
    `${cuenta.ambigua} ambiguas · ${conflictos.length} con fechas en conflicto.`
);
await prisma.$disconnect();
