import { diaISO, type Vencimiento } from "@/lib/vencimientos";

// Archivo .ics (RFC 5545) con los vencimientos como eventos de día completo,
// para abrirlos en Outlook, Google Calendar o el calendario del teléfono.
// Cada evento avisa 7 días antes.
function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Las líneas de más de 75 bytes se parten con CRLF + espacio.
function plegar(linea: string): string {
  const bytes = Buffer.from(linea, "utf8");
  if (bytes.length <= 75) return linea;
  const partes: string[] = [];
  let actual = "";
  let largo = 0;
  for (const caracter of linea) {
    const b = Buffer.byteLength(caracter, "utf8");
    // La primera línea admite 75 bytes; las siguientes 74 (el espacio inicial cuenta).
    if (largo + b > (partes.length === 0 ? 75 : 74)) {
      partes.push(actual);
      actual = "";
      largo = 0;
    }
    actual += caracter;
    largo += b;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

function sinGuiones(iso: string): string {
  return iso.replace(/-/g, "");
}

export function construirIcs(vencimientos: Vencimiento[], nombreCalendario: string): string {
  const ahora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grupo Pagasa//Sistema Integral de Mantenimiento//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapar(nombreCalendario)}`,
  ];
  for (const v of vencimientos) {
    const dia = diaISO(v.fecha);
    const siguiente = diaISO(new Date(v.fecha.getTime() + 24 * 60 * 60 * 1000));
    const titulo = `${v.tipoNombre}: ${v.numeroEconomico}${v.detalle ? ` (${v.detalle})` : ""}`;
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${v.clave.replace(/[^A-Za-z0-9]+/g, "-")}-${sinGuiones(dia)}@pagasa-mantenimiento`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${sinGuiones(dia)}`,
      `DTEND;VALUE=DATE:${sinGuiones(siguiente)}`,
      `SUMMARY:${escapar(titulo)}`,
      `DESCRIPTION:${escapar(`${v.sectionName} · ${v.cityName}`)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(titulo)}`,
      "TRIGGER:-P7D",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
