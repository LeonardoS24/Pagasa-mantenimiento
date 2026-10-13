// Ícono + color por tipo de apartado, para diferenciar visualmente las
// distintas zonas del sistema (unidades, bitácoras, documentos, etc.) sin
// depender solo del texto.
type IconDef = { path: React.ReactNode; badge: string };

const ICONS: Record<string, IconDef> = {
  "unidad-de-distribucion": {
    badge: "bg-primary/10 text-primary",
    path: (
      <>
        <rect x="1.5" y="7" width="12" height="8" rx="1" />
        <path d="M13.5 10h3.5l3 3v2h-6.5z" />
        <circle cx="6" cy="17.5" r="1.6" />
        <circle cx="16.5" cy="17.5" r="1.6" />
      </>
    ),
  },
  "auto-tanques": { badge: "bg-primary/10 text-primary", path: null },
  "vehiculo-de-reparto": { badge: "bg-primary/10 text-primary", path: null },
  "vehiculo-con-tanque-de-carburacion": { badge: "bg-primary/10 text-primary", path: null },
  "unidades-utilitarias": { badge: "bg-primary/10 text-primary", path: null },
  "parque-vehicular": { badge: "bg-primary/10 text-primary", path: null },
  // Transportadora Kino (ver lib/kino-sections.ts).
  tractocamiones: { badge: "bg-primary/10 text-primary", path: null },
  semirremolques: { badge: "bg-primary/10 text-primary", path: null },
  // Aunque ahora vive como apartado de nivel superior (no dentro de "Unidad
  // de distribución", ver scripts/move-estaciones-de-carburacion-top-level.mjs),
  // sigue siendo el mismo tipo de apartado (tabla + alta de registros): mismo
  // color que Auto-Tanques/Vehículo de reparto/etc.
  "estaciones-de-carburacion": { badge: "bg-primary/10 text-primary", path: null },
  manuales: {
    badge: "bg-slate-100 text-slate-500",
    path: (
      <>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v17H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H12v17h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </>
    ),
  },
  "programa-de-mantenimiento": {
    badge: "bg-emerald-50 text-emerald-600",
    path: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        <path d="m8 14 2.3 2.3L16 11" />
      </>
    ),
  },
  equipos: {
    badge: "bg-gray-100 text-gray-500",
    path: (
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5l3 3 6.3-6.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2.1-.5-.5-2.1z" />
    ),
  },
  // "Planta" (ver scripts/restructure-planta-section.mjs): apartado
  // contenedor, en el lugar donde antes vivía "Equipos" a nivel superior —
  // mismo color, para que se note el parentesco. Adentro tiene dos hijos:
  // "planta-ficha-tecnica" (mismo ícono que Estaciones/Auto-Tanques, ver el
  // bucle más abajo) y "equipos" (el de arriba, reutilizado sin cambios).
  planta: {
    badge: "bg-gray-100 text-gray-500",
    path: (
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5l3 3 6.3-6.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2.1-.5-.5-2.1z" />
    ),
  },
  "planta-ficha-tecnica": { badge: "bg-primary/10 text-primary", path: null },
  "bitacoras-de-unidades": {
    badge: "bg-accent/10 text-accent/80",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  "bitacora-de-estaciones": {
    badge: "bg-teal-100 text-teal-700",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  "bitacora-de-equipos": {
    badge: "bg-indigo-100 text-indigo-600",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  "orden-de-pieza": {
    badge: "bg-orange-100 text-orange-700",
    path: (
      <>
        <rect x="3" y="6" width="14" height="14" rx="1.5" />
        <path d="M6.5 6V4.5A2 2 0 0 1 8.5 2.5h3A2 2 0 0 1 13.5 4.5V6" />
        <path d="M18 10.5h3M19.5 9v3" />
      </>
    ),
  },
  inventarios: {
    badge: "bg-sky-50 text-sky-600",
    path: (
      <>
        <path d="M3.5 8 12 3.5 20.5 8 12 12.5z" />
        <path d="M3.5 8v9L12 21.5 20.5 17V8" />
        <path d="M12 12.5V21.5" />
      </>
    ),
  },
  resumen: {
    badge: "bg-violet-50 text-violet-600",
    path: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-7" />
        <path d="M3 20h18" />
      </>
    ),
  },
};

// Los tipos de unidades reutilizan el ícono de camión de su padre.
for (const slug of [
  "auto-tanques",
  "vehiculo-de-reparto",
  "vehiculo-con-tanque-de-carburacion",
  "unidades-utilitarias",
  "parque-vehicular",
  "tractocamiones",
  "semirremolques",
  "estaciones-de-carburacion",
  "planta-ficha-tecnica",
]) {
  ICONS[slug].path = ICONS["unidad-de-distribucion"].path;
}

const DEFAULT_ICON: IconDef = {
  badge: "bg-gray-100 text-gray-500",
  path: <rect x="4" y="4" width="16" height="16" rx="2" />,
};

export function getSectionIconDef(slug: string): IconDef {
  return ICONS[slug] ?? DEFAULT_ICON;
}

export function SectionIcon({ slug, className }: { slug: string; className?: string }) {
  const def = getSectionIconDef(slug);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md ${def.badge} ${className ?? "h-9 w-9"}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {def.path}
      </svg>
    </span>
  );
}
