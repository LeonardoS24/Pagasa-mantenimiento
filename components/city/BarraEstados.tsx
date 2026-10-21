import type { Conteo, EstadoUnidad } from "@/lib/tablero";

export const ESTADOS_TABLERO: { estado: EstadoUnidad; nombre: string; color: string }[] = [
  { estado: "vencido", nombre: "Con vencidos", color: "#b91c1c" },
  { estado: "urgente", nombre: "Vencen en 7 días o menos", color: "#f87171" },
  { estado: "proximo", nombre: "Vencen en 8 a 30 días", color: "#facc15" },
  { estado: "alCorriente", nombre: "Al corriente", color: "#16a34a" },
  { estado: "sinFechas", nombre: "Sin fechas capturadas", color: "#d1d5db" },
];

// Barra apilada con la proporción de unidades en cada estado. Los números van
// aparte (en la tabla), la barra es para comparar de un vistazo.
export function BarraEstados({ conteo, etiqueta }: { conteo: Conteo; etiqueta: string }) {
  if (conteo.total === 0) return <div className="h-3 rounded bg-gray-100" aria-label={`${etiqueta}: sin unidades`} />;
  const resumen = ESTADOS_TABLERO.filter((e) => conteo[e.estado] > 0)
    .map((e) => `${conteo[e.estado]} ${e.nombre.toLowerCase()}`)
    .join(", ");
  return (
    <div
      role="img"
      aria-label={`${etiqueta}: ${resumen}`}
      title={resumen}
      className="flex h-3 w-full overflow-hidden rounded bg-gray-100"
    >
      {ESTADOS_TABLERO.map((e) =>
        conteo[e.estado] > 0 ? (
          <div key={e.estado} style={{ width: `${(conteo[e.estado] / conteo.total) * 100}%`, backgroundColor: e.color }} />
        ) : null
      )}
    </div>
  );
}

export function LeyendaEstados() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {ESTADOS_TABLERO.map((e) => (
        <li key={e.estado} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: e.color }} />
          {e.nombre}
        </li>
      ))}
    </ul>
  );
}
