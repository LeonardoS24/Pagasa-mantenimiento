// Colapsa espacios repetidos y recorta los extremos. Varios números
// económicos importados desde Excel traían doble espacio ("KG  138"), y con
// eso la unidad se volvía invisible: quien escribía "KG 138" en el buscador
// no encontraba nada. Se aplica al guardar (para que no vuelva a entrar).
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Versión para comparar en el buscador: ignora mayúsculas y también quita
// espacios y guiones por completo (no solo los colapsa), para que buscar
// "kg138" o "kg-138" encuentre igual una unidad capturada como "KG 138".
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "");
}
