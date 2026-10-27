import Link from "next/link";
import { avisosDeVigencia } from "@/lib/requisitos-normativos";

// Aviso en Inicio, solo para el ADMIN: una norma de emergencia (las que
// rigen Auto-Tanques y Semirremolques) está por vencer. Al vencer hay que
// revisar el DOF y actualizar el catálogo de /admin/normas.
export function AvisoNormasPorVencer() {
  const avisos = avisosDeVigencia();
  if (avisos.length === 0) return null;
  const rojo = avisos.some((a) => a.nivel === "rojo");
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        rojo ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <span>
        {avisos
          .map((a) => `${a.norma} ${a.dias < 0 ? `venció el ${a.vigenteHasta}` : `vence el ${a.vigenteHasta} (${a.dias} días)`}`)
          .join(" · ")}
        . Revisa en el DOF si se prorrogó o se sustituyó.
      </span>
      <Link href="/admin/normas" className="font-semibold underline">
        Ir a Normas y plazos
      </Link>
    </div>
  );
}
