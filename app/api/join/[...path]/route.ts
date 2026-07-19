import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getAccessToken, getRefreshToken } from "@/lib/session";

type RotatedSession = { token: string; refreshToken: string };

async function sessionToken(): Promise<{ token?: string; rotated?: RotatedSession }> {
  const token = await getAccessToken();
  if (token) return { token };
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return {};
  const response = await fetch(`${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.token || !body?.data?.refreshToken) return {};
  return { token: body.data.token, rotated: body.data };
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const session = await sessionToken();
  if (!session.token)
    return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
  const target = new URL(`${env.JOIN_BACKEND_URL}/api/v1/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(body ? { "Content-Type": request.headers.get("content-type") || "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
  const payload = await response.text();
  const result = new NextResponse(payload, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
  if (session.rotated) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    result.cookies.set(env.ACCESS_COOKIE, session.rotated.token, {
      ...options,
      maxAge: env.ACCESS_MAX_AGE,
    });
    result.cookies.set(env.REFRESH_COOKIE, session.rotated.refreshToken, {
      ...options,
      maxAge: env.REFRESH_MAX_AGE,
    });
  }
  return result;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
