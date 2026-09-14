import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { env } from "./config";

export type SessionTokens = { token: string; refreshToken: string };

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getAccessToken() {
  return (await cookies()).get(env.ACCESS_COOKIE)?.value;
}

export async function getRefreshToken() {
  return (await cookies()).get(env.REFRESH_COOKIE)?.value;
}

export async function setSession(tokens: SessionTokens) {
  const store = await cookies();
  store.set(env.ACCESS_COOKIE, tokens.token, {
    ...options,
    maxAge: env.ACCESS_MAX_AGE,
  });
  store.set(env.REFRESH_COOKIE, tokens.refreshToken, {
    ...options,
    maxAge: env.REFRESH_MAX_AGE,
  });
}

export function setSessionResponseCookies(
  response: NextResponse,
  tokens: SessionTokens,
) {
  response.cookies.set(env.ACCESS_COOKIE, tokens.token, {
    ...options,
    maxAge: env.ACCESS_MAX_AGE,
  });
  response.cookies.set(env.REFRESH_COOKIE, tokens.refreshToken, {
    ...options,
    maxAge: env.REFRESH_MAX_AGE,
  });
}

export async function refreshSession(
  refreshToken: string,
): Promise<SessionTokens | null> {
  try {
    const response = await fetch(
      `${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => null);
    const tokens = body?.data;
    if (
      !response.ok ||
      typeof tokens?.token !== "string" ||
      typeof tokens?.refreshToken !== "string"
    ) {
      return null;
    }
    return { token: tokens.token, refreshToken: tokens.refreshToken };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(env.ACCESS_COOKIE);
  store.delete(env.REFRESH_COOKIE);
}

export function clearSessionResponseCookies(response: NextResponse) {
  response.cookies.delete(env.ACCESS_COOKIE);
  response.cookies.delete(env.REFRESH_COOKIE);
}
