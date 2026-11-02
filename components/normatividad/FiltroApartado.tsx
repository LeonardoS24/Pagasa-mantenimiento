// Selector de apartado para el expediente y el programa anual: un formulario
// GET normal (funciona sin JavaScript y deja la URL lista para compartir).
export function FiltroApartado({
  apartados,
  actual,
  extra,
}: {
  apartados: { slug: string; nombre: string }[];
  actual?: string;
  extra?: React.ReactNode;
}) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-2 print:hidden">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-gray-500">Apartado</span>
        <select name="apartado" defaultValue={actual ?? ""} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Todos</option>
          {apartados.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      {extra}
      <button type="submit" className="rounded-md bg-primary px-4 py-1.5 text-sm text-white hover:bg-primary-dark">
        Ver
      </button>
    </form>
  );
}
