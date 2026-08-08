import { Fragment } from "react";
import Link from "next/link";
import type { Equipo } from "@prisma/client";
import { tipoEquipoLabels, estadoEquipoLabels, estadoEquipoStyles, criticidadEquipoLabels, criticidadEquipoStyles, type EstadoEquipo, type CriticidadEquipo, type TipoEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, SECTION_STYLES, equipoColorKey } from "@/lib/section-colors";

// Orden fijo de los 3 grupos (no alfabético): Mecánico, Eléctrico y
// electrónico, Auxiliar, siempre en este orden sin importar cuántos equipos
// tenga cada uno.
const TIPOS: TipoEquipo[] = ["MECANICO", "ELECTRICO", "AUXILIAR"];

function porNombre(a: Equipo, b: Equipo): number {
  return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
}

function EquipoRow({ equipo, citySlug }: { equipo: Equipo; citySlug: string }) {
  const colorKey = equipoColorKey(equipo.tipoEquipo);
  const estado = equipo.estado as EstadoEquipo | null;
  const criticidad = equipo.criticidad as CriticidadEquipo | null;
  return (
    <tr
      className={`relative border-t border-gray-100 hover:bg-gray-50 ${!equipo.activo ? "bg-orange-50" : ""}`}
    >
      <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
        <Link
          href={`/ciudades/${citySlug}/equipo/${equipo.id}`}
          className="absolute inset-0"
          aria-label={equipo.codigo || equipo.nombre}
        />
        <Link href={`/ciudades/${citySlug}/equipo/${equipo.id}`} className="relative hover:underline" tabIndex={-1}>
          {equipo.codigo || "—"}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-ink">
        {equipo.nombre}
        {!equipo.activo && (
          <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
            Dado de baja
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-ink">{equipo.numeroSerie || "—"}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
          {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {estado && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoEquipoStyles[estado]}`}>
            {estadoEquipoLabels[estado]}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {criticidad && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${criticidadEquipoStyles[criticidad]}`}>
            {criticidadEquipoLabels[criticidad]}
          </span>
        )}
      </td>
    </tr>
  );
}

// Agrupado por tipo (Mecánico/Eléctrico/Auxiliar, cada uno con su color y
// encabezado propio, ver lib/equipo-enums.ts) en vez de una sola lista
// revuelta, y ordenado alfabéticamente por nombre dentro de cada grupo. Los
// dados de baja se quedan aparte al final, como antes.
export function EquipoTable({ equipos, citySlug }: { equipos: Equipo[]; citySlug: string }) {
  if (equipos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay equipos registrados en este apartado.
      </p>
    );
  }

  const activos = equipos.filter((e) => e.activo);
  const inactivos = [...equipos.filter((e) => !e.activo)].sort((a, b) => {
    const fa = a.fechaBaja ? a.fechaBaja.getTime() : 0;
    const fb = b.fechaBaja ? b.fechaBaja.getTime() : 0;
    return fb - fa;
  });

  const grupos = TIPOS.map((tipo) => ({
    tipo,
    equipos: activos.filter((e) => e.tipoEquipo === tipo).sort(porNombre),
  })).filter((g) => g.equipos.length > 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Código</th>
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Número de serie</th>
            <th className="whitespace-nowrap px-4 py-2">Tipo</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            <th className="whitespace-nowrap px-4 py-2">Criticidad</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.tipo}>
              <tr aria-hidden="true">
                <td colSpan={6} className={`border-t-4 border-gray-200 px-4 py-2 ${SECTION_STYLES[equipoColorKey(grupo.tipo)]}`}>
                  <span className="text-xs font-semibold uppercase text-ink">
                    {tipoEquipoLabels[grupo.tipo]} · {grupo.equipos.length}
                  </span>
                </td>
              </tr>
              {grupo.equipos.map((equipo) => (
                <EquipoRow key={equipo.id} equipo={equipo} citySlug={citySlug} />
              ))}
            </Fragment>
          ))}

          {inactivos.length > 0 && (
            <>
              <tr aria-hidden="true">
                <td colSpan={6} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Dados de baja</span>
                </td>
              </tr>
              {inactivos.map((equipo) => (
                <EquipoRow key={equipo.id} equipo={equipo} citySlug={citySlug} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
