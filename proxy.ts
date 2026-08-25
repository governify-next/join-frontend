import { NextRequest, NextResponse } from "next/server";
import { env } from "./lib/config";
import { clearSessionResponseCookies } from "./lib/session";

export default function proxy(request: NextRequest) {
  const publicRoute = request.nextUrl.pathname === "/login";
  const access = request.cookies.get(env.ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(env.REFRESH_COOKIE)?.value;
  if (access || refresh) {
    if (publicRoute) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!publicRoute) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const response = NextResponse.redirect(login);
    clearSessionResponseCookies(response);
    return response;
  }
  const response = NextResponse.next();
  clearSessionResponseCookies(response);
  return response;
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
