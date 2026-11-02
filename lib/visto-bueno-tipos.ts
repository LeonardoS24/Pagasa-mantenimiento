// Tipos y nombres del visto bueno, sin Prisma: los usa también el navegador
// (components/city/VistoBueno.tsx). La parte de base de datos está en
// lib/visto-bueno.ts.

export const ENTIDADES_VISTO_BUENO = {
  mantenimiento: "Mantenimiento",
  ultrasonido: "Ultrasonido",
  visualExterna: "Inspección visual externa",
  hermeticidad: "Prueba de hermeticidad",
  visualInterna: "Inspección visual interna",
  hidrostatica: "Prueba hidrostática",
  valvulas: "Cambio de válvulas",
  valvulasCorrectivo: "Correctivo de válvulas",
  mangueras: "Cambio de manguera",
  extintor: "Cambio de extintor",
} as const;

export type EntidadVistoBueno = keyof typeof ENTIDADES_VISTO_BUENO;

export function esEntidadVistoBueno(valor: string): valor is EntidadVistoBueno {
  return valor in ENTIDADES_VISTO_BUENO;
}

export type VistoBuenoVista = { userId: string | null; username: string; fecha: string; comentario: string | null };
