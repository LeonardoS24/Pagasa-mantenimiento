import Link from "next/link";
import { HORAS_PARA_AVISO, getEstadoExterno, getRutaExterna, horasDesde } from "@/lib/respaldo-externo";

// Aviso en Inicio, solo para el ADMIN, cuando la "Copia de seguridad
// servidor" (memoria USB) no está configurada o tiene más de 48 h sin una
// copia buena. Es el único lugar donde alguien se entera sin entrar a
// /admin/respaldos.
export async function AvisoCopiaExterna() {
  const [ruta, estado] = await Promise.all([getRutaExterna(), getEstadoExterno()]);
  const horas = horasDesde(estado.ultimoExito?.fecha);
  if (ruta && horas < HORAS_PARA_AVISO) return null;

  const texto = !ruta
    ? "No hay copia de seguridad fuera de este equipo: elige la memoria USB donde se guardará."
    : estado.ultimoExito
      ? `La copia de seguridad en la memoria USB tiene ${Math.floor(horas / 24)} día(s) sin hacerse. ¿Está conectada?`
      : "Todavía no se ha hecho ninguna copia de seguridad en la memoria USB.";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{texto}</span>
      <Link href="/admin/respaldos" className="font-semibold underline">
        Ir a Respaldos
      </Link>
    </div>
  );
}
