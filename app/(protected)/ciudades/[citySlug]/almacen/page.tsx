import { redirect } from "next/navigation";

// El inventario de almacén vive dentro del apartado «Inventarios» de la ciudad
// (ver components/almacen/AlmacenSeccion.tsx); esta ruta quedó de antes.
export default function AlmacenPage({ params }: { params: { citySlug: string } }) {
  redirect(`/ciudades/${params.citySlug}/inventarios`);
}
