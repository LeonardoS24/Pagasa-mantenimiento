import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aplicaAApartado, parseOpcionesTexto, type CampoTipo } from "@/lib/custom-fields";
import { APARTADOS_ACOMODABLES, RECUADROS_FICHA } from "@/lib/diseno-ficha";
import { getDisenoFicha } from "@/lib/diseno-ficha-servidor";
import { asegurarPlazos } from "@/lib/requisitos-runtime";
import { AcomodarFicha, type RecuadroEditable } from "@/components/admin/AcomodarFicha";

// Editar sistema → Editar fichas: todo lo de la ficha técnica de un apartado
// en un solo lugar (recuadros nuevos donde se elija, renombrar, eliminar u
// ocultar, campos, orden, ancho y color). Contraseña para abrir y para guardar.
export default async function EditarFichasPage({ searchParams }: { searchParams?: { apartado?: string } }) {
  await requireAdmin();

  const apartado = APARTADOS_ACOMODABLES.find((a) => a.slug === searchParams?.apartado) ?? APARTADOS_ACOMODABLES[0];
  const slug = apartado.slug;

  const [secciones, campos, diseno, plazos] = await Promise.all([
    prisma.customSection.findMany({ where: { ambito: "VEHICULO" }, orderBy: [{ orden: "asc" }, { createdAt: "asc" }] }),
    prisma.customField.findMany({
      where: { ambito: "VEHICULO" },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { valores: true } } },
    }),
    getDisenoFicha(slug),
    asegurarPlazos(),
  ]);

  const camposDe = (seccion: string) =>
    campos
      .filter((f) => f.seccion === seccion && aplicaAApartado(f.apartadoSlug, slug))
      .map((f) => ({
        id: f.id,
        etiqueta: f.etiqueta,
        tipo: f.tipo as CampoTipo,
        opciones: f.tipo === "LISTA" ? parseOpcionesTexto(f.opciones) : undefined,
        usos: f._count.valores,
        todos: f.apartadoSlug === null,
      }));

  const recuadros: RecuadroEditable[] = [
    ...RECUADROS_FICHA.filter((r) => r.aplica(slug)).map((r) => ({
      clave: r.clave,
      titulo: r.titulo,
      colorBase: r.color,
      propio: false,
      todos: false,
      campos: camposDe(r.seccionCampos),
    })),
    ...secciones
      .filter((s) => aplicaAApartado(s.apartadoSlug, slug))
      .map((s) => ({
        clave: `x:${s.id}`,
        titulo: s.titulo,
        colorBase: "propio" as const,
        propio: true,
        todos: s.apartadoSlug === null,
        campos: camposDe(`x:${s.id}`),
      })),
  ];

  // Cambia cuando cambia lo guardado: el editor se vuelve a armar con los datos
  // nuevos sin pedir otra vez la contraseña de entrada.
  const version = JSON.stringify([recuadros, diseno]);

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ink">
        Todo lo de la ficha técnica de un apartado se edita aquí: agrega recuadros y elige dónde van, renómbralos o elimínalos, agrégales campos, cambia el orden
        arrastrando, el ancho y el color. Nada se guarda hasta que presionas «Guardar cambios» y escribes tu contraseña. Lo que hagas vale para todas las unidades del
        apartado.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {APARTADOS_ACOMODABLES.map((a) => {
          const activo = a.slug === slug;
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

      <AcomodarFicha key={slug} apartadoSlug={slug} apartadoNombre={apartado.nombre} recuadros={recuadros} inicial={diseno} version={version} plazos={plazos} />
    </div>
  );
}
