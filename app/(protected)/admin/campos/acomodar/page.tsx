import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seccionDePropia } from "@/lib/custom-fields";
import { APARTADOS_ACOMODABLES, RECUADROS_FICHA } from "@/lib/diseno-ficha";
import { getDisenoFicha } from "@/lib/diseno-ficha-servidor";
import { AcomodarFicha, type RecuadroEditable } from "@/components/admin/AcomodarFicha";

// Editar sistema → Acomodar fichas: el ADMIN arrastra los recuadros de la
// ficha técnica de un apartado, les cambia el ancho y el color. Pide la
// contraseña para abrir el editor y otra vez para guardar.
export default async function AcomodarFichasPage({ searchParams }: { searchParams?: { apartado?: string } }) {
  await requireAdmin();

  const apartado = APARTADOS_ACOMODABLES.find((a) => a.slug === searchParams?.apartado) ?? APARTADOS_ACOMODABLES[0];

  const [propios, camposPropios, diseno] = await Promise.all([
    prisma.customSection.findMany({
      where: { ambito: "VEHICULO", OR: [{ apartadoSlug: null }, { apartadoSlug: apartado.slug }] },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    }),
    prisma.customField.findMany({ where: { ambito: "VEHICULO", seccion: { startsWith: "x:" } }, select: { seccion: true } }),
    getDisenoFicha(apartado.slug),
  ]);

  const recuadros: RecuadroEditable[] = [
    ...RECUADROS_FICHA.filter((r) => r.aplica(apartado.slug)).map((r) => ({ clave: r.clave, titulo: r.titulo, colorBase: r.color, propio: false })),
    // Un recuadro propio sin campos no se dibuja en la ficha, así que tampoco aquí.
    ...propios
      .filter((s) => camposPropios.some((c) => c.seccion === seccionDePropia(s.id)))
      .map((s) => ({ clave: `x:${s.id}`, titulo: s.titulo, colorBase: "propio" as const, propio: true })),
  ];

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ink">
        Elige un apartado y acomoda su ficha técnica: arrastra los recuadros para cambiar su orden, escoge si ocupan todo el ancho o la mitad y cámbiales el color. Solo cambia
        cómo se ve; los datos y las alertas no se tocan. Lo que acomodes vale para todas las unidades del apartado. Para agregar campos o recuadros nuevos usa «Campos y
        recuadros».
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {APARTADOS_ACOMODABLES.map((a) => {
          const activo = a.slug === apartado.slug;
          return (
            <Link
              key={a.slug}
              href={`/admin/campos/acomodar?apartado=${a.slug}`}
              aria-current={activo ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                activo ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-ink hover:border-primary hover:text-primary"
              }`}
            >
              {a.nombre}
            </Link>
          );
        })}
      </div>

      <AcomodarFicha key={apartado.slug} apartadoSlug={apartado.slug} apartadoNombre={apartado.nombre} recuadros={recuadros} inicial={diseno} />
    </div>
  );
}
