"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// La lectura del lote corre en el servidor fuera del request (ver
// analizarLote en actions/lote-documentos-actions.ts): mientras dura, la
// página se vuelve a pedir sola cada pocos segundos hasta que cambia de estado.
export function ActualizarMientrasAnaliza({ cadaMs = 5000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), cadaMs);
    return () => clearInterval(intervalo);
  }, [router, cadaMs]);
  return null;
}
