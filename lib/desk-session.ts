import { cookies } from "next/headers";
import { DESK_COOKIE, isValidSession } from "@/lib/desk-auth";

export async function isDeskAuthenticated() {
  const jar = await cookies();
  return isValidSession(jar.get(DESK_COOKIE)?.value);
}
