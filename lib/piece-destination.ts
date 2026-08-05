// Una pieza utilizada se amarra a un trabajo concreto, no solo a la unidad.
// Los tres destinos posibles son las bitácoras donde tiene sentido colocar una
// refacción: el mantenimiento general y los dos registros de válvulas.
export const DESTINO_TIPOS = ["MANTENIMIENTO", "VALVULAS", "VALVULAS_CORRECTIVO"] as const;
export type DestinoTipo = (typeof DESTINO_TIPOS)[number];

export const destinoLabels: Record<DestinoTipo, string> = {
  MANTENIMIENTO: "Bitácora de mantenimiento",
  VALVULAS: "Cambio de válvulas",
  VALVULAS_CORRECTIVO: "Mantenimiento correctivo de válvulas",
};

// Los registros de válvulas solo existen en este apartado.
export const SLUG_CARBURACION = "vehiculo-con-tanque-de-carburacion";

export function destinosDisponibles(sectionSlug: string): DestinoTipo[] {
  return sectionSlug === SLUG_CARBURACION
    ? ["MANTENIMIENTO", "VALVULAS", "VALVULAS_CORRECTIVO"]
    : ["MANTENIMIENTO"];
}

// El <select> manda una sola cadena. "nuevo:VALVULAS" abre el formulario para
// registrar el trabajo; "MANTENIMIENTO:<id>" amarra la pieza a uno existente.
export type DestinoElegido =
  | { modo: "nuevo"; tipo: DestinoTipo }
  | { modo: "existente"; tipo: DestinoTipo; logId: string };

export function parseDestino(valor: unknown): DestinoElegido | null {
  if (typeof valor !== "string" || !valor.includes(":")) return null;
  const [cabeza, resto] = [valor.slice(0, valor.indexOf(":")), valor.slice(valor.indexOf(":") + 1)];

  if (cabeza === "nuevo") {
    return DESTINO_TIPOS.includes(resto as DestinoTipo)
      ? { modo: "nuevo", tipo: resto as DestinoTipo }
      : null;
  }
  if (DESTINO_TIPOS.includes(cabeza as DestinoTipo) && resto) {
    return { modo: "existente", tipo: cabeza as DestinoTipo, logId: resto };
  }
  return null;
}

// Ancla de la tarjeta correspondiente en la página de la unidad, para que al
// redirigir se caiga justo en el formulario que hay que llenar.
export const destinoAncla: Record<DestinoTipo, string> = {
  MANTENIMIENTO: "mantenimiento",
  VALVULAS: "valvulas",
  VALVULAS_CORRECTIVO: "valvulas-correctivo",
};
