import { formatDate } from "@/lib/dates";
import { type Vencimiento } from "@/lib/vencimientos";

// Arma el correo del reporte de vencimientos: los vencidos y lo que vence en
// los próximos `dias`, agrupado por ciudad. Función pura (recibe la lista ya
// calculada con getVencimientos) para poder probarla sin base de datos.
export type ReporteVencimientos = {
  asunto: string;
  html: string;
  texto: string;
  vencidos: number;
  proximos: number;
};

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function estado(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return "Vence hoy";
  return `Faltan ${dias} d`;
}

function color(dias: number): { fondo: string; texto: string } {
  if (dias <= 7) return { fondo: "#fee2e2", texto: "#991b1b" };
  if (dias <= 30) return { fondo: "#fef9c3", texto: "#854d0e" };
  return { fondo: "#e0e7f1", texto: "#054095" };
}

function que(v: Vencimiento): string {
  return `${v.tipoNombre}${v.detalle ? ` · ${v.detalle}` : ""}`;
}

export function armarReporte(
  todos: Vencimiento[],
  // `titulo` cambia el encabezado del correo (el aviso de lo que pasa a rojo
  // usa este mismo formato, ver lib/aviso-rojo.ts).
  opciones: { dias: number; urlBase: string | null; fecha?: Date; titulo?: string }
): ReporteVencimientos {
  const { dias, urlBase } = opciones;
  const hoy = opciones.fecha ?? new Date();
  const vencidos = todos.filter((v) => v.dias < 0);
  const proximos = todos.filter((v) => v.dias >= 0 && v.dias <= dias);
  const incluidos = [...vencidos, ...proximos];

  const asunto =
    incluidos.length === 0
      ? `Pagasa · Vencimientos: todo en orden (próximos ${dias} días)`
      : `Pagasa · Vencimientos: ${vencidos.length} vencido(s), ${proximos.length} en los próximos ${dias} días`;

  const porCiudad = new Map<string, Vencimiento[]>();
  for (const v of incluidos) porCiudad.set(v.cityName, [...(porCiudad.get(v.cityName) ?? []), v]);
  const ciudades = [...porCiudad.keys()].sort((a, b) => a.localeCompare(b, "es"));

  const enlace = (v: Vencimiento) => (urlBase ? `${urlBase}/ciudades/${v.citySlug}/vehiculo/${v.vehicleId}` : null);

  const fechaTexto = hoy.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ----- HTML (estilos en línea: los clientes de correo ignoran las hojas de estilo)
  const filas = (lista: Vencimiento[]) =>
    lista
      .map((v) => {
        const c = color(v.dias);
        const url = enlace(v);
        const unidad = url
          ? `<a href="${esc(url)}" style="color:#054095;font-weight:600;text-decoration:none">${esc(v.numeroEconomico)}</a>`
          : `<strong>${esc(v.numeroEconomico)}</strong>`;
        return `<tr>
<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap"><span style="background:${c.fondo};color:${c.texto};padding:2px 6px;border-radius:4px;font-size:12px">${esc(estado(v.dias))}</span></td>
<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${esc(formatDate(v.fecha))}</td>
<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${unidad}<br><span style="color:#6b7280;font-size:12px">${esc(v.sectionName)}</span></td>
<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(que(v))}</td>
</tr>`;
      })
      .join("\n");

  const bloqueCiudad = (nombre: string) => {
    const lista = porCiudad.get(nombre)!;
    return `<h3 style="margin:20px 0 6px;font-size:15px;color:#054095">${esc(nombre)} <span style="color:#6b7280;font-weight:normal;font-size:13px">(${lista.length})</span></h3>
<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px">
<tr style="text-align:left;color:#6b7280;font-size:12px"><th style="padding:4px 8px">Estado</th><th style="padding:4px 8px">Fecha</th><th style="padding:4px 8px">Unidad</th><th style="padding:4px 8px">Qué vence</th></tr>
${filas(lista)}
</table>`;
  };

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:760px;margin:0 auto;background:#ffffff">
<div style="background:#054095;color:#ffffff;padding:16px 20px">
<div style="font-size:18px;font-weight:bold">${esc(opciones.titulo ?? "Reporte de vencimientos")}</div>
<div style="font-size:13px;opacity:.85">Sistema Integral de Mantenimiento · Grupo Pagasa · ${esc(fechaTexto)}</div>
</div>
<div style="padding:16px 20px">
<table role="presentation" cellspacing="8" cellpadding="0" style="width:100%"><tr>
<td style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;text-align:center"><div style="font-size:26px;font-weight:bold">${vencidos.length}</div><div style="font-size:12px">Vencidos</div></td>
<td style="background:#fef9c3;color:#854d0e;padding:12px;border-radius:6px;text-align:center"><div style="font-size:26px;font-weight:bold">${proximos.length}</div><div style="font-size:12px">Vencen en los próximos ${dias} días</div></td>
</tr></table>
${
  incluidos.length === 0
    ? `<p style="margin:20px 0">No hay vencimientos pendientes ni próximos. Todo en orden.</p>`
    : ciudades.map(bloqueCiudad).join("\n")
}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">
${urlBase ? `Abre el sistema en <a href="${esc(urlBase)}" style="color:#054095">${esc(urlBase)}</a>. ` : ""}No incluye extintores (su alerta es por estado, no por fecha). Este correo lo envía el sistema de forma automática; los destinatarios se cambian en Panel de administración → Reportes por correo.
</p>
</div></div></body></html>`;

  // ----- Texto plano (por si el cliente de correo no muestra HTML)
  const lineas: string[] = [
    "REPORTE DE VENCIMIENTOS — Grupo Pagasa",
    fechaTexto,
    "",
    `Vencidos: ${vencidos.length} · Próximos ${dias} días: ${proximos.length}`,
  ];
  if (incluidos.length === 0) lineas.push("", "No hay vencimientos pendientes ni próximos. Todo en orden.");
  for (const nombre of ciudades) {
    lineas.push("", `== ${nombre} ==`);
    for (const v of porCiudad.get(nombre)!) {
      lineas.push(`- ${formatDate(v.fecha)} (${estado(v.dias)}) ${v.numeroEconomico} — ${que(v)}`);
    }
  }
  if (urlBase) lineas.push("", `Sistema: ${urlBase}`);

  return { asunto, html, texto: lineas.join("\n"), vencidos: vencidos.length, proximos: proximos.length };
}
