import fs from "fs/promises";
import path from "path";
import { PROJECT_ROOT } from "./rutas-datos";

// Qué versión del sistema está corriendo: el commit de git de la carpeta
// del servidor, leído directo de .git (no hace falta tener git a la mano).
export type Version = { commit: string; corto: string; rama: string | null } | null;

export async function versionInstalada(): Promise<Version> {
  try {
    const gitDir = path.join(PROJECT_ROOT, ".git");
    const head = (await fs.readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
    if (!head.startsWith("ref: ")) return { commit: head, corto: head.slice(0, 7), rama: null };
    const ref = head.slice(5);
    let commit: string | null = null;
    try {
      commit = (await fs.readFile(path.join(gitDir, ref), "utf8")).trim();
    } catch {
      // La referencia puede estar empaquetada.
      const packed = await fs.readFile(path.join(gitDir, "packed-refs"), "utf8").catch(() => "");
      commit = packed.split("\n").find((l) => l.endsWith(` ${ref}`))?.split(" ")[0] ?? null;
    }
    if (!commit) return null;
    return { commit, corto: commit.slice(0, 7), rama: ref.replace("refs/heads/", "") };
  } catch {
    return null;
  }
}
