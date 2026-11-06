// Reglas de la doble verificación que no tocan la base de datos (la parte
// criptográfica está en lib/totp.ts y las acciones en
// actions/doble-verificacion-actions.ts).

// La empresa puede exigirla a los administradores poniendo
// EXIGIR_2FA_ADMIN=true en el .env del servidor. Con eso, un administrador que
// no la ha activado solo puede entrar a la pantalla para activarla. Para el
// resto de las cuentas es opcional.
export function exige2faAAdmins(): boolean {
  return process.env.EXIGIR_2FA_ADMIN === "true";
}

// ¿A esta persona le toca activarla y todavía no lo ha hecho?
export function falta2fa(usuario: { role: string; totpActivo: boolean }): boolean {
  return exige2faAAdmins() && usuario.role === "ADMIN" && !usuario.totpActivo;
}
