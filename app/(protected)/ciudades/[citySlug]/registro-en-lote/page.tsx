import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { canEdit } from "@/lib/roles";
import { CAMPOS_POR_TIPO, tipoLoteLabel } from "@/lib/lote-documentos";
import { TIPOS_EN_LOTE, aplicaEnLote, camposPorUnidad, esTipoEnLote } from "@/lib/registro-lote";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { RegistroEnLote } from "@/components/registro-lote/RegistroEnLote";

// El mismo registro de bitácora (con todos sus campos) para varias unidades de
// un jalón: extintores que se cambian juntos, una inspección a toda la flota,
// etc. Ver actions/registro-lote-actions.ts.
export default async function RegistroEnLotePage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { tipo?: string };
}) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const tipo = esTipoEnLote(searchParams.tipo) ? searchParams.tipo : null;

  let unidades: { id: string; nombre: string; apartado: string; ciudad: string }[] = [];
  if (tipo && canEdit(user.role)) {
    const ids = await idsDeTrabajo(user, city);
    const registros = await prisma.vehicleRecord.findMany({
      where: { activo: true, section: { cityId: { in: ids } } },
      select: {
        id: true,
        numeroEconomico: true,
        section: { select: { name: true, slug: true, city: { select: { name: true } } } },
      },
      orderBy: [{ section: { order: "asc" } }, { numeroEconomico: "asc" }],
    });
    unidades = registros
      .filter((r) => aplicaEnLote(tipo, r.section.slug))
      .map((r) => ({ id: r.id, nombre: r.numeroEconomico, apartado: r.section.name, ciudad: r.section.city.name }));
  }

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Registro en lote" }]} />
      <h1 className="text-2xl font-semibold text-primary">Registro en lote</h1>
      <p className="text-sm text-ink">
        Registra lo mismo en varias unidades a la vez, con los mismos campos que pide cada bitácora. Elige primero el tipo de registro.
      </p>
      <p className="text-sm text-ink">
        ¿Son muchos registros distintos?{" "}
        <Link href={`/ciudades/${city.slug}/registros-desde-excel`} className="font-medium text-primary underline">
          Súbelos desde un Excel
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        {TIPOS_EN_LOTE.map((t) => (
          <Link
            key={t}
            href={`/ciudades/${city.slug}/registro-en-lote?tipo=${t}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              t === tipo ? "border-primary bg-primary text-white" : "border-primary/30 bg-white text-primary hover:bg-primary/5"
            }`}
          >
            {tipoLoteLabel[t]}
          </Link>
        ))}
      </div>

      {!canEdit(user.role) ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-ink">
          Registrar en lote lo puede hacer un administrador o un usuario con permiso de edición.
        </p>
      ) : !tipo ? null : (
        <>
          {camposPorUnidad(tipo).length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>Llena una sola vez los datos que se repiten, como la compañía y la fecha (los marcados con * son obligatorios).</li>
              <li>
                Elige las unidades y escribe en el renglón de cada una lo que es distinto:{" "}
                {CAMPOS_POR_TIPO[tipo]
                  .filter((d) => camposPorUnidad(tipo).includes(d.campo))
                  .map((d) => d.etiqueta.toLowerCase())
                  .join(", ")}
                . Enter pasa a la siguiente unidad.
              </li>
              <li>Revisa lo que se guardará en cada unidad, escribe tu contraseña y confirma.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>Llena una sola vez los datos que se repiten (los marcados con * son obligatorios).</li>
              <li>Elige las unidades. Si a alguna le toca un dato distinto, ábrela con «Ajustar» y ponlo ahí.</li>
              <li>Revisa lo que se guardará en cada unidad, escribe tu contraseña y confirma.</li>
            </ol>
          )}
          <RegistroEnLote key={tipo} citySlug={city.slug} tipo={tipo} unidades={unidades} />
        </>
      )}
    </div>
  );
}
