export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Rango del mes en curso, usado para que los gráficos de mantenimiento "se
// reinicien" cada mes: los registros se guardan para siempre
// (historial/impresión), pero el gráfico solo cuenta lo que cae dentro de
// este rango. Los límites se construyen en UTC (año/mes según la hora local,
// para que "este mes" siga siendo el mes que ve el usuario) porque así es
// como se guarda "fecha" en toda la app: un input type="date" de "2026-08-01"
// se parsea como medianoche UTC (new Date("2026-08-01")), no medianoche
// local. Si el límite se construyera en hora local (UTC-7 en Hermosillo, sin
// horario de verano), un registro fechado el día 1 quedaba antes del inicio
// del rango y se contaba en el mes anterior.
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  return { start, end };
}

export function currentMonthLabel(): string {
  const now = new Date();
  return monthLabel(now.getFullYear(), now.getMonth());
}

// Rango de un mes arbitrario (month 0-indexado, como Date.getMonth()), mismo
// criterio UTC que getCurrentMonthRange. Usado por el selector de mes de
// Administración (ver app/(protected)/ciudades/[citySlug]/[...sectionPath]/page.tsx)
// para revisar la bitácora y las gráficas de un mes que ya pasó, no solo el
// mes en curso.
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

export function monthLabel(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "YYYY-MM", el valor que viaja en la URL (?mes=2026-07) y en el <select>.
export function monthParamValue(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Interpreta el ?mes= de la URL; si falta o es inválido, cae al mes en
// curso. Nunca deja elegir un mes futuro (no hay nada que mostrar todavía).
export function parseMonthParam(value: string | undefined): { year: number; month: number } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() };
  if (!value) return fallback;

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return fallback;

  const candidate = new Date(Date.UTC(year, month, 1));
  const currentStart = new Date(Date.UTC(fallback.year, fallback.month, 1));
  if (candidate.getTime() > currentStart.getTime()) return fallback;

  return { year, month };
}

// Rango del año en curso, mismo criterio UTC que getCurrentMonthRange: para
// que el gráfico de mantenimientos de cada unidad "se reinicie" cada año en
// vez de cada mes (ver components/city/PieceMaintenanceChart.tsx).
export function getCurrentYearRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getFullYear() + 1, 0, 1));
  return { start, end };
}

export function currentYearLabel(): string {
  return String(new Date().getFullYear());
}

// Últimos `count` meses (incluye el actual, más reciente primero) para
// llenar el <select> del selector de mes.
export function listRecentMonths(count: number): { year: number; month: number; value: string; label: string }[] {
  const now = new Date();
  const months = [];
  for (let i = 0; i < count; i++) {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const normalized = new Date(Date.UTC(year, month, 1));
    const y = normalized.getUTCFullYear();
    const m = normalized.getUTCMonth();
    months.push({ year: y, month: m, value: monthParamValue(y, m), label: monthLabel(y, m) });
  }
  return months;
}

// Selección del selector de mes: un mes puntual o "todo el año" (ver
// MesSelector.tsx). Mismo <select> que antes, solo que ahora también se
// puede elegir "Todo <año>" en vez de un mes específico — se sigue viajando
// en la misma URL ?mes=..., nada más que ahora acepta "YYYY" además de
// "YYYY-MM".
export type MesSelection = { type: "month"; year: number; month: number } | { type: "year"; year: number };

export function getYearRange(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { start, end };
}

// Igual que parseMonthParam, pero también reconoce "YYYY" (solo el año) como
// "todo el año". Nunca deja elegir un año futuro por la misma razón que
// parseMonthParam no deja elegir un mes futuro.
export function parseMesParam(value: string | undefined): MesSelection {
  const now = new Date();
  const fallback: MesSelection = { type: "month", year: now.getFullYear(), month: now.getMonth() };
  if (!value) return fallback;

  const yearOnlyMatch = /^(\d{4})$/.exec(value);
  if (yearOnlyMatch) {
    const year = Number(yearOnlyMatch[1]);
    if (year > now.getFullYear()) return fallback;
    return { type: "year", year };
  }

  const { year, month } = parseMonthParam(value);
  return { type: "month", year, month };
}

export function mesSelectionRange(selection: MesSelection): { start: Date; end: Date } {
  return selection.type === "year" ? getYearRange(selection.year) : getMonthRange(selection.year, selection.month);
}

export function mesSelectionLabel(selection: MesSelection): string {
  return selection.type === "year" ? `Todo ${selection.year}` : monthLabel(selection.year, selection.month);
}

export function mesSelectionParamValue(selection: MesSelection): string {
  return selection.type === "year" ? String(selection.year) : monthParamValue(selection.year, selection.month);
}

// Mismos `count` meses de listRecentMonths, pero con una opción "Todo <año>"
// intercalada justo después del último mes de cada año que cubren (para
// poder ver el año completo, no solo mes por mes, desde el mismo selector).
export function listRecentMonthsWithYearOption(count: number): { value: string; label: string }[] {
  const months = listRecentMonths(count);
  const result: { value: string; label: string }[] = [];
  let currentYear: number | null = null;
  for (const m of months) {
    if (currentYear !== null && currentYear !== m.year) {
      result.push({ value: String(currentYear), label: `Todo ${currentYear}` });
    }
    result.push({ value: m.value, label: m.label });
    currentYear = m.year;
  }
  if (currentYear !== null) {
    result.push({ value: String(currentYear), label: `Todo ${currentYear}` });
  }
  return result;
}
