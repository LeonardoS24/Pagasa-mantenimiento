import { getAccessibleCities } from "./access";
import { isAggregateCitySlug } from "./aggregate-city";
import { getVencimientos } from "./vencimientos";
import type { UsuarioSesion } from "./session";

// Cuántos vencimientos en rojo (7 días o menos, o ya vencidos) ve una
// persona en sus ciudades. Lo consulta el centro de avisos cada medio minuto
// por cada pestaña abierta: se guarda 5 minutos por juego de ciudades para no
// recalcular todos los vencimientos a cada rato.
const VIGENCIA_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __rojosCache?: Map<string, { valor: number; en: number }> };

export async function contarRojos(user: UsuarioSesion): Promise<number> {
  const ciudades = (await getAccessibleCities(user)).filter((c) => !isAggregateCitySlug(c.slug));
  const ids = ciudades.map((c) => c.id).sort();
  const llave = ids.join(",");
  g.__rojosCache ??= new Map();
  const guardado = g.__rojosCache.get(llave);
  if (guardado && Date.now() - guardado.en < VIGENCIA_MS) return guardado.valor;
  const valor = ids.length ? (await getVencimientos(ids)).filter((v) => v.nivel === "red").length : 0;
  g.__rojosCache.set(llave, { valor, en: Date.now() });
  return valor;
}
