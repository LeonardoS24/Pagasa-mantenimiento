import Link from "next/link";

// Dirección que no existe fuera del sistema (o antes de iniciar sesión).
export default function NoEncontrado() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
      <div className="w-full rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-4xl font-semibold text-primary-bright">404</p>
        <h1 className="mb-2 text-xl font-semibold text-primary">No encontramos esta página</h1>
        <p className="mb-6 text-sm text-ink">La dirección no existe o está mal escrita.</p>
        <Link
          href="/"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
