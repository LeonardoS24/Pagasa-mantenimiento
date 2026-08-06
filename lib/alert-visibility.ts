// Evita que una misma unidad física mande la misma alerta por partida doble
// cuando vive en dos apartados a la vez: un Vehículo de reparto copiado a
// Vehículo con tanque de carburación (ver actions/piece-order-actions.ts /
// el script de copia reparto->carburación) comparte extintor y mantenimiento
// preventivo con su gemelo, así que esas dos alertas solo se mandan desde el
// apartado que es su dueño real (reparto). El resto de alertas (ultrasonido,
// inspecciones, hermeticidad, hidrostática, válvulas, mangueras) son propias
// del tanque y solo aplican a Auto-Tanques / Vehículo con tanque de
// carburación — Vehículo de reparto nunca las tiene llenas, pero se filtran
// explícitamente aquí en vez de depender de que el campo esté vacío.
export type AlertType =
  | "ultrasonido"
  | "visualExterna"
  | "hermeticidad"
  | "visualInterna"
  | "hidrostatica"
  | "extintor"
  | "mantenimiento"
  | "valvulas"
  | "mangueras";

export function isAlertVisibleForSection(alertType: AlertType, sectionSlug: string): boolean {
  if (sectionSlug === "vehiculo-de-reparto") {
    return alertType === "extintor" || alertType === "mantenimiento";
  }
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") {
    return alertType !== "extintor" && alertType !== "mantenimiento";
  }
  // Auto-Tanques, unidades utilitarias, etc: sin restricción adicional (el
  // dato solo existe si de verdad aplica a ese tipo de unidad).
  return true;
}
