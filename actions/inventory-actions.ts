"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor } from "@/lib/auth";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { sectionBasePath } from "@/lib/section-path";
import {
  inventoryItemStatusSchema,
  unidadAbreviatura,
  INVENTORY_POR_UTILIZAR_DAYS,
} from "@/lib/inventory-enums";
import {
  destinoAncla,
  destinosDisponibles,
  parseDestino,
  type DestinoTipo,
} from "@/lib/piece-destination";
import { formatDate } from "@/lib/dates";
import type { ActionState } from "./user-actions";

// Pasa automáticamente a "UTILIZADA" cualquier pieza marcada "POR_UTILIZAR"
// hace 5 días o más. Se llama al cargar la página de Inventarios de una
// ciudad (no hay tareas programadas en este sistema), así que la fecha se
// pone al día cada vez que alguien la visita.
export async function sweepExpiredPorUtilizar(sectionId: string): Promise<void> {
  const threshold = new Date(Date.now() - INVENTORY_POR_UTILIZAR_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inventoryItem.updateMany({
    where: { sectionId, estado: "POR_UTILIZAR", fechaPorUtilizarDesde: { lte: threshold } },
    data: { estado: "UTILIZADA", fechaUtilizada: new Date() },
  });
}

export type MantenimientoOpcion = {
  valor: string;
  etiqueta: string;
  grupo: string;
};

// Trabajos ya registrados de una unidad, para elegir en cuál se colocó la
// pieza. Se consulta al elegir la unidad y no al pintar la tabla: solo hacen
// falta los de esa unidad, no los de toda la ciudad.
export async function getMantenimientosDeUnidad(
  vehicleId: string
): Promise<{ opciones: MantenimientoOpcion[]; nuevos: { valor: string; etiqueta: string }[] }> {
  await requireEditor();

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: true },
  });
  if (!vehicle) return { opciones: [], nuevos: [] };

  const tipos = destinosDisponibles(vehicle.section.slug);
  const opciones: MantenimientoOpcion[] = [];

  const agrega = (tipo: DestinoTipo, id: string, fecha: Date, detalle: string) => {
    opciones.push({
      valor: `${tipo}:${id}`,
      etiqueta: `${formatDate(fecha)} — ${detalle}`,
      grupo: grupoLabel[tipo],
    });
  };

  const mantenimientos = await prisma.maintenanceLog.findMany({
    where: { vehicleRecordId: vehicleId },
    orderBy: { fecha: "desc" },
    take: 20,
  });
  for (const m of mantenimientos) {
    agrega("MANTENIMIENTO", m.id, m.fecha, `${m.tipoMantenimiento} / ${m.tipoServicio}`);
  }

  if (tipos.includes("VALVULAS")) {
    const valvulas = await prisma.valveChangeLog.findMany({
      where: { vehicleRecordId: vehicleId },
      orderBy: { fechaInstalacion: "desc" },
      take: 20,
    });
    for (const v of valvulas) {
      agrega("VALVULAS", v.id, v.fechaInstalacion, v.responsableCambio ?? "Cambio de válvulas");
    }

    const correctivos = await prisma.valveCorrectiveMaintenanceLog.findMany({
      where: { vehicleRecordId: vehicleId },
      orderBy: { fecha: "desc" },
      take: 20,
    });
    for (const c of correctivos) {
      agrega("VALVULAS_CORRECTIVO", c.id, c.fecha, c.descripcion);
    }
  }

  const nuevos = tipos.map((tipo) => ({
    valor: `nuevo:${tipo}`,
    etiqueta: nuevoLabel[tipo],
  }));

  return { opciones, nuevos };
}

const grupoLabel: Record<DestinoTipo, string> = {
  MANTENIMIENTO: "Bitácora de mantenimiento",
  VALVULAS: "Cambio de válvulas",
  VALVULAS_CORRECTIVO: "Mantenimiento correctivo de válvulas",
};

const nuevoLabel: Record<DestinoTipo, string> = {
  MANTENIMIENTO: "Registrar un mantenimiento nuevo",
  VALVULAS: "Registrar un cambio de válvulas nuevo",
  VALVULAS_CORRECTIVO: "Registrar un correctivo de válvulas nuevo",
};

export async function updateInventoryItemEstado(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = inventoryItemStatusSchema.safeParse(formData.get("estado"));
  if (!parsed.success) {
    return { error: "Estatus inválido." };
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { section: { include: { city: true } } },
  });
  if (!item) {
    return { error: "El registro no existe." };
  }

  // "Utilizada" exige indicar la unidad y el trabajo concreto donde se colocó
  // la pieza. Si ese trabajo ya está capturado, la pieza queda amarrada a él
  // aquí mismo; si todavía no existe, se redirige al formulario que toca con
  // los datos prellenados y el amarre se hace al guardarlo.
  if (parsed.data === "UTILIZADA") {
    const vehicleId = String(formData.get("vehicleRecordId") ?? "").trim();
    if (!vehicleId) {
      return { error: "Selecciona la unidad en la que se colocó la pieza." };
    }

    const vehicle = await prisma.vehicleRecord.findUnique({
      where: { id: vehicleId },
      include: { section: { include: { city: true } } },
    });
    if (!vehicle || !vehicle.activo || vehicle.section.cityId !== item.section.cityId) {
      return { error: "La unidad seleccionada no es válida." };
    }

    const destino = parseDestino(formData.get("destino"));
    if (!destino) {
      return { error: "Selecciona el mantenimiento en el que se colocó la pieza." };
    }
    if (!destinosDisponibles(vehicle.section.slug).includes(destino.tipo)) {
      return { error: "Ese tipo de registro no aplica para esta unidad." };
    }

    const vinculo: {
      usedOnMaintenanceLogId?: string | null;
      usedOnValveChangeLogId?: string | null;
      usedOnValveCorrectiveMaintenanceLogId?: string | null;
    } = {
      usedOnMaintenanceLogId: null,
      usedOnValveChangeLogId: null,
      usedOnValveCorrectiveMaintenanceLogId: null,
    };

    if (destino.modo === "existente") {
      const pertenece = await logPerteneceAUnidad(destino.tipo, destino.logId, vehicleId);
      if (!pertenece) {
        return { error: "El mantenimiento seleccionado ya no existe en esta unidad." };
      }
      if (destino.tipo === "MANTENIMIENTO") vinculo.usedOnMaintenanceLogId = destino.logId;
      if (destino.tipo === "VALVULAS") vinculo.usedOnValveChangeLogId = destino.logId;
      if (destino.tipo === "VALVULAS_CORRECTIVO")
        vinculo.usedOnValveCorrectiveMaintenanceLogId = destino.logId;
    }

    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        estado: "UTILIZADA",
        fechaUtilizada: item.fechaUtilizada ?? new Date(),
        usedOnVehicleId: vehicleId,
        ...vinculo,
      },
    });

    revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));

    const destinoUrl = `/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`;
    if (destino.modo === "existente") {
      redirect(`${destinoUrl}#${destinoAncla[destino.tipo]}`);
    }

    // Registro nuevo: se lleva el id de la pieza para amarrarla al guardar.
    const prefill = new URLSearchParams({
      prefillPieza: item.nombre,
      prefillCantidad: String(item.cantidad),
      prefillUnidad: unidadAbreviatura(item.unidad),
      vincularPieza: item.id,
    });
    redirect(`${destinoUrl}?${prefill.toString()}#${destinoAncla[destino.tipo]}`);
  }

  const data: {
    estado: string;
    fechaPorUtilizarDesde?: Date | null;
    fechaUtilizada?: Date | null;
  } = { estado: parsed.data };

  if (parsed.data === "POR_UTILIZAR" && item.estado !== "POR_UTILIZAR") {
    data.fechaPorUtilizarDesde = new Date();
  } else if (parsed.data === "EN_INVENTARIO") {
    data.fechaPorUtilizarDesde = null;
    data.fechaUtilizada = null;
  }

  await prisma.inventoryItem.update({ where: { id: itemId }, data });

  revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));
  return { success: "Estatus actualizado." };
}

async function logPerteneceAUnidad(
  tipo: DestinoTipo,
  logId: string,
  vehicleId: string
): Promise<boolean> {
  const where = { id: logId, vehicleRecordId: vehicleId };
  if (tipo === "MANTENIMIENTO") return (await prisma.maintenanceLog.count({ where })) > 0;
  if (tipo === "VALVULAS") return (await prisma.valveChangeLog.count({ where })) > 0;
  return (await prisma.valveCorrectiveMaintenanceLog.count({ where })) > 0;
}

// Amarra una pieza al registro que se acaba de crear desde el formulario al
// que la llevó el flujo de "Utilizada". Solo actúa si la pieza sigue apuntando
// a esa misma unidad, para que un enlace viejo no reasigne nada.
export async function vincularPiezaARegistro(
  itemId: string,
  tipo: DestinoTipo,
  logId: string,
  vehicleId: string
): Promise<void> {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.usedOnVehicleId !== vehicleId) return;

  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      usedOnMaintenanceLogId: tipo === "MANTENIMIENTO" ? logId : null,
      usedOnValveChangeLogId: tipo === "VALVULAS" ? logId : null,
      usedOnValveCorrectiveMaintenanceLogId: tipo === "VALVULAS_CORRECTIVO" ? logId : null,
    },
  });
}

// Dirección inversa de "marcar Utilizada desde Inventarios": aquí la pieza
// todavía está EN_INVENTARIO cuando se elige desde el formulario de
// mantenimiento (ver components/admin/CreateMaintenanceLogForm.tsx), así que
// hay que marcarla Utilizada y ligarla al registro recién creado en un solo
// paso. Si alguien más ya la usó mientras tanto (estado ya no EN_INVENTARIO),
// no se pisa: el mantenimiento se guarda igual, solo sin el amarre.
export async function usarPiezaDesdeMantenimiento(
  itemId: string,
  vehicleId: string,
  logId: string
): Promise<void> {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.estado !== "EN_INVENTARIO") return;

  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      estado: "UTILIZADA",
      fechaUtilizada: new Date(),
      usedOnVehicleId: vehicleId,
      usedOnMaintenanceLogId: logId,
    },
  });
}

export async function deleteInventoryItem(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { section: { include: { city: true } } },
  });
  if (!item) {
    return { error: "El artículo ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Artículo de inventario",
    resumen: `${item.nombre} (${item.cantidad} ${item.unidad})`,
    citySlug: item.section.city.slug,
  });

  await prisma.inventoryItem.delete({ where: { id: itemId } });
  revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));
  return { success: "Artículo eliminado." };
}
