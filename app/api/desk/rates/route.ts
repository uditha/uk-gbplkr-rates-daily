import { revalidatePath } from "next/cache";
import { hasSharedStore, loadStore } from "@/lib/store/rates-store";
import {
  applyManualSendRate,
  refreshProvider,
  refreshWiredProviders,
} from "@/lib/store/refresh";
import { isDeskAuthenticated } from "@/lib/desk-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = "lhr1";

async function unauthorized() {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  if (!(await isDeskAuthenticated())) return unauthorized();
  const state = await loadStore();
  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!(await isDeskAuthenticated())) return unauthorized();
  try {
    const body = (await request.json()) as {
      providerId?: string;
      sendRate?: number;
    };
    const providerId = body.providerId;

    if (!providerId || providerId === "all") {
      const state = await refreshWiredProviders();
      revalidatePath("/");
      return Response.json(
        { state, sharedStore: hasSharedStore() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const record =
      body.sendRate != null
        ? await applyManualSendRate(providerId, Number(body.sendRate))
        : await refreshProvider(providerId);
    const state = await loadStore();
    revalidatePath("/");
    return Response.json(
      { state, record, sharedStore: hasSharedStore() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to refresh provider";
    const state = await loadStore();
    return Response.json(
      { error: message, state, sharedStore: hasSharedStore() },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
