import Link from "next/link";
import { resumenRegistros, type ConteoRegistros } from "@/lib/traspaso-tanque";

type Traspaso = {
  id: string;
  origenId: string | null;
  destinoId: string | null;
  origenNumero: string;
  origenCiudadNombre: string;
  destinoNumero: string;
  destinoCiudadNombre: string;
  numeroSerieTanque: string | null;
  registros: string;
  motivo: string | null;
  username: string;
  createdAt: Date;
  origenCitySlug: string | null;
  destinoCitySlug: string | null;
};

// createdAt es un momento, no una fecha de calendario: se lee en la hora del
// servidor (formatDate lo lee en UTC y de noche daba el día siguiente).
const fechaLocal = (f: Date) => f.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });

function leerRegistros(texto: string): Partial<ConteoRegistros> {
  try {
    return JSON.parse(texto) as Partial<ConteoRegistros>;
  } catch {
    return {};
  }
}

// De dónde vino el tanque de esta unidad o a dónde se fue (TraspasoTanque).
export function TraspasosDeTanque({ vehicleId, traspasos }: { vehicleId: string; traspasos: Traspaso[] }) {
  if (traspasos.length === 0) return null;
  const enlace = (id: string | null, citySlug: string | null, texto: string) =>
    id && citySlug ? (
      <Link href={`/ciudades/${citySlug}/vehiculo/${id}`} className="font-medium text-primary hover:underline">
        {texto}
      </Link>
    ) : (
      <span className="font-medium">{texto}</span>
    );

  return (
    <div id="tanque-traspasos" className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Historial del tanque</h2>
      <ul className="space-y-2 text-sm text-ink">
        {traspasos.map((t) => {
          const llego = t.destinoId === vehicleId;
          const serie = t.numeroSerieTanque ? ` (serie ${t.numeroSerieTanque})` : "";
          return (
            <li key={t.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <p>
                <span className="font-medium">{fechaLocal(t.createdAt)}</span> ·{" "}
                {llego ? (
                  <>
                    El tanque{serie} llegó de {enlace(t.origenId, t.origenCitySlug, `${t.origenNumero} (${t.origenCiudadNombre})`)},
                    unidad dada de baja.
                  </>
                ) : (
                  <>
                    El tanque{serie} se pasó a {enlace(t.destinoId, t.destinoCitySlug, `${t.destinoNumero} (${t.destinoCiudadNombre})`)}.
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">
                Registros que se fueron con el tanque: {resumenRegistros(leerRegistros(t.registros))} · Por {t.username}
                {t.motivo ? ` · ${t.motivo}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
