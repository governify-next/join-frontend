import { NextResponse } from "next/server";
import {
  clearSessionResponseCookies,
  getRefreshToken,
  refreshSession,
  setSessionResponseCookies,
} from "@/lib/session";

export async function POST() {
  const refreshToken = await getRefreshToken();
  const session = refreshToken ? await refreshSession(refreshToken) : null;

  if (!session) {
    const response = NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
    response.headers.set("Cache-Control", "no-store");
    clearSessionResponseCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  setSessionResponseCookies(response, session);
  return response;
}
