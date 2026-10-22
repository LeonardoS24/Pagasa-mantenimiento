import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { UsuarioSesion } from "./session";

// Borrar una ciudad o un apartado con contenido arrastra unidades, bitácoras y
// documentos de años. Antes de hacerlo se pide de nuevo la contraseña de quien
// está en sesión: no basta con haber iniciado sesión hace rato, ni con que la
// pantalla haya quedado abierta y desatendida.
export async function verifySessionPassword(
  user: UsuarioSesion,
  password: unknown
): Promise<string | null> {
  const texto = typeof password === "string" ? password : "";
  if (!texto) {
    return "Escribe tu contraseña para confirmar.";
  }

  const registro = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  });
  if (!registro) {
    return "Tu sesión ya no es válida. Cierra sesión y vuelve a entrar.";
  }

  const coincide = await bcrypt.compare(texto, registro.passwordHash);
  if (!coincide) {
    return "Contraseña incorrecta.";
  }
  return null;
}
