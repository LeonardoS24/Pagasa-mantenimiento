import { campoInputName, seccionDePropia, type CustomFieldDef, type CustomSectionDef } from "@/lib/custom-fields";
import { toDateInputValue } from "@/lib/dates";
import { propsDeRecuadro, type DisenoFicha } from "@/lib/diseno-ficha";

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

// Los campos propios de un recuadro de fábrica que no tenía su propia
// cuadrícula de campos (Chofer y póliza, Gobernador, Dictámenes...): salen
// abajo, en su propia cuadrícula. Sin campos no pinta nada.
export function CamposExtraBloque({
  campos,
  seccion,
  valores,
}: {
  campos: CustomFieldDef[];
  seccion: string;
  valores: Record<string, string>;
}) {
  if (!campos.some((c) => c.seccion === seccion)) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <CustomFieldInputs campos={campos} seccion={seccion} valores={valores} />
    </div>
  );
}

// Recuadros nuevos que el ADMIN creó para este apartado (ver /admin/campos):
// cada uno sale como su propio recuadro, con el título y los campos que tenga.
// Un recuadro sin campos no se dibuja. Va dentro del <fieldset> de la ficha.
export function CustomSectionInputs({
  secciones,
  campos,
  valores,
  diseno,
  mostrarVacios = false,
}: {
  secciones: CustomSectionDef[];
  campos: CustomFieldDef[];
  valores: Record<string, string>;
  diseno?: DisenoFicha;
  // Editor de fichas: también los recuadros que todavía no tienen campos.
  mostrarVacios?: boolean;
}) {
  const conCampos = mostrarVacios ? secciones : secciones.filter((s) => campos.some((c) => c.seccion === seccionDePropia(s.id)));
  if (conCampos.length === 0) return null;
  return (
    <>
      {conCampos.map((s) => (
        <div key={s.id} {...propsDeRecuadro(diseno, `x:${s.id}`, "propio")}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">{s.titulo}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CustomFieldInputs campos={campos} seccion={seccionDePropia(s.id)} valores={valores} />
          </div>
          {mostrarVacios && !campos.some((c) => c.seccion === seccionDePropia(s.id)) && (
            <p className="text-xs text-gray-500">Sin campos todavía: agrégale campos para que aparezca en la ficha.</p>
          )}
        </div>
      ))}
    </>
  );
}

// Versión de solo lectura de los recuadros propios: solo salen los que tienen
// algún dato capturado.
export function CustomSectionItems({
  secciones,
  campos,
  valores,
  diseno,
}: {
  secciones: CustomSectionDef[];
  campos: CustomFieldDef[];
  valores: Record<string, string>;
  diseno?: DisenoFicha;
}) {
  const conDatos = secciones.filter((s) => campos.some((c) => c.seccion === seccionDePropia(s.id) && valores[c.id]));
  if (conDatos.length === 0) return null;
  return (
    <>
      {conDatos.map((s) => (
        <div key={s.id} {...propsDeRecuadro(diseno, `x:${s.id}`, "propio")}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">{s.titulo}</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CustomFieldItems campos={campos} seccion={seccionDePropia(s.id)} valores={valores} />
          </dl>
        </div>
      ))}
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
