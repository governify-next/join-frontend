"use server";

import { env } from "@/lib/config";
import { clearSession, getRefreshToken } from "@/lib/session";

export async function logoutAction() {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await fetch(`${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    // Local logout must also work when the account service is unavailable.
  } finally {
    await clearSession();
  }
}
