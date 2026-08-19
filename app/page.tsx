import { RateHeatmap } from "@/components/RateHeatmap";
import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function Home() {
  let data;
  let message: string | null = null;

  try {
    data = await getComparisonRates();
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Could not load live rates";
  }

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white p-6 text-center">
        <p className="max-w-md text-sm text-zinc-600">{message}</p>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-white p-3 sm:p-4">
      <RateHeatmap data={data} />
    </div>
  );
}
