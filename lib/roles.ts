import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "USUARIO"]);
export type Role = z.infer<typeof roleSchema>;
