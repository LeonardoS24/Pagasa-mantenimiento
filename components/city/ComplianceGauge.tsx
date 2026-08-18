import { complianceGaugeLevel, complianceGaugeColors } from "@/lib/compliance-checklist";

const SIZE = 120;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Medidor circular de cumplimiento de normatividad: verde 90%+, ámbar
// 60-89%, rojo debajo de 60 (ver lib/compliance-checklist.ts). Mismo patrón
// de SVG dibujado a mano que el resto de las gráficas de la app (sin
// librería externa), aquí como un arco en vez de un pastel.
export function ComplianceGauge({
  porcentaje,
  label,
  size = "md",
}: {
  porcentaje: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const nivel = complianceGaugeLevel(porcentaje);
  const colores = complianceGaugeColors[nivel];
  const dashOffset = CIRCUMFERENCE * (1 - porcentaje / 100);
  const dims = size === "sm" ? 84 : SIZE;
  const fontSize = size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dims, height: dims }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={dims} height={dims} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={colores.track}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-semibold ${fontSize} ${colores.text}`}>{porcentaje}%</span>
        </div>
      </div>
      {label && <p className="text-center text-xs font-medium text-gray-500">{label}</p>}
    </div>
  );
}
