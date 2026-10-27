import path from "path";

// Dónde viven los datos reales del sistema. Un solo lugar para que el
// respaldo local, la copia a la memoria USB y la tarjeta de espacio midan y
// copien exactamente lo mismo.
export const PROJECT_ROOT = process.cwd();
export const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");
export const BACKUP_DIR = path.join(PROJECT_ROOT, "backups");

// La base que de verdad usa el sistema: DATABASE_URL ("file:./dev.db" es
// relativo a la carpeta prisma/, como lo resuelve Prisma). Sin ella, la de
// siempre.
export function rutaDeLaBase(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const ruta = url.slice("file:".length).split("?")[0];
    if (ruta) return path.isAbsolute(ruta) ? ruta : path.join(PROJECT_ROOT, "prisma", ruta);
  }
  return path.join(PROJECT_ROOT, "prisma", "dev.db");
}
