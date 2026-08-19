import { RateHeatmap } from "@/components/RateHeatmap";
import { UPDATED_ON } from "@/lib/rates";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
            UK → Sri Lanka
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Daily GBP to LKR remittance rates
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
            How many rupees you get per £1 across popular money transfer
            providers. Green is closest to that day&apos;s best quote; darker
            purple means further behind the leader.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                LKR per £1 heatmap
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Last 12 days · snapshot updated {UPDATED_ON}
              </p>
            </div>
            <p className="text-xs text-zinc-400">
              Missing quotes show as —
            </p>
          </div>
          <RateHeatmap />
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-zinc-500 sm:px-6">
          Public comparison page for UK to Sri Lanka transfers. Cell colour is
          the gap versus the best observed rate that day, not a recommendation.
        </p>
      </footer>
    </div>
  );
}
