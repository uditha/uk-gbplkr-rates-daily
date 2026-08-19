import Link from "next/link";
import { RateHeatmap } from "@/components/RateHeatmap";
import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getComparisonRates();

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white p-6 text-center">
        <p className="max-w-md text-sm text-zinc-600">
          No stored rates yet. Refresh a provider from{" "}
          <Link className="underline" href="/admin">
            /admin
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-white p-3 sm:p-4">
      <RateHeatmap data={data} />
    </div>
  );
}
