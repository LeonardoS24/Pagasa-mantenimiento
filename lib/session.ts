import type { SessionOptions } from "iron-session";
import type { Role } from "./roles";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
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
