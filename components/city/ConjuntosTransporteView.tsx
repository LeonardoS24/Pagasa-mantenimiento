import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { getUltrasoundAlertLevel, ultrasoundAlertBadgeStyles } from "@/lib/ultrasound-alerts";
import type { ConjuntoVista, UnidadConjunto } from "@/lib/conjuntos";
import { ConjuntoForm } from "@/components/admin/ConjuntoForm";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";
import { deleteConjunto } from "@/actions/conjunto-actions";

// Vista "por conjunto" de Tractocamiones/Semirremolques de Transportadora
// Kino: cada tarjeta es un conjunto (tractocamión + sus semirremolques) con
// el nombre del dictamen, igual que como se dictaminan. Debajo, lo que no
// está en ningún conjunto, para que nada quede escondido.

function FilaUnidad({ u, citySlug }: { u: UnidadConjunto; citySlug: string }) {
  const nivel = u.activo ? getUltrasoundAlertLevel(u.proximoUltrasonido) : "none";
  return (
    <tr className={!u.activo ? "bg-orange-50" : undefined}>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{u.esTractocamion ? "Tractocamión" : "Semirremolque"}</td>
      <td className="whitespace-nowrap px-3 py-2">
        <Link href={`/ciudades/${citySlug}/vehiculo/${u.id}`} className="font-medium text-primary hover:underline">
          {u.numeroEconomico}
        </Link>
        {!u.activo && <span className="ml-2 text-xs text-orange-700">dada de baja</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-ink">
        {u.marca}
        {u.anio ? ` · ${u.anio}` : ""}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-ink">{u.placas || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-ink">{u.serie || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-ink">{u.esTractocamion ? "" : u.numeroPemex || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-ink">{u.esTractocamion ? "" : u.capacidad ? `${Number(u.capacidad).toLocaleString("es-MX")} L` : "—"}</td>
      <td className="whitespace-nowrap px-3 py-2">
        {u.esTractocamion ? null : u.proximoUltrasonido ? (
          <span className={nivel !== "none" ? `rounded-full px-2 py-0.5 text-xs font-medium ${ultrasoundAlertBadgeStyles[nivel]}` : "text-ink"}>
            {formatDate(u.proximoUltrasonido)}
          </span>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
    </tr>
  );
}

function TablaUnidades({ unidades, citySlug }: { unidades: UnidadConjunto[]; citySlug: string }) {
  if (unidades.length === 0) return <p className="px-3 py-2 text-sm text-gray-500">Sin unidades.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Número económico</th>
            <th className="px-3 py-2">Marca · Año</th>
            <th className="px-3 py-2">Placas</th>
            <th className="px-3 py-2">Serie / NIV</th>
            <th className="px-3 py-2">No. Pemex</th>
            <th className="px-3 py-2">Capacidad</th>
            <th className="px-3 py-2">Próximo ultrasonido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {unidades.map((u) => (
            <FilaUnidad key={u.id} u={u} citySlug={citySlug} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConjuntosTransporteView({
  cityId,
  citySlug,
  conjuntos,
  tractocamiones,
  semirremolques,
  tractocamionesSinConjunto,
  semirremolquesSinConjunto,
  conjuntoDeSemirremolque,
  puedeEditar,
}: {
  cityId: string;
  citySlug: string;
  conjuntos: ConjuntoVista[];
  tractocamiones: UnidadConjunto[];
  semirremolques: UnidadConjunto[];
  tractocamionesSinConjunto: UnidadConjunto[];
  semirremolquesSinConjunto: UnidadConjunto[];
  conjuntoDeSemirremolque: Record<string, string>;
  puedeEditar: boolean;
}) {
  const opcionesTracto = tractocamiones.map((u) => ({ id: u.id, numeroEconomico: u.numeroEconomico, activo: u.activo }));
  const opcionesSemi = semirremolques.map((u) => ({ id: u.id, numeroEconomico: u.numeroEconomico, activo: u.activo }));
  const sinConjunto = [...tractocamionesSinConjunto, ...semirremolquesSinConjunto];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">
        {conjuntos.length} conjunto(s) — cada uno es un tractocamión con sus semirremolques, tal como vienen en los
        dictámenes. Un tractocamión puede aparecer en más de un dictamen; un semirremolque solo en uno.
      </p>

      {conjuntos.map((c) => (
        <div key={c.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-primary/5 px-4 py-2">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                {c.nombre}
                {c.tractocamion && <span className="font-normal text-ink"> — {c.tractocamion.numeroEconomico}</span>}
                {c.semirremolques.length > 0 && (
                  <span className="font-normal text-ink"> + {c.semirremolques.map((s) => s.numeroEconomico).join(" + ")}</span>
                )}
              </h3>
              {c.observaciones && <p className="text-xs text-gray-500">{c.observaciones}</p>}
            </div>
            {puedeEditar && (
              <div className="flex items-start gap-3">
                <ConfirmDeleteRecordWithPassword
                  mensaje={`¿Eliminar el conjunto "${c.nombre}"? Solo se quita la agrupación: las unidades, sus fichas y bitácoras no cambian.`}
                  action={deleteConjunto.bind(null, c.id)}
                  className="text-xs text-accent hover:underline"
                >
                  Eliminar
                </ConfirmDeleteRecordWithPassword>
              </div>
            )}
          </div>
          <TablaUnidades unidades={[...(c.tractocamion ? [c.tractocamion] : []), ...c.semirremolques]} citySlug={citySlug} />
          {puedeEditar && (
            <details className="border-t border-gray-100 px-4 py-2">
              <summary className="cursor-pointer text-xs font-medium text-primary">Editar conjunto</summary>
              <div className="mt-3">
                <ConjuntoForm
                  cityId={cityId}
                  conjunto={{
                    id: c.id,
                    nombre: c.nombre,
                    observaciones: c.observaciones,
                    tractocamionId: c.tractocamion?.id ?? null,
                    semirremolqueIds: c.semirremolques.map((s) => s.id),
                  }}
                  tractocamiones={opcionesTracto}
                  semirremolques={opcionesSemi}
                  conjuntoDeSemirremolque={conjuntoDeSemirremolque}
                />
              </div>
            </details>
          )}
        </div>
      ))}

      <div className="overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
        <div className="border-b border-gray-200 px-4 py-2">
          <h3 className="text-sm font-semibold text-ink">Sin conjunto ({sinConjunto.length})</h3>
          <p className="text-xs text-gray-500">Tractocamiones que no encabezan ningún dictamen y semirremolques que no están en ninguno.</p>
        </div>
        <TablaUnidades unidades={sinConjunto} citySlug={citySlug} />
      </div>

      {puedeEditar && (
        <details className="rounded-lg border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">+ Nuevo conjunto</summary>
          <div className="mt-3">
            <ConjuntoForm
              cityId={cityId}
              tractocamiones={opcionesTracto}
              semirremolques={opcionesSemi}
              conjuntoDeSemirremolque={conjuntoDeSemirremolque}
            />
          </div>
        </details>
      )}
    </div>
  );
}
