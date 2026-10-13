// Tipos y etiquetas de "Documentos de pruebas", aparte de lib/test-documents.ts
// para que el componente de cliente (TestDocumentsPicker) los use sin
// arrastrar Prisma al navegador.

export const TIPOS_DOCUMENTO_PRUEBA = [
  { id: "ULTRASONIDO", label: "Ultrasonido" },
  { id: "VISUAL_EXTERNA", label: "Inspección visual externa" },
  { id: "HERMETICIDAD", label: "Prueba de hermeticidad" },
  { id: "VISUAL_INTERNA", label: "Inspección visual interna" },
  { id: "HIDROSTATICA", label: "Prueba hidrostática" },
  { id: "VALVULAS", label: "Cambio de válvulas" },
  { id: "VALVULAS_CORRECTIVO", label: "Correctivo de válvulas" },
  { id: "MANGUERAS", label: "Cambio de mangueras" },
  { id: "EXTINTOR", label: "Cambio de extintor" },
  { id: "POLIZA", label: "Póliza de seguro" },
  { id: "MANTENIMIENTO", label: "Mantenimiento" },
  { id: "UNIDAD", label: "Documentos de la unidad" },
] as const;

export type TipoDocumentoPrueba = (typeof TIPOS_DOCUMENTO_PRUEBA)[number]["id"];

export const tipoDocumentoPruebaLabel = Object.fromEntries(
  TIPOS_DOCUMENTO_PRUEBA.map((t) => [t.id, t.label])
) as Record<TipoDocumentoPrueba, string>;

export type DocumentoPrueba = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  subidoEl: string; // ISO
  // Fecha del evento (realización de la prueba, instalación, etc.), no la
  // de subida: es la que importa para saber de qué año es el dictamen.
  fechaEvento: string | null; // ISO
  tipo: TipoDocumentoPrueba;
  vehicleId: string;
  numeroEconomico: string;
  activo: boolean;
  apartado: string;
  citySlug: string;
  cityName: string;
};
