// Las unidades del lote como <option>, agrupadas por apartado, para los
// selectores de unidad de la revisión (DocumentoDeLoteForm y
// AgregarDocumentosForm).
export type UnidadParaLote = {
  id: string;
  etiqueta: string; // número económico / nombre, con la ciudad si el lote es de Administración
  apartado: string;
  sectionSlug: string;
  activo: boolean;
  tanques: { id: string; etiqueta: string }[];
  href: string; // página de la unidad
};

export function OpcionesDeUnidades({ unidades }: { unidades: UnidadParaLote[] }) {
  const grupos = unidades.reduce<Record<string, UnidadParaLote[]>>((acc, u) => {
    (acc[u.apartado] ??= []).push(u);
    return acc;
  }, {});
  return (
    <>
      {Object.entries(grupos).map(([apartado, lista]) => (
        <optgroup key={apartado} label={apartado}>
          {lista.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etiqueta}
              {u.activo ? "" : " (dada de baja)"}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
