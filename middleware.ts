import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
