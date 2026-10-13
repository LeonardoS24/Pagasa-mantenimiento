import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { getDocumentosDePruebas } from "@/lib/test-documents";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { TestDocumentsPicker } from "@/components/city/TestDocumentsPicker";

// Todos los documentos subidos en los registros de las unidades de la
// ciudad (ultrasonidos, inspecciones, hermeticidad, hidrostática, válvulas,
// etc.) en un solo lugar, para elegir cuáles descargar juntos en un ZIP.
// Solo lectura: subir y borrar se sigue haciendo en el registro de cada
// unidad, así que aquí basta con poder ver la ciudad (también LECTOR).
export default async function DocumentosDePruebasPage({ params }: { params: { citySlug: string } }) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const city = await assertCityAccess(user, params.citySlug);

  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];
  const documentos = await getDocumentosDePruebas(cityIds);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/dashboard" },
          { label: city.name, href: `/ciudades/${city.slug}` },
          { label: "Documentos de pruebas" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Documentos de pruebas</h1>
        <p className="mt-1 text-sm text-ink">
          Ultrasonidos, inspecciones y demás documentos subidos en los registros de cada unidad
          {esAgregada ? " de todas las ciudades" : ` de ${city.name}`}. Marca los que quieras y descárgalos juntos en un
          ZIP.
        </p>
      </div>
      <TestDocumentsPicker
        documentos={documentos}
        zipAction={`/api/ciudades/${city.slug}/documentos-zip`}
        mostrarCiudad={esAgregada}
      />
    </div>
  );
}
