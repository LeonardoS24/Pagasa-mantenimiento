import fs from "fs/promises";
import path from "path";

// Respaldo automático de la base (prisma/dev.db) y de los archivos subidos
// (uploads/, PDFs e imágenes de cada apartado): sin esto, un disco dañado o
// un borrado accidental se llevaría todo el historial de mantenimiento sin
// forma de recuperarlo. Se guarda FUERA de uploads/ y de prisma/ (una
// carpeta hermana, backups/) para que un respaldo nunca intente copiarse a
// sí mismo, y queda fuera de git (ver .gitignore) porque son datos reales,
// no código.
const PROJECT_ROOT = process.cwd();
export const BACKUP_DIR = path.join(PROJECT_ROOT, "backups");
const DB_PATH = path.join(PROJECT_ROOT, "prisma", "dev.db");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");

// Cuántos respaldos completos se conservan: cada uno incluye una copia
// entera de uploads/ (cientos de MB), así que hay que limitarlo en vez de
// acumularlos para siempre.
const RETENTION = 5;

// Si el último respaldo tiene menos de esto, no se repite al reiniciar el
// servidor (evita duplicar el respaldo del día si el proceso se reinicia
// varias veces seguidas).
const MIN_HOURS_BETWEEN_BACKUPS = 20;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function timestampFolderName(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

// El nombre de cada carpeta es una marca de tiempo ISO con ":" y "." vueltos
// "-" (timestampFolderName), así que ordenar por nombre ya deja la más
// reciente primero — no hace falta reconstruir la fecha desde el nombre.
export async function listBackups(): Promise<{ name: string; date: Date }[]> {
  if (!(await pathExists(BACKUP_DIR))) return [];
  const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const stat = await fs.stat(path.join(BACKUP_DIR, e.name));
        return { name: e.name, date: stat.birthtime };
      })
  );
  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

async function pruneOldBackups(): Promise<void> {
  const backups = await listBackups();
  const toDelete = backups.slice(RETENTION);
  for (const backup of toDelete) {
    await fs.rm(path.join(BACKUP_DIR, backup.name), { recursive: true, force: true });
  }
}

// Copia completa de la base y de uploads/ a backups/<fecha>/. Se puede
// llamar a mano (ver actions/backup-actions.ts) o sola, todos los días (ver
// scheduleBackups).
export async function runBackup(): Promise<string> {
  const folderName = timestampFolderName(new Date());
  const target = path.join(BACKUP_DIR, folderName);
  await fs.mkdir(target, { recursive: true });

  if (await pathExists(DB_PATH)) {
    await fs.copyFile(DB_PATH, path.join(target, "dev.db"));
  }
  if (await pathExists(UPLOADS_DIR)) {
    await fs.cp(UPLOADS_DIR, path.join(target, "uploads"), { recursive: true });
  }

  await pruneOldBackups();
  return folderName;
}

let scheduled = false;

// Se llama una sola vez al arrancar el servidor (ver instrumentation.ts).
// Hace un respaldo de inmediato si el último tiene más de
// MIN_HOURS_BETWEEN_BACKUPS, y agenda uno cada 24 horas mientras el proceso
// siga corriendo.
export function scheduleBackups(): void {
  if (scheduled) return;
  scheduled = true;

  (async () => {
    try {
      const backups = await listBackups();
      const last = backups[0];
      const hoursSinceLast = last ? (Date.now() - last.date.getTime()) / (60 * 60 * 1000) : Infinity;
      if (hoursSinceLast >= MIN_HOURS_BETWEEN_BACKUPS) {
        await runBackup();
      }
    } catch (err) {
      console.error("[backup] Falló el respaldo inicial:", err);
    }
  })();

  setInterval(() => {
    runBackup().catch((err) => console.error("[backup] Falló el respaldo programado:", err));
  }, INTERVAL_MS);
}
