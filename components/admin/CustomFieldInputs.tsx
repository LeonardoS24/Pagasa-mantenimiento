import { campoInputName, type CustomFieldDef } from "@/lib/custom-fields";
import { toDateInputValue } from "@/lib/dates";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100";

// Dibuja los recuadros extra que le tocan a una sección de la ficha técnica
// (ver /admin/campos). Se monta dentro del <fieldset> de esa sección, así que
// hereda el bloqueo "Editar" del formulario sin hacer nada especial.
export function CustomFieldInputs({
  campos,
  seccion,
  valores,
}: {
  campos: CustomFieldDef[];
  seccion: string;
  valores: Record<string, string>;
}) {
  const deEstaSeccion = campos.filter((c) => c.seccion === seccion);
  if (deEstaSeccion.length === 0) return null;

  return (
    <>
      {deEstaSeccion.map((campo) => {
        const name = campoInputName(campo.id);
        const valor = valores[campo.id] ?? "";
        return (
          <div key={campo.id} className={campo.tipo === "TEXTO_LARGO" ? "sm:col-span-2" : undefined}>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor={name}>
              {campo.etiqueta}
            </label>
            {campo.tipo === "TEXTO_LARGO" ? (
              <textarea id={name} name={name} rows={3} defaultValue={valor} className={inputClass} />
            ) : campo.tipo === "LISTA" ? (
              <select id={name} name={name} defaultValue={valor} className={inputClass}>
                <option value="">Selecciona...</option>
                {(campo.opciones ?? []).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={name}
                name={name}
                type={campo.tipo === "FECHA" ? "date" : campo.tipo === "NUMERO" ? "number" : "text"}
                step={campo.tipo === "NUMERO" ? "any" : undefined}
                defaultValue={campo.tipo === "FECHA" ? toDateInputValue(valor) : valor}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// Versión de solo lectura, para la vista de la ficha (USUARIO/LECTOR) y la
// hoja de impresión.
export function CustomFieldItems({
  campos,
  seccion,
  valores,
}: {
  campos: CustomFieldDef[];
  seccion: string;
  valores: Record<string, string>;
}) {
  const deEstaSeccion = campos.filter((c) => c.seccion === seccion && valores[c.id]);
  if (deEstaSeccion.length === 0) return null;

  return (
    <>
      {deEstaSeccion.map((campo) => (
        <div key={campo.id}>
          <dt className="text-xs font-semibold uppercase text-gray-500">{campo.etiqueta}</dt>
          <dd className="whitespace-pre-wrap text-ink">{valores[campo.id]}</dd>
        </div>
      ))}
    </>
  );
}
