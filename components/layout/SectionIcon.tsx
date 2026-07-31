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
  manuales: {
    badge: "bg-slate-100 text-slate-600",
    path: (
      <>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v17H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H12v17h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </>
    ),
  },
  "programa-de-mantenimiento": {
    badge: "bg-emerald-100 text-emerald-700",
    path: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        <path d="m8 14 2.3 2.3L16 11" />
      </>
    ),
  },
  "equipos-mecanicos": {
    badge: "bg-gray-200 text-gray-700",
    path: (
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5l3 3 6.3-6.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2.1-.5-.5-2.1z" />
    ),
  },
  "equipos-electronicos": {
    badge: "bg-amber-100 text-amber-700",
    path: <path d="M12.5 2 4 13h6l-1 9 8.5-11h-6z" />,
  },
  "bitacoras-de-unidades": {
    badge: "bg-accent/10 text-accent",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  "bitacoras-de-equipos-mecanicos": {
    badge: "bg-accent/10 text-accent",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  "bitacora-de-equipos-electronicos": {
    badge: "bg-accent/10 text-accent",
    path: (
      <>
        <rect x="4" y="3.5" width="16" height="18" rx="1.5" />
        <path d="M8.5 2h7v3h-7z" />
        <path d="M7.5 10.5h9M7.5 14h9M7.5 17.5h5.5" />
      </>
    ),
  },
  inventarios: {
    badge: "bg-sky-100 text-sky-700",
    path: (
      <>
        <path d="M3.5 8 12 3.5 20.5 8 12 12.5z" />
        <path d="M3.5 8v9L12 21.5 20.5 17V8" />
        <path d="M12 12.5V21.5" />
      </>
    ),
  },
};

// Los 5 tipos de unidades reutilizan el ícono de camión de su padre.
for (const slug of [
  "auto-tanques",
  "vehiculo-de-reparto",
  "vehiculo-con-tanque-de-carburacion",
  "unidades-utilitarias",
  "parque-vehicular",
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
