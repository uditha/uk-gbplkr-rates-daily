import Link from "next/link";
import { RateHeatmap } from "@/components/RateHeatmap";
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
    <div className="h-dvh w-full overflow-hidden bg-zinc-100 p-3 sm:p-5">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
              UK → Sri Lanka
            </h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Effective LKR per £1, by send amount
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Admin
          </Link>
        </header>
        <div className="min-h-0 flex-1 px-3 py-3 sm:px-4 sm:py-4">
          <RateHeatmap data={data} />
        </div>
      </div>
    </div>
  );
}
