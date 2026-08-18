import { prisma } from "@/lib/prisma";
import {
  esCampoExtraInput,
  fieldIdDesdeInputName,
  parseOpcionesTexto,
  type CampoAmbito,
  type CampoTipo,
  type CustomFieldDef,
} from "@/lib/custom-fields";

// Definiciones de los recuadros extra de una ficha, ya ordenadas por
// recuadro (ver lib/custom-fields.ts). Se leen en el servidor y se le pasan
// al formulario/vista, igual que el catálogo de piezas.
export async function getCustomFields(ambito: CampoAmbito): Promise<CustomFieldDef[]> {
  const filas = await prisma.customField.findMany({
    where: { ambito },
    orderBy: [{ seccion: "asc" }, { orden: "asc" }],
  });
  return filas.map((f) => ({
    id: f.id,
    ambito: f.ambito as CampoAmbito,
    seccion: f.seccion,
    etiqueta: f.etiqueta,
    tipo: f.tipo as CampoTipo,
    orden: f.orden,
    opciones: f.tipo === "LISTA" ? parseOpcionesTexto(f.opciones) : undefined,
  }));
}

// Lo capturado en esos campos para una unidad, como { fieldId: valor }.
export async function getCustomFieldValues(vehicleRecordId: string): Promise<Record<string, string>> {
  const filas = await prisma.customFieldValue.findMany({ where: { vehicleRecordId } });
  return Object.fromEntries(filas.map((f) => [f.fieldId, f.valor]));
}

// Guarda los campos extra que vengan en el formulario. Se llama desde las
// acciones que guardan la ficha técnica (ver upsertTechnicalSheet y
// upsertStationTankTechnicalSheet): un campo vacío borra el valor en vez de
// guardar cadena vacía, para que "sin capturar" y "capturado vacío" no sean
// dos cosas distintas.
export async function saveCustomFieldValues(
  vehicleRecordId: string,
  formData: FormData,
  ambito: CampoAmbito
): Promise<void> {
  const definidos = await getCustomFields(ambito);
  if (definidos.length === 0) return;
  const porId = new Map(definidos.map((d) => [d.id, d]));

  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    if (!esCampoExtraInput(name)) continue;
    const fieldId = fieldIdDesdeInputName(name);
    // Solo se aceptan ids que de verdad existen en este ámbito: el nombre
    // del input viene del navegador y no se puede confiar en él.
    const definicion = porId.get(fieldId);
    if (!definicion) continue;

    const valor = raw.trim().slice(0, 2000);
    if (!valor) {
      await prisma.customFieldValue.deleteMany({ where: { fieldId, vehicleRecordId } });
      continue;
    }
    // Un campo "LISTA" solo puede quedar en una de sus opciones definidas:
    // el <select> ya lo limita en el navegador, pero el envío viene de un
    // formulario normal y no se puede confiar en él sin revisarlo aquí.
    if (definicion.tipo === "LISTA" && !definicion.opciones?.includes(valor)) continue;
    await prisma.customFieldValue.upsert({
      where: { fieldId_vehicleRecordId: { fieldId, vehicleRecordId } },
      update: { valor },
      create: { fieldId, vehicleRecordId, valor },
    });
  }
}
