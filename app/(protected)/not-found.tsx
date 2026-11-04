import Link from "next/link";

// notFound() dentro del sistema: una ciudad, unidad o documento que no existe
// o al que esta cuenta no tiene acceso (a propósito se ve igual, para no
// revelar qué existe). Se pinta con el encabezado y el menú lateral.
export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-4xl font-semibold text-primary-bright">404</p>
        <h1 className="mb-2 text-xl font-semibold text-primary">No encontramos esta página</h1>
        <p className="mb-6 text-sm text-ink">
          Puede que se haya eliminado, que la dirección esté mal escrita o que tu cuenta no tenga acceso a ella.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
