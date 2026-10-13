// ZIP mínimo, sin compresión (método "store"), para descargar varios
// documentos de un jalón (ver app/api/ciudades/[citySlug]/documentos-zip).
// Se escribe aquí en vez de agregar una dependencia porque lo que se
// empaqueta son PDF e imágenes, que ya vienen comprimidos: comprimirlos otra
// vez casi no ahorra espacio y sí cuesta tiempo en el servidor.
//
// Formato: PKWARE APPNOTE 6.3 — por cada archivo, encabezado local + datos;
// al final, el directorio central y su cierre. Los nombres van en UTF-8
// (bit 11 de las banderas) para que acentos y ñ se vean bien al abrirlo.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Fecha/hora en formato MS-DOS, que es lo que guarda el ZIP.
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export type ZipEntry = { name: string; data: Buffer; date?: Date };

// Dos archivos con el mismo nombre en la misma carpeta se pisarían al
// descomprimir: al segundo se le agrega " (2)", al tercero " (3)", etc.
function nombresUnicos(entries: ZipEntry[]): string[] {
  const usados = new Set<string>();
  return entries.map(({ name }) => {
    let candidato = name;
    let n = 2;
    while (usados.has(candidato.toLowerCase())) {
      const punto = name.lastIndexOf(".");
      const base = punto > name.lastIndexOf("/") ? name.slice(0, punto) : name;
      const ext = punto > name.lastIndexOf("/") ? name.slice(punto) : "";
      candidato = `${base} (${n++})${ext}`;
    }
    usados.add(candidato.toLowerCase());
    return candidato;
  });
}

export function buildZip(entries: ZipEntry[]): Buffer {
  const nombres = nombresUnicos(entries);
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry, i) => {
    const nombre = Buffer.from(nombres[i], "utf8");
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.date ?? new Date());
    const size = entry.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombre en UTF-8
    local.writeUInt16LE(0, 8); // sin compresión
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // hecho por
    central.writeUInt16LE(20, 6); // versión necesaria
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentario
    central.writeUInt16LE(0, 34); // disco
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0, 38); // atributos externos
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nombre);

    offset += local.length + nombre.length + size;
  });

  const tamanoCentral = centrales.reduce((total, b) => total + b.length, 0);
  const cierre = Buffer.alloc(22);
  cierre.writeUInt32LE(0x06054b50, 0);
  cierre.writeUInt16LE(entries.length, 8);
  cierre.writeUInt16LE(entries.length, 10);
  cierre.writeUInt32LE(tamanoCentral, 12);
  cierre.writeUInt32LE(offset, 16);

  return Buffer.concat([...locales, ...centrales, cierre]);
}

// Límites del formato ZIP clásico (sin ZIP64): 65,535 archivos y 4 GB.
export const ZIP_MAX_ENTRIES = 65535;
export const ZIP_MAX_BYTES = 0xffffffff;
