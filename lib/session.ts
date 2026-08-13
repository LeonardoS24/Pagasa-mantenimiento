import type { SessionOptions } from "iron-session";
import type { Role } from "./roles";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
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

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "pagasa_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    // 1 hora de inactividad permitida antes de tener que volver a entrar.
    maxAge: 60 * 60,
  },
};
