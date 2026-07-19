import { cookies } from "next/headers";
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

export async function clearSession() {
  const store = await cookies();
  store.delete(env.ACCESS_COOKIE);
  store.delete(env.REFRESH_COOKIE);
}
