import { Fragment } from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { normalizeForSearch } from "@/lib/text-normalize";
import { SEARCH_SCOPES, parseScopedQuery } from "@/lib/search-scopes";
import { combustibleLabels, calidadExtintorLabels, type Combustible, type CalidadExtintor } from "@/lib/vehicle-enums";
import {
  tipoEquipoLabels,
  estadoEquipoLabels,
  criticidadEquipoLabels,
  type TipoEquipo,
  type EstadoEquipo,
  type CriticidadEquipo,
} from "@/lib/equipo-enums";
import type {
  VehicleRecord,
  VehicleTechnicalSheet,
  StationTankTechnicalSheet,
  Equipo,
} from "@prisma/client";

type RecordWithSheet = VehicleRecord & {
  technicalSheet: VehicleTechnicalSheet | null;
  stationTankTechnicalSheet: StationTankTechnicalSheet | null;
  section: { name: string; city: { name: string; slug: string }; parent: { name: string } | null };
};

type EquipoWithSection = Equipo & {
  section: { name: string; city: { name: string; slug: string }; parent: { name: string } | null };
};

// Cada campo buscable se agrupa por la subsección/recuadro de la ficha
// técnica donde vive (mismos nombres que las tarjetas de color en
// TechnicalSheetForm/TechnicalSheetView), para poder decirle al usuario
// dónde exactamente se encontró su búsqueda.
function vehicleMatchedGroups(
  record: RecordWithSheet,
  qNorm: string,
  // Si viene, solo se buscan los campos de esos recuadros (ver
  // lib/search-scopes.ts): así "tanque 5000" no encuentra un "5000" que esté
  // en el peso del automóvil.
  soloGrupos?: string[]
): string[] {
  const sheet = record.technicalSheet;
  const tanque = record.stationTankTechnicalSheet;
  const matchers: { group: string; value: string | null | undefined }[] = [
    { group: "Datos generales", value: record.numeroEconomico },
    { group: "Datos generales", value: record.placas },
    { group: "Datos generales", value: record.sucursal },
    { group: "Datos generales", value: record.observaciones },
    { group: "Datos generales", value: record.anio },
    // Estación / Planta
    { group: "Estación · Datos", value: record.permisionaria },
    { group: "Estación · Datos", value: record.permiso },
    { group: "Estación · Tanque", value: tanque?.numeroSerie },
    { group: "Estación · Tanque", value: tanque?.marca },
    { group: "Estación · Tanque", value: tanque?.modelo },
    { group: "Estación · Tanque", value: tanque?.tipo },
    { group: "Estación · Tanque", value: tanque?.anioFabricacion },
    { group: "Estación · Tanque", value: tanque?.capacidad },
    { group: "Estación · Tanque", value: tanque?.presionDiseno },
    { group: "Estación · Tanque", value: tanque?.materialCuerpo },
    { group: "Estación · Tanque", value: tanque?.materialCabeza },
    // Chofer y póliza
    { group: "Ficha técnica · Chofer y póliza", value: sheet?.chofer },
    { group: "Ficha técnica · Chofer y póliza", value: sheet?.numeroPoliza },
    { group: "Ficha técnica · Chofer y póliza", value: sheet?.inciso },
    { group: "Ficha técnica · Automóvil", value: sheet?.marca },
    { group: "Ficha técnica · Automóvil", value: sheet?.linea },
    { group: "Ficha técnica · Automóvil", value: sheet?.modelo },
    { group: "Ficha técnica · Automóvil", value: sheet?.peso },
    { group: "Ficha técnica · Automóvil", value: sheet?.pesoBrutoVacio },
    { group: "Ficha técnica · Automóvil", value: sheet?.pesoBrutoMaximo },
    { group: "Ficha técnica · Automóvil", value: sheet?.serie },
    { group: "Ficha técnica · Automóvil", value: sheet?.caracteristicas },
    { group: "Ficha técnica · Automóvil", value: sheet?.horasUsoDiario },
    {
      group: "Ficha técnica · Automóvil",
      value: sheet?.combustible ? combustibleLabels[sheet.combustible as Combustible] : null,
    },
    { group: "Ficha técnica · Tanque", value: sheet?.capacidadTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.marcaTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.anioFabricacionTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.numeroSerieTanque },
    { group: "Ficha técnica · Extintor", value: sheet?.calidadExtintor ? calidadExtintorLabels[sheet.calidadExtintor as CalidadExtintor] : null },
    { group: "Ficha técnica · Ultrasonido", value: sheet?.numeroUltimoUltrasonido },
    { group: "Ficha técnica · Inspección Visual Externa", value: sheet?.numeroUltimaInspeccionVisual },
    { group: "Ficha técnica · Prueba de Hermeticidad", value: sheet?.numeroUltimaPruebaHermeticidad },
    { group: "Ficha técnica · Inspección Visual Interna", value: sheet?.numeroUltimaInspeccionVisualInterna },
    { group: "Ficha técnica · Prueba Hidrostática", value: sheet?.numeroUltimaPruebaHidrostatica },
  ];
  const groups = new Set<string>();
  for (const matcher of matchers) {
    if (soloGrupos && !soloGrupos.includes(matcher.group)) continue;
    if (matcher.value && normalizeForSearch(matcher.value).includes(qNorm)) groups.add(matcher.group);
  }
  return Array.from(groups);
}

function vehicleMatches(record: RecordWithSheet, qNorm: string, soloGrupos?: string[]): boolean {
  return vehicleMatchedGroups(record, qNorm, soloGrupos).length > 0;
}

function equipoMatchedGroups(equipo: EquipoWithSection, qNorm: string): string[] {
  const matchers: { group: string; value: string | null | undefined }[] = [
    { group: "Datos generales", value: equipo.codigo },
    { group: "Datos generales", value: equipo.nombre },
    { group: "Datos generales", value: equipo.categoria },
    { group: "Datos generales", value: equipo.ubicacion },
    { group: "Datos generales", value: equipo.responsable },
    { group: "Datos generales", value: tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] },
    { group: "Detalle técnico", value: equipo.tipoEquipoDetalle },
    { group: "Detalle técnico", value: equipo.marca },
    { group: "Detalle técnico", value: equipo.modelo },
    { group: "Detalle técnico", value: equipo.numeroSerie },
    { group: "Detalle técnico", value: equipo.fabricante },
    { group: "Detalle técnico", value: equipo.anioFabricacion },
    { group: "Estado", value: equipo.estado ? estadoEquipoLabels[equipo.estado as EstadoEquipo] : null },
    { group: "Estado", value: equipo.criticidad ? criticidadEquipoLabels[equipo.criticidad as CriticidadEquipo] : null },
    { group: "Observaciones", value: equipo.observaciones },
  ];
  const groups = new Set<string>();
  for (const matcher of matchers) {
    if (matcher.value && normalizeForSearch(matcher.value).includes(qNorm)) groups.add(matcher.group);
  }
  return Array.from(groups);
}

// Una unidad/equipo dado de baja solo se considera "coincidencia específica"
// (y por lo tanto conserva su posición normal en los resultados) cuando la
// búsqueda coincide exactamente con su identificador principal. Cualquier
// otra coincidencia (general, parcial) la manda hasta el final.
function isSpecificVehicleMatch(record: RecordWithSheet, qNorm: string): boolean {
  return (
    normalizeForSearch(record.numeroEconomico) === qNorm ||
    (Boolean(record.placas) && normalizeForSearch(record.placas!) === qNorm)
  );
}

function isSpecificEquipoMatch(equipo: EquipoWithSection, qNorm: string): boolean {
  return Boolean(equipo.codigo && normalizeForSearch(equipo.codigo) === qNorm) ||
    normalizeForSearch(equipo.nombre) === qNorm;
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: { q?: string; en?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);
  const cityIds = cities.map((city) => city.id);

  const q = (searchParams.q ?? "").trim();
  // "tanque 5000" acota la búsqueda a los datos del tanque (ver
  // lib/search-scopes.ts); el selector de al lado hace lo mismo.
  const { scope, term, scopeFromText } = parseScopedQuery(q, searchParams.en);
  const qNorm = normalizeForSearch(term);
  const soloGrupos = scope?.groups;

  // El total de unidades y equipos es chico (cientos, no miles), así que se
  // trae todo lo accesible para el usuario y se filtra en JS ya normalizado:
  // así "kg138" encuentra "KG 138" o "KG-138" sin depender de que el LIKE de
  // SQLite adivine dónde van los espacios o guiones.
  const candidateVehicles = qNorm
    ? await prisma.vehicleRecord.findMany({
        where: { section: { cityId: { in: cityIds } } },
        include: {
          section: { include: { city: true, parent: true } },
          technicalSheet: true,
          stationTankTechnicalSheet: true,
        },
      })
    : [];
  const records = candidateVehicles
    .filter((record) => vehicleMatches(record, qNorm, soloGrupos))
    .sort((a, b) => {
      const aPushed = !a.activo && !isSpecificVehicleMatch(a, qNorm);
      const bPushed = !b.activo && !isSpecificVehicleMatch(b, qNorm);
      if (aPushed !== bPushed) return aPushed ? 1 : -1;
      return a.numeroEconomico.localeCompare(b.numeroEconomico);
    });

  const candidateEquipos = qNorm
    ? await prisma.equipo.findMany({
        where: { section: { cityId: { in: cityIds } } },
        include: { section: { include: { city: true, parent: true } } },
      })
    : [];
  const equipos = candidateEquipos
    .filter((equipo) => equipoMatchedGroups(equipo, qNorm).length > 0)
    .sort((a, b) => {
      const aPushed = !a.activo && !isSpecificEquipoMatch(a, qNorm);
      const bPushed = !b.activo && !isSpecificEquipoMatch(b, qNorm);
      if (aPushed !== bPushed) return aPushed ? 1 : -1;
      return a.nombre.localeCompare(b.nombre);
    });

  const hasResults = records.length > 0 || equipos.length > 0;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-primary">Buscar</h1>
      <p className="mb-6 text-sm text-ink">
        Busca unidades y equipos por cualquier dato de su ficha: número económico, placas,
        marca, modelo, número de serie y más. No hace falta escribir espacios ni guiones tal
        cual se capturaron.
      </p>

      <form action="/buscar" method="GET" className="mb-3 flex max-w-2xl flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Ej. 1234, ABC-123, tanque 5000, ultrasonido 192..."
          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          name="en"
          defaultValue={searchParams.en ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Buscar en todo</option>
          {SEARCH_SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              Solo en: {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          Buscar
        </button>
      </form>

      {scope && (
        <p className="mb-6 text-sm text-ink">
          Buscando <span className="font-medium">“{term}”</span> solo en{" "}
          <span className="font-medium">{scope.label}</span>
          {scopeFromText && (
            <>
              {" "}
              <span className="text-gray-500">
                (lo tomé de la palabra “{q.slice(0, q.length - term.length).trim()}”)
              </span>
            </>
          )}
          .
        </p>
      )}

      {!q && <p className="text-sm text-gray-500">Escribe un término para comenzar a buscar.</p>}

      {q && !hasResults && (
        <p className="text-sm text-gray-500">
          No se encontraron resultados para <span className="font-medium text-ink">“{q}”</span>.
        </p>
      )}

      {records.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">
            Unidades ({records.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2">Número económico</th>
                  <th className="whitespace-nowrap px-4 py-2">Placas</th>
                  <th className="whitespace-nowrap px-4 py-2">Marca/Dirección</th>
                  <th className="whitespace-nowrap px-4 py-2">Ubicación</th>
                  <th className="whitespace-nowrap px-4 py-2">Coincide en</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => {
                  const location = [
                    record.section.city.name,
                    record.section.parent?.name,
                    record.section.name,
                  ]
                    .filter(Boolean)
                    .join(" / ");
                  const matchedGroups = vehicleMatchedGroups(record, qNorm);
                  const isPushedDown = !record.activo && !isSpecificVehicleMatch(record, qNorm);
                  const isFirstPushedDown =
                    isPushedDown &&
                    (index === 0 ||
                      records[index - 1].activo ||
                      isSpecificVehicleMatch(records[index - 1], qNorm));
                  return (
                    <Fragment key={record.id}>
                      {isFirstPushedDown && (
                        <tr aria-hidden="true">
                          <td colSpan={5} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Dadas de baja
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="relative border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-primary">
                          {/* Estira el link a toda la fila (no solo el número
                              económico): "tr" es "relative" y este link
                              "absolute inset-0" toma su tamaño completo. */}
                          <Link
                            href={`/ciudades/${record.section.city.slug}/vehiculo/${record.id}`}
                            className="absolute inset-0"
                            aria-label={record.numeroEconomico}
                          />
                          <div className="whitespace-nowrap">
                            <Link
                              href={`/ciudades/${record.section.city.slug}/vehiculo/${record.id}`}
                              className="relative hover:underline"
                              tabIndex={-1}
                            >
                              {record.numeroEconomico}
                            </Link>
                            {!record.activo && (
                              <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                                Dado de baja
                              </span>
                            )}
                          </div>
                          {/* El mismo número económico existe a menudo en dos
                              apartados (Auto-Tanques y carburación). Sin esto no
                              se sabe a cuál de las dos fichas se va a entrar. */}
                          <span className="mt-0.5 block whitespace-nowrap text-xs font-normal text-gray-500">
                            {record.section.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{location}</td>
                        <td className="px-4 py-2 text-ink">
                          <div className="flex flex-wrap gap-1">
                            {matchedGroups.map((group) => (
                              <span
                                key={group}
                                className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {group}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {equipos.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">
            Equipos ({equipos.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2">Código</th>
                  <th className="whitespace-nowrap px-4 py-2">Nombre</th>
                  <th className="whitespace-nowrap px-4 py-2">Tipo</th>
                  <th className="whitespace-nowrap px-4 py-2">Ubicación</th>
                  <th className="whitespace-nowrap px-4 py-2">Coincide en</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((equipo, index) => {
                  const location = [
                    equipo.section.city.name,
                    equipo.section.parent?.name,
                    equipo.section.name,
                  ]
                    .filter(Boolean)
                    .join(" / ");
                  const matchedGroups = equipoMatchedGroups(equipo, qNorm);
                  const isPushedDown = !equipo.activo && !isSpecificEquipoMatch(equipo, qNorm);
                  const isFirstPushedDown =
                    isPushedDown &&
                    (index === 0 ||
                      equipos[index - 1].activo ||
                      isSpecificEquipoMatch(equipos[index - 1], qNorm));
                  return (
                    <Fragment key={equipo.id}>
                      {isFirstPushedDown && (
                        <tr aria-hidden="true">
                          <td colSpan={5} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Dados de baja
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="relative border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-primary">
                          {/* Estira el link a toda la fila (no solo el
                              código/nombre): "tr" es "relative" y este link
                              "absolute inset-0" toma su tamaño completo. */}
                          <Link
                            href={`/ciudades/${equipo.section.city.slug}/equipo/${equipo.id}`}
                            className="absolute inset-0"
                            aria-label={equipo.codigo || equipo.nombre}
                          />
                          <div className="whitespace-nowrap">
                            <Link
                              href={`/ciudades/${equipo.section.city.slug}/equipo/${equipo.id}`}
                              className="relative hover:underline"
                              tabIndex={-1}
                            >
                              {equipo.codigo || equipo.nombre}
                            </Link>
                            {!equipo.activo && (
                              <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                                Dado de baja
                              </span>
                            )}
                          </div>
                          <span className="mt-0.5 block whitespace-nowrap text-xs font-normal text-gray-500">
                            {equipo.section.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{equipo.nombre}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">
                          {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{location}</td>
                        <td className="px-4 py-2 text-ink">
                          <div className="flex flex-wrap gap-1">
                            {matchedGroups.map((group) => (
                              <span
                                key={group}
                                className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {group}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
