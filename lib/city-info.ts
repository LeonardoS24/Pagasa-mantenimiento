// Estado real de cada sede (dato verificable, no decorativo) + un color
// distintivo por ciudad, para que las tarjetas del inicio se puedan
// diferenciar de un vistazo además del nombre. hoverBorder es el mismo color
// pero como borde al pasar el cursor (ver components/city/CityCard.tsx): cada
// ciudad cambia a SU propio color, igual que ya hacía Administración con el
// acento naranja.
export type CityInfo = { estado: string; badge: string; hoverBorder: string };

export const CITY_INFO: Record<string, CityInfo> = {
  hermosillo: { estado: "Sonora", badge: "bg-primary/10 text-primary", hoverBorder: "hover:border-primary" },
  "cajeme-ciudad-obregon": {
    estado: "Sonora",
    badge: "bg-teal-100 text-teal-700",
    hoverBorder: "hover:border-teal-400",
  },
  guaymas: { estado: "Sonora", badge: "bg-cyan-100 text-cyan-700", hoverBorder: "hover:border-cyan-400" },
  navojoa: {
    estado: "Sonora",
    badge: "bg-emerald-100 text-emerald-700",
    hoverBorder: "hover:border-emerald-400",
  },
  huatabampo: { estado: "Sonora", badge: "bg-lime-100 text-lime-700", hoverBorder: "hover:border-lime-400" },
  nogales: { estado: "Sonora", badge: "bg-amber-100 text-amber-700", hoverBorder: "hover:border-amber-400" },
  "magdalena-magdalena-de-kino": {
    estado: "Sonora",
    badge: "bg-violet-100 text-violet-700",
    hoverBorder: "hover:border-violet-400",
  },
  "san-luis-rio-colorado": {
    estado: "Sonora",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    hoverBorder: "hover:border-fuchsia-400",
  },
  mexicali: {
    estado: "Baja California",
    badge: "bg-indigo-100 text-indigo-700",
    hoverBorder: "hover:border-indigo-400",
  },
  tijuana: { estado: "Baja California", badge: "bg-rose-100 text-rose-700", hoverBorder: "hover:border-rose-400" },
  empalme: { estado: "Sonora", badge: "bg-slate-200 text-slate-700", hoverBorder: "hover:border-slate-400" },
  caborca: { estado: "Sonora", badge: "bg-orange-100 text-orange-700", hoverBorder: "hover:border-orange-400" },
  "puerto-penasco": { estado: "Sonora", badge: "bg-sky-100 text-sky-700", hoverBorder: "hover:border-sky-400" },
  "agua-prieta": {
    estado: "Sonora",
    badge: "bg-stone-200 text-stone-700",
    hoverBorder: "hover:border-stone-400",
  },
  "san-miguel-de-horcasitas": {
    estado: "Sonora",
    badge: "bg-zinc-200 text-zinc-700",
    hoverBorder: "hover:border-zinc-400",
  },
  ensenada: { estado: "Baja California", badge: "bg-blue-100 text-blue-700", hoverBorder: "hover:border-blue-400" },
  // "Administración" (ver lib/aggregate-city.ts) no es una sede real, así
  // que se distingue con su propia etiqueta en vez de un estado.
  administracion: {
    estado: "Vista combinada",
    badge: "bg-accent/10 text-accent",
    hoverBorder: "hover:border-accent",
  },
};

const DEFAULT_INFO: CityInfo = {
  estado: "",
  badge: "bg-gray-100 text-gray-500",
  hoverBorder: "hover:border-gray-400",
};

export function getCityInfo(slug: string): CityInfo {
  return CITY_INFO[slug] ?? DEFAULT_INFO;
}
