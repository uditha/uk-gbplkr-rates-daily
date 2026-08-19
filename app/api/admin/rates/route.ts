import { loadStore } from "@/lib/store/rates-store";
import {
  applyManualSendRate,
  refreshProvider,
  refreshWiredProviders,
} from "@/lib/store/refresh";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

export async function GET() {
  const state = await loadStore();
  return Response.json(state);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      providerId?: string;
      sendRate?: number;
    };
    const providerId = body.providerId;

    if (!providerId || providerId === "all") {
      const state = await refreshWiredProviders();
      return Response.json({ state });
    }

    const record =
      body.sendRate != null
        ? await applyManualSendRate(providerId, Number(body.sendRate))
        : await refreshProvider(providerId);
    const state = await loadStore();
    return Response.json({ state, record });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to refresh provider";
    const state = await loadStore();
    return Response.json({ error: message, state }, { status: 502 });
  }
}
