import { z } from "zod";

// ADMIN: control total (ciudades, apartados, usuarios, eliminar cualquier cosa).
// USUARIO: puede agregar/editar números económicos, fichas técnicas, bitácoras
// de mantenimiento y subir archivos, pero no crear/eliminar ciudades ni
// apartados/sub-apartados, ni renombrar nada ya existente.
// LECTOR: solo puede ver, igual que el comportamiento original de USUARIO.
export const roleSchema = z.enum(["ADMIN", "USUARIO", "LECTOR"]);
export type Role = z.infer<typeof roleSchema>;

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  USUARIO: "Usuario",
  LECTOR: "Lector",
};

export function canEdit(role: Role): boolean {
  return role === "ADMIN" || role === "USUARIO";
}
