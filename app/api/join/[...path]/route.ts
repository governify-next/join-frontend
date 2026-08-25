import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getAccessToken } from "@/lib/session";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const target = new URL(`${env.JOIN_BACKEND_URL}/api/v1/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": request.headers.get("content-type") || "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
  const payload = await response.text();
  const result = new NextResponse(payload, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
  return result;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
