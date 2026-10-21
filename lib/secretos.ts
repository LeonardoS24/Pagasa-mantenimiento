import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Cifrado de secretos guardados en la base (hoy: la contraseña del correo de
// los reportes). AES-256-GCM con una llave derivada de SESSION_SECRET: quien
// se lleve solo la base o un respaldo no puede leerlos. El costo: si algún día
// cambia SESSION_SECRET, lo cifrado ya no se puede abrir y hay que volver a
// capturarlo (descifrarSecreto devuelve null en vez de lanzar).
function llave(): Buffer {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Falta SESSION_SECRET en el .env del servidor.");
  return createHash("sha256").update(`pagasa-secretos:${secreto}`).digest();
}

export function cifrarSecreto(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", llave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return ["v1", iv.toString("base64"), cifrador.getAuthTag().toString("base64"), datos.toString("base64")].join(":");
}

export function descifrarSecreto(cifrado: string | null | undefined): string | null {
  if (!cifrado) return null;
  try {
    const [version, iv, tag, datos] = cifrado.split(":");
    if (version !== "v1" || !iv || !tag || !datos) return null;
    const descifrador = createDecipheriv("aes-256-gcm", llave(), Buffer.from(iv, "base64"));
    descifrador.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([descifrador.update(Buffer.from(datos, "base64")), descifrador.final()]).toString("utf8");
  } catch {
    return null;
  }
}
