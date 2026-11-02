import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { RegistrosDesdeExcelPanel } from "@/components/registro-lote/RegistrosDesdeExcelPanel";

// Registros NUEVOS de bitácora desde un Excel (una hoja por tipo, un renglón por
// registro). Se revisa todo antes de guardar y se confirma con contraseña.
// Ver lib/registros-excel.ts y actions/registro-lote-actions.ts.
export default async function RegistrosDesdeExcelPage({ params }: { params: { citySlug: string } }) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Registros desde Excel" }]} />
      <h1 className="text-2xl font-semibold text-primary">Registros nuevos desde Excel</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        <li>
          Descarga la plantilla: trae una hoja por tipo de registro (ultrasonido, extintor, mantenimiento, mangueras, póliza…) con las unidades de {city.name} ya puestas
          y las mismas columnas que pide cada bitácora.
        </li>
        <li>Llena solo los renglones de las unidades a las que les hiciste ese registro. Los renglones sin datos se ignoran. Fechas como dd/mm/aaaa.</li>
        <li>Súbela aquí: el sistema te muestra cada registro y los renglones con problema. Nada se guarda hasta que escribas tu contraseña y confirmes.</li>
      </ol>
      <a
        href={`/api/ciudades/${city.slug}/plantilla-registros`}
        className="inline-block rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
      >
        Descargar plantilla
      </a>
      {canEdit(user.role) ? (
        <RegistrosDesdeExcelPanel citySlug={city.slug} />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-ink">
          Subir registros lo puede hacer un administrador o un usuario con permiso de edición. Puedes descargar la plantilla para revisar.
        </p>
      )}
    </div>
  );
}
