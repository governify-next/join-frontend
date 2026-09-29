import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getAccessToken } from "@/lib/session";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401, headers },
    );
  }

  try {
    const response = await fetch(
      `${env.AUTHENTICATOR_SERVICE_URL}/api/v1/users/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 401) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401, headers },
      );
    }
    const body = await response.json();
    if (!response.ok || typeof body?.data?.username !== "string") {
      throw new Error("Unable to load account");
    }
    return NextResponse.json(
      { data: { username: body.data.username } },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { message: "Unable to load account" },
      { status: 502, headers },
    );
  }
}
