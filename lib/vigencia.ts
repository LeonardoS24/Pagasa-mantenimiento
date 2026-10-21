// "Actual" vs "antiguo" en lo que se guarda por unidad.
//
// Nada se reemplaza ni se borra: cada prueba, cambio de extintor, de manguera
// o de válvulas nuevo es un registro nuevo y el anterior se queda como
// historial. Lo "actual" es solo el registro más reciente de cada tipo —por
// unidad y, en estaciones y plantas con varios tanques, por tanque—. Se
// calcula al vuelo, así que no hay nada que migrar ni que se pueda
// desincronizar.
//
// Solo aplica a lo que de verdad se reemplaza con el tiempo (las pruebas del
// tanque, el extintor, la manguera, el cambio de válvulas y la póliza). Un
// mantenimiento, un correctivo de válvulas o un documento suelto de la unidad
// son eventos o archivos aparte: ninguno sustituye a otro, así que todos
// cuentan como actuales.

export type Historial = "todo" | "actual";

export function leerHistorial(valor: string | string[] | undefined): Historial {
  return valor === "actual" ? "actual" : "todo";
}

type ConFecha = { fecha: Date | null | undefined; tanqueId?: string | null; creado?: Date | null };

// De una lista de registros del mismo tipo (de una misma unidad), deja solo
// los vigentes: el más reciente por tanque. Dos del mismo día quedan ambos
// (no hay forma de saber cuál va después) salvo que su fecha de captura
// los distinga.
export function soloVigentes<T>(registros: T[], datos: (registro: T) => ConFecha): T[] {
  const mejorPorTanque = new Map<string, { fecha: number; creado: number }>();
  const clave = (r: T) => datos(r).tanqueId ?? "";
  const peso = (r: T) => ({
    fecha: datos(r).fecha?.getTime() ?? Number.NEGATIVE_INFINITY,
    creado: datos(r).creado?.getTime() ?? 0,
  });
  for (const r of registros) {
    const p = peso(r);
    const actual = mejorPorTanque.get(clave(r));
    if (!actual || p.fecha > actual.fecha || (p.fecha === actual.fecha && p.creado > actual.creado)) {
      mejorPorTanque.set(clave(r), p);
    }
  }
  return registros.filter((r) => {
    const p = peso(r);
    const mejor = mejorPorTanque.get(clave(r))!;
    return p.fecha === mejor.fecha && p.creado === mejor.creado;
  });
}
