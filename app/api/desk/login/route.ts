import { NextResponse } from "next/server";
import {
  DESK_COOKIE,
  deskCookieOptions,
  isValidPassword,
  sessionToken,
} from "@/lib/desk-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  if (!isValidPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DESK_COOKIE, sessionToken(), deskCookieOptions());
  return response;
}
