import Link from "next/link";
import { HeatmapApp } from "@/components/HeatmapApp";
import { getComparisonRates } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getComparisonRates();

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-50 p-6 text-center">
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
    <div className="box-border flex h-full max-h-full w-full overflow-hidden overscroll-none bg-zinc-100 p-2">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <HeatmapApp data={data} />
      </div>
    </div>
  );
}
