import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Doble verificación con códigos de 6 dígitos que cambian cada 30 segundos
// (TOTP, RFC 6238), compatibles con Google Authenticator, Microsoft
// Authenticator, Authy y similares. Sin dependencias: solo node:crypto.
// Lo puro vive aquí para probarlo con los vectores de la RFC (tests/totp.test.ts);
// lo que toca la base y la sesión está en actions/doble-verificacion-actions.ts.

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const PASO_SEGUNDOS = 30;
export const DIGITOS = 6;
// Se aceptan el código de ahora y el del paso anterior y siguiente: cubre un
// reloj del teléfono un poco desfasado.
const VENTANA = 1;

export function base32Codificar(datos: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decodificar(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const letra of limpio) {
    const i = ALFABETO.indexOf(letra);
    if (i < 0) throw new Error("Carácter inválido en base32");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// 20 bytes aleatorios = 160 bits, el tamaño que recomienda la RFC 4226.
export function nuevoSecretoTotp(): string {
  return base32Codificar(randomBytes(20));
}

export function pasoDe(ahoraMs: number): number {
  return Math.floor(ahoraMs / 1000 / PASO_SEGUNDOS);
}

// HOTP (RFC 4226) con SHA-1, que es lo que usan todas las aplicaciones.
export function codigoTotp(secretoBase32: string, paso: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac("sha1", base32Decodificar(secretoBase32)).update(contador).digest();
  const desplazamiento = hmac[hmac.length - 1] & 15;
  const binario =
    ((hmac[desplazamiento] & 127) << 24) |
    (hmac[desplazamiento + 1] << 16) |
    (hmac[desplazamiento + 2] << 8) |
    hmac[desplazamiento + 3];
  return String(binario % 10 ** digitos).padStart(digitos, "0");
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ResultadoTotp = { ok: true; paso: number } | { ok: false };

// `ultimoPaso`: el último paso aceptado de esa cuenta. Un código solo sirve
// una vez: si alguien lo vio por encima del hombro no lo puede reusar.
export function verificarTotp(
  secretoBase32: string,
  codigo: string,
  { ahora = Date.now(), ultimoPaso = null }: { ahora?: number; ultimoPaso?: number | null } = {}
): ResultadoTotp {
  const limpio = codigo.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) return { ok: false };
  const actual = pasoDe(ahora);
  let acertado: number | null = null;
  // Se recorren todos los pasos de la ventana (sin cortar al primer acierto)
  // para no filtrar con el tiempo de respuesta cuál fue.
  for (let paso = actual - VENTANA; paso <= actual + VENTANA; paso++) {
    if (iguales(codigoTotp(secretoBase32, paso), limpio) && acertado === null) acertado = paso;
  }
  if (acertado === null) return { ok: false };
  if (ultimoPaso !== null && acertado <= ultimoPaso) return { ok: false };
  return { ok: true, paso: acertado };
}

// Lo que escanea la aplicación (código QR) o se teclea a mano.
export function uriOtpauth({ usuario, secreto, emisor = "Pagasa Mantenimiento" }: { usuario: string; secreto: string; emisor?: string }): string {
  const etiqueta = encodeURIComponent(`${emisor}:${usuario}`);
  return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_SEGUNDOS}`;
}

// ----- Códigos de recuperación ---------------------------------------------
// Si se pierde el teléfono. Se guardan solo sus huellas (SHA-256) y cada uno
// sirve una vez.

export function normalizarCodigoRespaldo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function huellaDeCodigoRespaldo(codigo: string): string {
  return createHash("sha256").update(`pagasa-respaldo:${normalizarCodigoRespaldo(codigo)}`).digest("hex");
}

// «ABCDE-FGHJK»: 10 caracteres sin los que se confunden (0/O, 1/I).
export function nuevosCodigosRespaldo(cantidad = 8): string[] {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: cantidad }, () => {
    const bytes = randomBytes(10);
    let texto = "";
    for (const b of bytes) texto += letras[b % letras.length];
    return `${texto.slice(0, 5)}-${texto.slice(5)}`;
  });
}

export function pareceCodigoRespaldo(texto: string): boolean {
  return normalizarCodigoRespaldo(texto).length === 10 && /[A-Z]/.test(normalizarCodigoRespaldo(texto));
}

export function leerHuellas(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const datos = JSON.parse(json);
    return Array.isArray(datos) ? datos.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Si el código está entre los que quedan, lo quita y devuelve los demás.
export function consumirCodigoRespaldo(huellas: string[], codigo: string): { ok: boolean; restantes: string[] } {
  const buscada = huellaDeCodigoRespaldo(codigo);
  const i = huellas.findIndex((h) => iguales(h, buscada));
  if (i < 0) return { ok: false, restantes: huellas };
  return { ok: true, restantes: huellas.filter((_, k) => k !== i) };
}
