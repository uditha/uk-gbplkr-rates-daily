import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rates = await getComparisonRates();
    return Response.json(rates);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch provider rates";
    return Response.json({ error: message }, { status: 502 });
  }
}
