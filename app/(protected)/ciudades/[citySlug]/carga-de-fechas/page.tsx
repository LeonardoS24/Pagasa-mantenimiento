import { requireUser, tieneEdicionAmpliada } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CargaFechasPanel } from "@/components/carga-fechas/CargaFechasPanel";
import { PALABRA_BORRAR } from "@/lib/carga-fechas";

// Actualizar muchas fechas de la ficha técnica de un jalón: se descarga la
// plantilla con lo que hay hoy, se corrige en Excel y se sube. Nada se guarda
// sin ver antes cada cambio (ver actions/carga-fechas-actions.ts).
export default async function CargaDeFechasPage({ params }: { params: { citySlug: string } }) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const puede = await tieneEdicionAmpliada(user);
  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Carga de fechas desde Excel" }]} />
      <h1 className="text-2xl font-semibold text-primary">Carga de fechas desde Excel</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        <li>
          Descarga la plantilla: trae todas las unidades de {city.name} con las fechas que tienen hoy (pruebas, válvulas,
          mangueras, conector, dictámenes).
        </li>
        <li>
          Corrige o llena las fechas en Excel (dd/mm/aaaa). Una celda vacía no borra nada; para borrar una fecha escribe{" "}
          <span className="font-mono">{PALABRA_BORRAR}</span>.
        </li>
        <li>Súbela aquí, revisa cada cambio y confírmalo.</li>
      </ol>
      <a
        href={`/api/ciudades/${city.slug}/plantilla-fechas`}
        className="inline-block rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
      >
        Descargar plantilla
      </a>
      {puede ? (
        <CargaFechasPanel citySlug={city.slug} />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-ink">
          Subir fechas es como editar la ficha técnica: lo puede hacer un administrador (o un usuario dentro de su horario
          de acceso ampliado). Puedes descargar la plantilla para revisar.
        </p>
      )}
    </div>
  );
}
