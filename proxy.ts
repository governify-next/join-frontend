import { NextRequest, NextResponse } from "next/server";
import { env } from "./lib/config";

export default async function proxy(request: NextRequest) {
  const publicRoute = request.nextUrl.pathname === "/login";
  const access = request.cookies.get(env.ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(env.REFRESH_COOKIE)?.value;
  if (access) {
    if (publicRoute) return NextResponse.redirect(new URL("/github", request.url));
    return NextResponse.next();
  }
  if (refresh) {
    try {
      const response = await fetch(`${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const body = await response.json();
      if (response.ok) {
        request.cookies.set(env.ACCESS_COOKIE, body.data.token);
        request.cookies.set(env.REFRESH_COOKIE, body.data.refreshToken);
        const result = publicRoute
          ? NextResponse.redirect(new URL("/github", request.url))
          : NextResponse.next({ request: { headers: request.headers } });
        result.cookies.set(env.ACCESS_COOKIE, body.data.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: env.ACCESS_MAX_AGE });
        result.cookies.set(env.REFRESH_COOKIE, body.data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: env.REFRESH_MAX_AGE });
        return result;
      }
    } catch {}
  }
  if (!publicRoute) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
