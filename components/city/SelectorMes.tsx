"use client";

import { useRouter } from "next/navigation";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Elegir mes y año del calendario directo, sin ir mes por mes. Cambia de página
// al elegir; `base` trae los filtros (tipo, ciudad) ya puestos en la dirección.
export function SelectorMes({
  anio,
  mes,
  anioMin,
  anioMax,
  base,
}: {
  anio: number;
  mes: number; // 0-11
  anioMin: number;
  anioMax: number;
  base: string; // p. ej. "/ciudades/x/calendario?tipo=ultrasonido" o sin "?"
}) {
  const router = useRouter();
  const ir = (a: number, m: number) => {
    const unir = base.includes("?") ? "&" : "?";
    router.push(`${base}${unir}mes=${a}-${String(m + 1).padStart(2, "0")}`);
  };
  const anios: number[] = [];
  for (let a = Math.min(anioMin, anio); a <= Math.max(anioMax, anio); a++) anios.push(a);
  const clases = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-ink";

  return (
    <div className="flex items-center gap-2">
      <select aria-label="Mes" value={mes} onChange={(e) => ir(anio, Number(e.target.value))} className={clases}>
        {MESES.map((nombre, i) => (
          <option key={nombre} value={i}>{nombre}</option>
        ))}
      </select>
      <select aria-label="Año" value={anio} onChange={(e) => ir(Number(e.target.value), mes)} className={clases}>
        {anios.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  );
}
