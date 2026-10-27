import { prisma } from "./prisma";
import { getAllRealCityIds } from "./aggregate-city";
import { getUrlBase } from "./ajustes";
import { diaISO, getVencimientos, type Vencimiento } from "./vencimientos";
import { armarReporte } from "./reporte-vencimientos";
import { crearTransporte, explicarError, parsearDestinatarios, smtpEfectivo } from "./reportes-programados";

// Aviso por correo de lo que PASÓ a rojo (7 días o menos, o ya vencido):
// complemento del reporte semanal, para no esperar hasta el lunes. Va una vez
// al día, a la hora del reporte, a los mismos destinatarios, y solo con lo
// nuevo: lo ya avisado se recuerda en avisoRojoNotificados (ver
// ConfiguracionReportes). Se activa con su casilla en /admin/reportes.

// Un vencimiento se identifica por su clave y su fecha: si alguien registra
// la prueba y el vencimiento se mueve, al volver a ponerse en rojo es un
// aviso nuevo.
export function claveDeAviso(v: Vencimiento): string {
  return `${v.clave}|${diaISO(v.fecha)}`;
}

export function nuevosEnRojo(lista: Vencimiento[], yaAvisados: Set<string>): Vencimiento[] {
  return lista.filter((v) => v.nivel === "red" && !yaAvisados.has(claveDeAviso(v)));
}

function diaLocal(fecha: Date): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}`;
}

// Si el correo falla, se reintenta a la hora (no cada 5 minutos).
const g = globalThis as unknown as { __avisoRojoUltimoFallo?: number };

export async function revisarAvisoRojo(ahora: Date = new Date()): Promise<void> {
  const config = await prisma.configuracionReportes.findUnique({ where: { id: "unico" } });
  if (!config?.avisoRojoActivo) return;
  const hoy = diaLocal(ahora);
  if (config.avisoRojoUltimoDia === hoy || ahora.getHours() < config.hora) return;
  if (g.__avisoRojoUltimoFallo && ahora.getTime() - g.__avisoRojoUltimoFallo < 60 * 60 * 1000) return;

  const guardar = (datos: { avisoRojoUltimoDia?: string; avisoRojoNotificados?: string; avisoRojoUltimoResumen: string }) =>
    prisma.configuracionReportes.update({ where: { id: "unico" }, data: datos });

  const lista = await getVencimientos(await getAllRealCityIds());
  const rojos = lista.filter((v) => v.nivel === "red");
  let avisados: Set<string>;
  try {
    avisados = new Set(JSON.parse(config.avisoRojoNotificados) as string[]);
  } catch {
    avisados = new Set();
  }
  const nuevos = nuevosEnRojo(rojos, avisados);
  // Solo se recuerdan los que siguen en rojo: lo demás ya salió de la lista.
  const vigentes = JSON.stringify(rojos.map(claveDeAviso));

  if (nuevos.length === 0) {
    await guardar({ avisoRojoUltimoDia: hoy, avisoRojoNotificados: vigentes, avisoRojoUltimoResumen: `${hoy}: nada nuevo en rojo.` });
    return;
  }

  const { validos } = parsearDestinatarios(config.destinatarios);
  const smtp = smtpEfectivo(config);
  if (validos.length === 0 || !smtp || (smtp.usuario && !smtp.clave)) {
    g.__avisoRojoUltimoFallo = ahora.getTime();
    await guardar({ avisoRojoUltimoResumen: `${hoy}: no se pudo avisar (faltan destinatarios o el servidor de correo).` });
    return;
  }

  try {
    const reporte = armarReporte(nuevos, {
      dias: 7,
      urlBase: await getUrlBase(),
      fecha: ahora,
      titulo: "Pasaron a rojo",
    });
    await crearTransporte(smtp).sendMail({
      from: smtp.remitente || smtp.usuario || "pagasa@localhost",
      to: validos,
      subject: `Pagasa · Pasaron a rojo: ${nuevos.length} vencimiento(s) a 7 días o menos`,
      text: reporte.texto,
      html: reporte.html,
    });
    await guardar({
      avisoRojoUltimoDia: hoy,
      avisoRojoNotificados: vigentes,
      avisoRojoUltimoResumen: `${hoy}: se avisó de ${nuevos.length} vencimiento(s) nuevo(s) en rojo a ${validos.length} destinatario(s).`,
    });
  } catch (error) {
    g.__avisoRojoUltimoFallo = ahora.getTime();
    await guardar({ avisoRojoUltimoResumen: `${hoy}: falló el envío. ${explicarError(error)}` });
  }
}
