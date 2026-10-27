import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { BACKUP_DIR, PROJECT_ROOT } from "./rutas-datos";

// Copia de la base de datos que SÍ se puede restaurar.
//
// Copiar dev.db con un copy normal mientras el sistema está prendido puede
// agarrar el archivo a la mitad de una escritura y dejar una copia dañada que
// nadie nota hasta el día que se necesita. `VACUUM INTO` le pide a SQLite una
// foto completa y consistente de la base, aunque haya gente capturando.

const CARPETA_VERIFICACION = path.join(BACKUP_DIR, ".verificacion");

export async function fotografiarBase(destino: string): Promise<void> {
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.rm(destino, { force: true });
  await prisma.$executeRaw`VACUUM INTO ${destino}`;
}

// Lo que se cuenta para comparar una copia con la base viva: lo que más
// duele perder.
export type ConteosBase = {
  usuarios: number;
  ciudades: number;
  unidades: number;
  mantenimientos: number;
  documentos: number;
  equipos: number;
  bitacorasDeEquipo: number;
  pruebasUltrasonido: number;
  cambiosDeValvulas: number;
};

type ClienteConteo = Pick<
  PrismaClient,
  | "user"
  | "city"
  | "vehicleRecord"
  | "maintenanceLog"
  | "document"
  | "equipo"
  | "equipmentLog"
  | "ultrasoundLog"
  | "valveChangeLog"
>;

async function contar(cliente: ClienteConteo): Promise<ConteosBase> {
  const [usuarios, ciudades, unidades, mantenimientos, documentos, equipos, bitacorasDeEquipo, pruebasUltrasonido, cambiosDeValvulas] =
    await Promise.all([
      cliente.user.count(),
      cliente.city.count(),
      cliente.vehicleRecord.count(),
      cliente.maintenanceLog.count(),
      cliente.document.count(),
      cliente.equipo.count(),
      cliente.equipmentLog.count(),
      cliente.ultrasoundLog.count(),
      cliente.valveChangeLog.count(),
    ]);
  return { usuarios, ciudades, unidades, mantenimientos, documentos, equipos, bitacorasDeEquipo, pruebasUltrasonido, cambiosDeValvulas };
}

export function conteosDeLaBaseViva(): Promise<ConteosBase> {
  return contar(prisma);
}

export type ResultadoVerificacion = {
  // "ok" o el primer error que reporta SQLite.
  integridad: string;
  conteos: ConteosBase;
};

// Abre una copia como si fuera la base del sistema (con su propio cliente de
// Prisma), corre PRAGMA integrity_check y cuenta los registros. Es la prueba
// de que la copia se puede restaurar: si Prisma la abre y lee todo, el sistema
// también.
//
// La copia se abre desde backups/.verificacion con una ruta RELATIVA a
// prisma/ (como DATABASE_URL): la carpeta del servidor tiene espacios
// ("Leonardo Silvas") y una ruta absoluta con espacios no siempre la acepta
// la cadena de conexión.
export async function verificarCopia(rutaCopia: string): Promise<ResultadoVerificacion> {
  await fs.mkdir(CARPETA_VERIFICACION, { recursive: true });
  const temporal = path.join(CARPETA_VERIFICACION, `verificar-${Date.now()}.db`);
  await fs.copyFile(rutaCopia, temporal);
  const relativa = path.relative(path.join(PROJECT_ROOT, "prisma"), temporal).split(path.sep).join("/");
  const cliente = new PrismaClient({ datasourceUrl: `file:${relativa}` });
  try {
    const filas = await cliente.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
    const integridad = filas.map((f) => f.integrity_check).join("; ") || "sin respuesta";
    const conteos = await contar(cliente);
    return { integridad, conteos };
  } finally {
    await cliente.$disconnect();
    await fs.rm(temporal, { force: true }).catch(() => undefined);
  }
}
