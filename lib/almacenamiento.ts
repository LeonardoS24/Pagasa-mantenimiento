import fs from "fs/promises";
import path from "path";
import { BACKUP_DIR, PROJECT_ROOT, UPLOADS_DIR, rutaDeLaBase } from "@/lib/rutas-datos";

// Cuánto pesa lo que el sistema guarda en el servidor: la base de datos, los
// archivos subidos (uploads/) y los respaldos (backups/). Se mide en vivo
// recorriendo las carpetas, así que se usa solo en la página de respaldos.
const DB_PATH = rutaDeLaBase();

type Medida = { bytes: number; archivos: number };

async function medirCarpeta(dir: string): Promise<Medida> {
  let bytes = 0;
  let archivos = 0;
  let entradas;
  try {
    entradas = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes, archivos };
  }
  for (const entrada of entradas) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      const sub = await medirCarpeta(ruta);
      bytes += sub.bytes;
      archivos += sub.archivos;
    } else if (entrada.isFile()) {
      try {
        bytes += (await fs.stat(ruta)).size;
        archivos += 1;
      } catch {
        // El archivo desapareció mientras se medía: no cuenta.
      }
    }
  }
  return { bytes, archivos };
}

async function tamanoArchivo(ruta: string): Promise<number> {
  try {
    return (await fs.stat(ruta)).size;
  } catch {
    return 0;
  }
}

export type Almacenamiento = {
  baseBytes: number;
  uploadsBytes: number;
  uploadsArchivos: number;
  // Las carpetas de primer nivel de uploads/ más pesadas.
  uploadsPorCarpeta: { nombre: string; bytes: number }[];
  backupsBytes: number;
  backupsCantidad: number;
  discoLibreBytes: number | null;
  discoTotalBytes: number | null;
};

export async function getAlmacenamiento(): Promise<Almacenamiento> {
  // El journal/WAL de SQLite también es parte de la base mientras exista.
  const baseBytes =
    (await tamanoArchivo(DB_PATH)) + (await tamanoArchivo(`${DB_PATH}-wal`)) + (await tamanoArchivo(`${DB_PATH}-journal`));

  const uploads = await medirCarpeta(UPLOADS_DIR);
  const subcarpetas: { nombre: string; bytes: number }[] = [];
  let sueltos = 0;
  try {
    for (const e of await fs.readdir(UPLOADS_DIR, { withFileTypes: true })) {
      if (e.isDirectory()) subcarpetas.push({ nombre: e.name, bytes: (await medirCarpeta(path.join(UPLOADS_DIR, e.name))).bytes });
      else sueltos += await tamanoArchivo(path.join(UPLOADS_DIR, e.name));
    }
  } catch {
    // Sin carpeta uploads/ todavía.
  }
  if (sueltos > 0) subcarpetas.push({ nombre: "(archivos sueltos)", bytes: sueltos });
  subcarpetas.sort((a, b) => b.bytes - a.bytes);

  const backups = await medirCarpeta(BACKUP_DIR);
  let backupsCantidad = 0;
  try {
    backupsCantidad = (await fs.readdir(BACKUP_DIR, { withFileTypes: true })).filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name)).length;
  } catch {
    // Sin carpeta backups/ todavía.
  }

  // Espacio del disco donde está el sistema (no todos los sistemas lo
  // permiten; sin dato, la tarjeta simplemente no lo muestra).
  let discoLibreBytes: number | null = null;
  let discoTotalBytes: number | null = null;
  try {
    const s = await fs.statfs(PROJECT_ROOT);
    discoLibreBytes = Number(s.bavail) * Number(s.bsize);
    discoTotalBytes = Number(s.blocks) * Number(s.bsize);
  } catch {
    // Se queda en null.
  }

  return {
    baseBytes,
    uploadsBytes: uploads.bytes,
    uploadsArchivos: uploads.archivos,
    uploadsPorCarpeta: subcarpetas.slice(0, 6),
    backupsBytes: backups.bytes,
    backupsCantidad,
    discoLibreBytes,
    discoTotalBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(valor >= 100 ? 0 : 1)} ${unidades[i]}`;
}
