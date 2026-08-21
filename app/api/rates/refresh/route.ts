import { revalidatePath } from "next/cache";
import { hasSharedStore } from "@/lib/store/rates-store";
import { refreshIfStale } from "@/lib/store/refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = "lhr1";
export const maxDuration = 60;

export async function POST() {
  const result = await refreshIfStale();
  if (result.refreshed) {
    revalidatePath("/");
  }
  return Response.json(
    { ...result, sharedStore: hasSharedStore() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
