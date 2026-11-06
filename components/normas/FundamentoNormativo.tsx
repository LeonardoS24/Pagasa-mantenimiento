import { getRequisitos } from "@/lib/requisitos-runtime";

// Qué norma respalda una alerta y a cuántos años: una línea corta, sin citar
// el texto de la norma (lo que dice cada requisito se lee en el Expediente de
// cumplimiento normativo de la ciudad y, para editarlo, en /admin/normas).
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
    <aside aria-label="Fundamento normativo" className={`border-l-4 border-primary/40 bg-slate-50 px-3 py-2 ${className}`}>
      {requisitos.map((r) => (
        <p key={r.clave} className="text-xs text-gray-700">
          <span className="font-semibold text-gray-500">Norma: </span>
          {r.norma}
          {r.numeral && r.numeral !== "—" ? `, ${r.numeral}` : ""}
          {r.plazoAnios ? (
            <>
              {" "}
              · <span className="font-semibold">{r.plazoAnios} años</span>
              {r.cuentaDesde !== "—" ? ` desde la ${r.cuentaDesde}` : ""}
            </>
          ) : null}
          {!r.verificado && <span className="ml-1 text-[10px] text-amber-700">(por cotejar con el DOF)</span>}
        </p>
      ))}
    </aside>
  );
}
