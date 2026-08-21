import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = "lhr1";

export async function GET() {
  const rates = await getComparisonRates();
  if (!rates) {
    return Response.json(
      { error: "No stored rates yet." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(rates, {
    headers: { "Cache-Control": "no-store" },
  });
}
