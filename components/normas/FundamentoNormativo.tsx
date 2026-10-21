import { getRequisitos } from "@/lib/requisitos-runtime";

// La cita de la norma que respalda una alerta. A propósito va con otra letra
// (serif, cursiva) y en su propio recuadro con barra lateral: así se distingue
// de un vistazo de los renglones de la alerta, que son texto del sistema, y no
// se confunde un aviso con lo que dice la norma.
//
// Es un componente de servidor: lee el catálogo vigente (con los ajustes del
// ADMIN) directo de la base, así que quien lo use no tiene que pasarlo.
export async function FundamentoNormativo({
  claves,
  className = "",
}: {
  claves: string[];
  className?: string;
}) {
  const requisitos = (await getRequisitos()).filter((r) => claves.includes(r.clave));
  if (requisitos.length === 0) return null;

  return (
    <aside
      aria-label="Fundamento normativo"
      className={`border-l-4 border-primary/40 bg-slate-50 px-4 py-3 font-serif ${className}`}
    >
      <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        Fundamento normativo
      </p>
      {requisitos.map((r) => (
        <div key={r.clave} className="mt-2 first:mt-1">
          <p className="text-[13px] italic leading-relaxed text-gray-700">“{r.cita}”</p>
          <p className="mt-0.5 text-xs text-gray-600">
            — {r.norma}
            {r.numeral && r.numeral !== "—" ? `, ${r.numeral}` : ""}
            {r.plazoAnios ? (
              <>
                {" "}
                · <span className="font-semibold not-italic">Plazo: {r.plazoAnios} años</span>
                {r.cuentaDesde !== "—" ? ` desde ${r.cuentaDesde.charAt(0).toLowerCase()}${r.cuentaDesde.slice(1)}` : ""}
              </>
            ) : null}
          </p>
          {!r.verificado && (
            <p className="mt-0.5 font-sans text-[10px] text-amber-700">
              Pendiente de cotejar con el texto oficial.
            </p>
          )}
        </div>
      ))}
    </aside>
  );
}
