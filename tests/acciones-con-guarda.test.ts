// Red de seguridad para las Server Actions: TODA función exportada de
// actions/*.ts queda expuesta como un endpoint que cualquiera con sesión puede
// llamar directo. Esta prueba lee el código y exige que cada una pida sesión
// o rol (requireUser / requireAdmin / requireEditor / requireElevatedEditor /
// getSession), ya sea ella misma o por una función de ayuda del mismo archivo.
// Así, una acción nueva a la que se le olvide la guarda hace fallar la prueba
// en vez de quedar abierta sin que nadie se entere.
//
// No prueba QUÉ rol exige cada una ni que revise la ciudad (eso se revisa al
// escribirla, ver CLAUDE.md); solo que no haya ninguna sin candado.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const GUARDA = /\b(requireUser|requireAdmin|requireEditor|requireElevatedEditor|getSession|leerSesion)\(/;

// Funciones exportadas que a propósito no piden sesión. Cada una con su razón.
const EXCEPCIONES: Record<string, string> = {
  // Solo lanza o no según los datos que ella misma recibe; no lee ni escribe nada.
  "record-drilldown-actions.ts:assertCanViewCity": "aserción pura, no toca datos",
};

type Funcion = { nombre: string; cuerpo: string; exportada: boolean };

function funcionesDe(codigo: string): Funcion[] {
  const marcas: { nombre: string; indice: number; exportada: boolean }[] = [];
  const re = /^(export )?async function (\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(codigo))) marcas.push({ nombre: m[2], indice: m.index, exportada: Boolean(m[1]) });
  return marcas.map((marca, k) => ({
    nombre: marca.nombre,
    exportada: marca.exportada,
    cuerpo: codigo.slice(marca.indice, k + 1 < marcas.length ? marcas[k + 1].indice : codigo.length),
  }));
}

test("toda Server Action pide sesión o rol (directo o por una función de ayuda)", () => {
  const carpeta = path.join(process.cwd(), "actions");
  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith(".ts"));
  assert.ok(archivos.length > 20, "no se encontraron las acciones");

  const sinGuarda: string[] = [];
  let revisadas = 0;

  for (const archivo of archivos) {
    const funciones = funcionesDe(fs.readFileSync(path.join(carpeta, archivo), "utf8"));
    // Funciones con guarda propia, y después las que llaman a una de esas.
    const conGuarda = new Set(funciones.filter((f) => GUARDA.test(f.cuerpo)).map((f) => f.nombre));
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      for (const f of funciones) {
        if (conGuarda.has(f.nombre)) continue;
        if ([...conGuarda].some((g) => new RegExp(`\\b${g}\\(`).test(f.cuerpo))) conGuarda.add(f.nombre);
      }
    }
    for (const f of funciones.filter((x) => x.exportada)) {
      revisadas++;
      if (conGuarda.has(f.nombre)) continue;
      if (EXCEPCIONES[`${archivo}:${f.nombre}`]) continue;
      sinGuarda.push(`${archivo}: ${f.nombre}`);
    }
  }

  assert.ok(revisadas > 100, `solo se revisaron ${revisadas} acciones: ¿cambió el formato?`);
  assert.deepEqual(sinGuarda, [], `Acciones sin sesión ni rol: ${sinGuarda.join(", ")}`);
});

test("las excepciones siguen existiendo (si se borra la función, se borra de la lista)", () => {
  for (const clave of Object.keys(EXCEPCIONES)) {
    const [archivo, nombre] = clave.split(":");
    const codigo = fs.readFileSync(path.join(process.cwd(), "actions", archivo), "utf8");
    assert.ok(new RegExp(`export async function ${nombre}\\b`).test(codigo), `${clave} ya no existe`);
  }
});
