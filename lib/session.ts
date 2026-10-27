import type { SessionOptions } from "iron-session";
import type { Role } from "./roles";

export interface SessionData {
  userId: string;
  // Id de la fila SesionActiva de esta sesión (ver lib/auth.ts): si la fila ya
  // no existe, la cookie no sirve aunque alguien la haya copiado.
  sesionId: string;
  // Marcas de tiempo (ms) para el cierre por inactividad y el tope de
  // duración (ver lib/sesion-vigencia.ts). Van dentro de la cookie firmada.
  iniciadaEl: number;
  ultimaActividad: number;
  // Tiene que cambiar su contraseña antes de usar el sistema (ver
  // User.debeCambiarContrasena): el middleware lo manda a /cambiar-contrasena.
  debeCambiarContrasena?: boolean;
  username: string;
  role: Role;
  // Puesto de la persona (ver User.puesto en el schema): no se guarda en la
  // cookie, requireUser lo relee de la base en cada request igual que el rol
  // (ver lib/auth.ts). Se muestra en el Header en vez del rol técnico.
  puesto?: string | null;
  // Cuántos mantenimientos "En proceso" había al iniciar esta sesión (ver
  // actions/auth-actions.ts). Transitorio: el layout protegido lo lee una
  // vez para mostrar el aviso y lo borra de inmediato, así solo aparece justo
  // después de iniciar sesión y no en cada navegación.
  pendingInProgressCount?: number;
  // Mismo mecanismo transitorio que pendingInProgressCount, pero para
  // órdenes de prioridad ALTA sin resolver (ver lib/login-alerts.ts y
  // components/layout/HighPriorityOrderAlertToast.tsx).
  pendingHighPriorityOrderCount?: number;
  // Mismo mecanismo, para unidades con la alerta de cambio de válvulas en
  // rojo (ver components/layout/ValveRedAlertToast.tsx).
  pendingValveRedAlertCount?: number;
}

// Lo que el resto del sistema necesita saber de quien está dentro (lo que
// devuelve requireUser): la cuenta releída de la base, sin las marcas internas
// de la cookie.
export type UsuarioSesion = Pick<SessionData, "userId" | "username" | "role" | "puesto"> & {
  sesionId?: string;
};

// Una cookie marcada "secure" SOLO viaja por https. Antes esto se activaba
// solo con NODE_ENV=production, que es justo lo que corre al hacer
// `next start` — y como el sistema se sirve por http en la red local
// (http://192.168.x.x:3000), el navegador de las demás computadoras se
// negaría a guardar la cookie y NADIE podría iniciar sesión: quedaría
// dando vueltas de regreso al login sin decir por qué.
//
// Por eso ahora es explícito: se prende poniendo COOKIE_SECURE=true en .env,
// y eso hay que hacerlo únicamente cuando el sistema ya se sirva por https
// (ver la nota de despliegue en .env.example).
const servidoPorHttps = process.env.COOKIE_SECURE === "true";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "pagasa_session",
  cookieOptions: {
    secure: servidoPorHttps,
    httpOnly: true,
    sameSite: "lax",
    // Sin maxAge: es una cookie "de sesión", el navegador la tira al cerrarse
    // y al volver hay que iniciar sesión desde cero. El vencimiento por
    // inactividad (20 min) y el tope de 12 h los aplica el servidor con las
    // marcas de tiempo de la cookie (lib/sesion-vigencia.ts); con maxAge
    // indefinido iron-session tampoco le pone caducidad al sello.
    maxAge: undefined,
  },
};
