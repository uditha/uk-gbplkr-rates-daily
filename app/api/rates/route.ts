import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

export async function GET() {
  const rates = await getComparisonRates();
  if (!rates) {
    return Response.json(
      { error: "No stored rates yet. Refresh a provider from /admin." },
      { status: 404 },
    );
  }
  return Response.json(rates);
}
