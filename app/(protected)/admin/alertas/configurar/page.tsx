import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getAllRealCityIds } from "@/lib/aggregate-city";
import { calcularAlertasPropias } from "@/lib/alertas-servidor";
import { getRequisitos } from "@/lib/requisitos-runtime";
import {
  ALERTAS_DE_FABRICA,
  APARTADOS_PARA_ALERTAS,
  REGISTROS_PARA_ALERTAS,
  camposFechaDeFicha,
  leerApartados,
} from "@/lib/alertas-catalogo";
import { ConfigAlertasPanel } from "@/components/admin/ConfigAlertasPanel";

// Administración → Alertas → Configurar: renombrar o quitar las alertas de
// fábrica y agregar alertas nuevas sin tocar el código (ver
// lib/alertas-catalogo.ts y actions/alertas-config-actions.ts).
export default async function ConfigurarAlertasPage() {
  await requireAdmin();
  const [ajustes, propias, camposFecha, requisitos, historial] = await Promise.all([
    prisma.alertaAjuste.findMany(),
    prisma.alertaPropia.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.customField.findMany({ where: { tipo: "FECHA" }, orderBy: [{ apartadoSlug: "asc" }, { etiqueta: "asc" }] }),
    getRequisitos(),
    prisma.activityLog.findMany({ where: { entidad: "Alerta" }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  // Cuántas unidades tiene hoy en rojo y amarillo cada alerta agregada.
  const conteo = new Map<string, { rojo: number; amarillo: number; total: number }>();
  for (const a of await calcularAlertasPropias(await getAllRealCityIds())) {
    const c = conteo.get(a.alertaId) ?? { rojo: 0, amarillo: 0, total: 0 };
    c.total++;
    if (a.level === "red") c.rojo++;
    if (a.level === "yellow") c.amarillo++;
    conteo.set(a.alertaId, c);
  }
  const ajustePorTipo = new Map(ajustes.map((a) => [a.tipo, a]));
  const nombreApartado = new Map(APARTADOS_PARA_ALERTAS.map((a) => [a.slug, a.nombre]));

  return (
    <ConfigAlertasPanel
      deFabrica={ALERTAS_DE_FABRICA.map((a) => {
        const ajuste = ajustePorTipo.get(a.tipo);
        return {
          tipo: a.tipo,
          nombreDeFabrica: a.nombre,
          nombre: ajuste?.nombre || a.nombre,
          descripcion: a.descripcion,
          activa: ajuste?.activa ?? true,
        };
      })}
      propias={propias.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        apartados: leerApartados(p.apartados),
        fuente: p.fuente as "FICHA" | "CAMPO" | "REGISTRO",
        fuenteClave: p.fuenteClave,
        modo: p.modo as "VENCE" | "PLAZO",
        plazoAnios: p.plazoAnios,
        plazoMeses: p.plazoMeses,
        diasAviso: p.diasAviso,
        requisitoClave: p.requisitoClave,
        activa: p.activa,
        creadoPor: p.creadoPor,
        conteo: conteo.get(p.id) ?? { rojo: 0, amarillo: 0, total: 0 },
      }))}
      opciones={{
        apartados: APARTADOS_PARA_ALERTAS,
        camposFicha: camposFechaDeFicha(),
        registros: REGISTROS_PARA_ALERTAS.map((r) => ({ clave: r.clave, nombre: r.nombre })),
        camposPropios: camposFecha.map((c) => ({
          id: c.id,
          etiqueta: c.etiqueta,
          apartado: c.apartadoSlug ? nombreApartado.get(c.apartadoSlug) ?? c.apartadoSlug : c.ambito === "ESTACION" ? "Estaciones y planta" : "Todos los apartados",
        })),
        requisitos: requisitos.map((r) => ({ clave: r.clave, nombre: r.nombre, norma: r.norma, plazoAnios: r.plazoAnios })),
      }}
      historial={historial.map((h) => ({
        id: h.id,
        fecha: h.createdAt.toISOString(),
        usuario: h.username,
        resumen: h.resumen,
        detalle: h.detalle,
      }))}
    />
  );
}
