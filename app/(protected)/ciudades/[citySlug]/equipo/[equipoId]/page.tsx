import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/roles";
import { hasActiveElevatedAccess } from "@/lib/elevated-access";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { SectionIcon } from "@/components/layout/SectionIcon";
import { EquipoForm } from "@/components/admin/EquipoForm";
import { CreateEquipmentLogForm } from "@/components/admin/CreateEquipmentLogForm";
import { EquipmentLogTable } from "@/components/city/EquipmentLogTable";
import { DocumentList } from "@/components/city/DocumentList";
import { UploadEquipoDocumentForm } from "@/components/admin/UploadEquipoDocumentForm";
import { ConfirmDeleteWithPassword } from "@/components/admin/ConfirmDeleteWithPassword";
import { updateEquipo, deleteEquipo, previewEquipoDeleteImpact } from "@/actions/equipo-actions";
import { formatDate } from "@/lib/dates";
import { BADGE_STYLES, equipoColorKey } from "@/lib/section-colors";
import { tipoEquipoLabels, estadoEquipoLabels, criticidadEquipoLabels, type TipoEquipo, type EstadoEquipo, type CriticidadEquipo } from "@/lib/equipo-enums";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export default async function EquipoPage({
  params,
}: {
  params: { citySlug: string; equipoId: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  // isAdmin también es true para un USUARIO con acceso ampliado activo en
  // este momento (ver lib/elevated-access.ts).
  const isAdmin =
    user.role === "ADMIN" || (user.role === "USUARIO" && (await hasActiveElevatedAccess(user.userId)));
  const isEditor = canEdit(user.role);

  await assertCityAccess(user, params.citySlug);

  const equipo = await prisma.equipo.findUnique({
    where: { id: params.equipoId },
    include: {
      section: { include: { city: true } },
      documents: { orderBy: { createdAt: "desc" } },
      equipmentLogs: { orderBy: { fecha: "desc" }, include: { documents: true } },
    },
  });

  if (!equipo || equipo.section.city.slug !== params.citySlug) {
    notFound();
  }

  const chain = await getSectionChain(equipo.sectionId);
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Inicio", href: "/dashboard" },
    { label: equipo.section.city.name, href: `/ciudades/${equipo.section.city.slug}` },
    ...chain.map((section) => ({
      label: section.name,
      href: sectionBasePath(equipo.section.city.slug, chain.slice(0, chain.indexOf(section) + 1)),
    })),
    { label: equipo.nombre },
  ];

  const colorKey = equipoColorKey(equipo.tipoEquipo);
  const manuales = equipo.documents.filter((d) => d.kind !== "FOTO");
  const fotografias = equipo.documents.filter((d) => d.kind === "FOTO");

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-6 flex items-center gap-3">
        <SectionIcon slug="equipos" className="h-11 w-11" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">{equipo.nombre}</h1>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
            {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
          </span>
          {!equipo.activo && (
            <span className="ml-2 mt-1 inline-block rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
              Dado de baja{equipo.fechaBaja ? ` — ${formatDate(equipo.fechaBaja)}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">Ficha técnica</h2>
        {isEditor ? (
          <EquipoForm action={updateEquipo.bind(null, equipo.id)} defaults={equipo} submitLabel="Guardar cambios" />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código del equipo" value={equipo.codigo} />
            <Field label="Categoría" value={equipo.categoria} />
            <Field label="Tipo de equipo" value={equipo.tipoEquipoDetalle} />
            <Field label="Marca" value={equipo.marca} />
            <Field label="Modelo" value={equipo.modelo} />
            <Field label="Número de serie" value={equipo.numeroSerie} />
            <Field label="Fabricante" value={equipo.fabricante} />
            <Field label="Año de fabricación" value={equipo.anioFabricacion} />
            <Field label="Fecha de instalación" value={formatDate(equipo.fechaInstalacion)} />
            <Field label="Ubicación" value={equipo.ubicacion} />
            <Field label="Responsable" value={equipo.responsable} />
            <Field
              label="Estado"
              value={equipo.estado ? estadoEquipoLabels[equipo.estado as EstadoEquipo] : null}
            />
            <Field
              label="Criticidad"
              value={equipo.criticidad ? criticidadEquipoLabels[equipo.criticidad as CriticidadEquipo] : null}
            />
            <Field label="Capacidad" value={equipo.capacidad} />
            <Field label="Potencia" value={equipo.potencia} />
            <Field label="Frecuencia de mantenimiento" value={equipo.frecuenciaMantenimiento} />
            {equipo.tipoEquipo === "MECANICO" && (
              <>
                <Field label="Presión de trabajo" value={equipo.presionTrabajo} />
                <Field label="Temperatura de operación" value={equipo.temperaturaOperacion} />
                <Field label="Material de fabricación" value={equipo.materialFabricacion} />
                <Field label="Fluido de trabajo" value={equipo.fluidoTrabajo} />
                <Field label="RPM" value={equipo.rpm} />
                <Field label="Lubricante utilizado" value={equipo.lubricante} />
              </>
            )}
            {equipo.tipoEquipo === "ELECTRICO" && (
              <>
                <Field label="Voltaje" value={equipo.voltaje} />
                <Field label="Corriente" value={equipo.corriente} />
                <Field label="Frecuencia" value={equipo.frecuenciaElectrica} />
                <Field label="Número de fases" value={equipo.numeroFases} />
                <Field label="Protección IP" value={equipo.proteccionIp} />
                <Field label="Clase de aislamiento" value={equipo.claseAislamiento} />
                <Field label="Consumo eléctrico" value={equipo.consumoElectrico} />
                <Field label="Comunicación" value={equipo.comunicacion} />
              </>
            )}
            {equipo.tipoEquipo === "AUXILIAR" && (
              <>
                <Field label="Combustible" value={equipo.combustible} />
                <Field label="Horas de operación" value={equipo.horasOperacion} />
              </>
            )}
            {equipo.observaciones && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-semibold uppercase text-gray-500">Observaciones</dt>
                <dd className="whitespace-pre-wrap">{equipo.observaciones}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Bitácora de mantenimiento</h2>
        <div className="space-y-3">
          {isEditor && <CreateEquipmentLogForm equipoId={equipo.id} />}
          <EquipmentLogTable logs={equipo.equipmentLogs} canEdit={isEditor} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Manual técnico (PDF)</h2>
        <div className="space-y-3">
          {isEditor && <UploadEquipoDocumentForm equipoId={equipo.id} />}
          <DocumentList documents={manuales} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Fotografías</h2>
        <DocumentList documents={fotografias} isAdmin={isAdmin} />
      </div>

      {isAdmin && (
        <div className="mt-10 rounded-lg border border-accent/30 bg-accent/5 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-accent">Zona de peligro</h2>
          <ConfirmDeleteWithPassword
            nombre={equipo.nombre}
            tipo="equipo"
            action={deleteEquipo.bind(null, equipo.id)}
            cargarImpacto={previewEquipoDeleteImpact.bind(null, equipo.id)}
            className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            Eliminar equipo
          </ConfirmDeleteWithPassword>
        </div>
      )}
    </div>
  );
}
