import type { SessionOptions } from "iron-session";
import type { Role } from "./roles";

export interface SessionData {
  userId: string;
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
    // 1 hora de inactividad permitida antes de tener que volver a entrar.
    maxAge: 60 * 60,
  },
};
