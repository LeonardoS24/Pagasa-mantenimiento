// Colapsa espacios repetidos y recorta los extremos. Varios números
// económicos importados desde Excel traían doble espacio ("KG  138"), y con
// eso la unidad se volvía invisible: quien escribía "KG 138" en el buscador
// no encontraba nada. Se aplica al guardar (para que no vuelva a entrar) y al
// comparar (para lo que ya está capturado).
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Versión para comparar: además ignora mayúsculas.
export function normalizeForSearch(value: string): string {
  return collapseSpaces(value).toLowerCase();
}
