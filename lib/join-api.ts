import { env } from "./config";
import { getAccessToken } from "./session";

export async function joinApi<T>(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${env.JOIN_BACKEND_URL}/api/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Join request failed");
  return body.data as T;
}
