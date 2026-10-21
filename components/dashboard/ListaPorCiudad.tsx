import type { ReactNode } from "react";

// Lista de alertas de un panel. Con `ciudades` (nombres en el orden de las
// ciudades del sistema) las separa por ciudad, cada una con su encabezado, en
// ese orden; sin ella es la lista plana de siempre. Dentro de cada ciudad se
// conserva el orden que traían (por fecha de vencimiento).
export function ListaPorCiudad<T extends { cityName: string }>({
  items,
  ciudades,
  children,
}: {
  items: T[];
  ciudades?: string[];
  children: (item: T, indice: number) => ReactNode;
}) {
  if (!ciudades || ciudades.length === 0) {
    return <ul className="space-y-2">{items.map((item, i) => children(item, i))}</ul>;
  }

  // Las ciudades del orden primero; cualquier otra (no debería haber) al final.
  const nombres = [...ciudades, ...new Set(items.map((i) => i.cityName).filter((n) => !ciudades.includes(n)))];
  return (
    <div className="space-y-4">
      {nombres.map((nombre) => {
        const deLaCiudad = items.filter((i) => i.cityName === nombre);
        if (deLaCiudad.length === 0) return null;
        return (
          <section key={nombre}>
            <h3 className="mb-2 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {nombre} <span className="font-normal text-gray-500">({deLaCiudad.length})</span>
            </h3>
            <ul className="space-y-2">{deLaCiudad.map((item, i) => children(item, i))}</ul>
          </section>
        );
      })}
    </div>
  );
}
