"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/config";
import { setSession } from "@/lib/session";

export type LoginState = { error?: string };

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");
  const returnTo = String(formData.get("returnTo") || "/github");
  if (login.length < 3 || password.length < 6)
    return { error: "Enter a valid login and password." };
  try {
    const response = await fetch(
      `${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) return { error: body?.message || "Login failed." };
    await setSession(body.data);
  } catch {
    return { error: "The account service is unavailable." };
  }
  redirect(returnTo.startsWith("/") ? returnTo : "/github");
}
