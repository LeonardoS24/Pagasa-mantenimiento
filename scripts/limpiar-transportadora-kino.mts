// Deja a "Transportadora Kino" solo con "Unidad de distribución" (Tractocamiones
// y Semirremolques) y "Bitácoras de unidades": quita los apartados que sobran
// (Manuales, Programa de mantenimiento, Equipos, Bitácora de estaciones,
// Bitácora de equipos, Orden, Inventarios...).
//
// Se corre en la computadora que tiene los datos reales (ver DESPLIEGUE.md):
//
//     npx tsx scripts/limpiar-transportadora-kino.mts          (simula)
//     npx tsx scripts/limpiar-transportadora-kino.mts --apply  (borra)
//
// Regla: SOLO se borra un apartado que está vacío (sin unidades, documentos,
// equipos, órdenes ni inventario, ni él ni los que tiene dentro). Un apartado
// con datos NO se toca y se reporta: ahí hay historial (p. ej. la bitácora de
// un equipo) y el historial no se borra; hay que decidir con calma qué hacer
// con ese contenido. Es repetible.
import { prisma } from "../lib/prisma";
import { KINO_CITY_SLUG, PLANTILLA_KINO } from "../lib/city-template";

const APPLY = process.argv.includes("--apply");

const ciudad = await prisma.city.findUnique({ where: { slug: KINO_CITY_SLUG } });
if (!ciudad) {
  console.log(`No existe la ciudad "${KINO_CITY_SLUG}". Nada que hacer.`);
  await prisma.$disconnect();
  process.exit(0);
}

type Seccion = { id: string; name: string; slug: string; parentId: string | null };
const todas: Seccion[] = await prisma.section.findMany({
  where: { cityId: ciudad.id },
  select: { id: true, name: true, slug: true, parentId: true },
});

// Los que se conservan, por ruta de slugs (ver PLANTILLA_KINO).
const permitidos = new Set<string>();
const marcar = (apartados: typeof PLANTILLA_KINO, prefijo: string) => {
  for (const a of apartados) {
    const ruta = `${prefijo}/${a.slug}`;
    permitidos.add(ruta);
    if (a.children) marcar(a.children, ruta);
  }
};
marcar(PLANTILLA_KINO, "");

const porId = new Map(todas.map((s) => [s.id, s]));
const ruta = (s: Seccion): string => (s.parentId ? `${ruta(porId.get(s.parentId)!)}/${s.slug}` : `/${s.slug}`);
const hijosDe = (id: string) => todas.filter((s) => s.parentId === id);
const subarbol = (s: Seccion): Seccion[] => [s, ...hijosDe(s.id).flatMap(subarbol)];

async function contenido(s: Seccion) {
  const where = { sectionId: s.id };
  const [unidades, documentos, equipos, ordenes, inventario] = await Promise.all([
    prisma.vehicleRecord.count({ where }),
    prisma.document.count({ where }),
    prisma.equipo.count({ where }),
    prisma.pieceOrder.count({ where }),
    prisma.inventoryItem.count({ where }),
  ]);
  return { unidades, documentos, equipos, ordenes, inventario, total: unidades + documentos + equipos + ordenes + inventario };
}

console.log(APPLY ? "== APLICANDO ==" : "== SIMULACIÓN (no se borra nada; agrega --apply) ==");
let borrados = 0;
let conservados = 0;
let conDatos = 0;

// Raíces de lo que sobra: las que no están permitidas y cuyo padre sí lo está
// (o no tienen padre). Lo de adentro se decide junto con su raíz.
const raices = todas.filter((s) => !permitidos.has(ruta(s)) && (!s.parentId || permitidos.has(ruta(porId.get(s.parentId)!))));

for (const raiz of raices) {
  const arbol = subarbol(raiz);
  const cuentas = await Promise.all(arbol.map(contenido));
  const total = cuentas.reduce((n, c) => n + c.total, 0);
  const nombre = `${ruta(raiz)} ("${raiz.name}")`;
  if (total === 0) {
    console.log(`✔ ${nombre}: vacío${arbol.length > 1 ? ` (con ${arbol.length - 1} sub-apartado(s) vacío(s))` : ""} → se ${APPLY ? "borró" : "borraría"}.`);
    if (APPLY) await prisma.section.delete({ where: { id: raiz.id } });
    borrados++;
  } else {
    const suma = (k: "unidades" | "documentos" | "equipos" | "ordenes" | "inventario") => cuentas.reduce((n, c) => n + c[k], 0);
    console.log(
      `! ${nombre}: TIENE DATOS (unidades ${suma("unidades")}, documentos ${suma("documentos")}, equipos ${suma("equipos")}, órdenes ${suma("ordenes")}, inventario ${suma("inventario")}). NO se toca.`
    );
    conDatos++;
  }
}
for (const s of todas) if (permitidos.has(ruta(s))) conservados++;

console.log(`\nResumen: ${borrados} ${APPLY ? "borrado(s)" : "se borrarían"} · ${conDatos} con datos (no se tocan) · ${conservados} apartado(s) que se conservan.`);
await prisma.$disconnect();
