import { NextResponse } from "next/server";
import { DESK_COOKIE, deskCookieOptions } from "@/lib/desk-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DESK_COOKIE, "", { ...deskCookieOptions(), maxAge: 0 });
  return response;
}
