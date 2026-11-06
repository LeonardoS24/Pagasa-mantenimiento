// Quita la doble verificación de una cuenta desde el SERVIDOR. Es la salida de
// emergencia: si el único administrador pierde el teléfono y sus códigos de
// recuperación, nadie puede restablecerla desde el panel. Hay que estar en el
// servidor (con acceso a la carpeta del sistema), así que no es una puerta
// trasera para quien entra por internet.
//
//   node scripts/desactivar-2fa.mjs usuario
//
// Deja la cuenta entrando solo con contraseña; la persona vuelve a activarla en
// «Doble verificación» (o el sistema se lo pide si la empresa la exige).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lee el .env como lo hace el sistema (este script no pasa por Next).
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivoEnv = path.join(raiz, ".env");
if (fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const usuario = process.argv[2];
if (!usuario) {
  console.error("Uso: node scripts/desactivar-2fa.mjs usuario");
  process.exit(1);
}
try {
  const cuenta = await prisma.user.findUnique({ where: { username: usuario }, select: { id: true, totpActivo: true } });
  if (!cuenta) {
    console.error(`No existe el usuario «${usuario}».`);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: cuenta.id }, data: { totpActivo: false, totpSecreto: null, totpPaso: null, totpRespaldo: null } });
  await prisma.registroAcceso.create({
    data: { evento: "DOBLE_VERIFICACION_RESTABLECIDA", username: usuario, userId: cuenta.id, actorUsername: "(servidor)", detalle: "Desde scripts/desactivar-2fa.mjs" },
  });
  console.log(cuenta.totpActivo ? `Listo: «${usuario}» ya no tiene doble verificación.` : `«${usuario}» no la tenía activa; se limpiaron sus datos de todos modos.`);
} finally {
  await prisma.$disconnect();
}
