import { colorForBehind, heatmapGradient } from "@/lib/heatmap";
import { columnLeaders, DATES, PROVIDERS } from "@/lib/rates";

function formatRate(rate: number) {
  return rate.toFixed(2);
}

function formatBehind(behind: number) {
  if (behind === 0) {
    return "BEST";
  }
  return `-${behind.toFixed(2)}`;
}

export function RateHeatmap() {
  const leaders = columnLeaders(PROVIDERS);

  return (
    <div className="flex h-full min-h-0 w-full items-stretch gap-3">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div
          className="grid h-full min-h-[28rem] min-w-[56rem] gap-px"
          style={{
            gridTemplateColumns: `minmax(11rem, 13rem) repeat(${DATES.length}, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(${PROVIDERS.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {DATES.map((date) => (
            <div
              key={date}
              className="px-1 pb-2 text-center text-[11px] font-medium text-zinc-500"
            >
              {date}
            </div>
          ))}

          {PROVIDERS.map((provider) => (
            <div key={provider.name} className="contents">
              <div className="flex items-center pr-3 text-right text-[13px] font-medium text-zinc-800">
                <span className="w-full leading-tight">{provider.name}</span>
              </div>
              {provider.rates.map((rate, column) => {
                const leader = leaders[column];
                if (rate == null || leader == null) {
                  return (
                    <div
                      key={`${provider.name}-${column}`}
                      className="flex h-full min-h-0 items-center justify-center rounded-md bg-zinc-100 text-sm text-zinc-400"
                    >
                      —
                    </div>
                  );
                }

                const behind = Number((leader - rate).toFixed(2));
                const { background, color } = colorForBehind(behind);
                const isBest = behind === 0;

                return (
                  <div
                    key={`${provider.name}-${column}`}
                    title={
                      isBest
                        ? `${provider.name} led on ${DATES[column]} at ${formatRate(rate)} LKR per £1`
                        : `${formatRate(behind)} LKR per £1 behind the leader on ${DATES[column]}`
                    }
                    className="flex h-full min-h-0 flex-col items-center justify-center rounded-md px-1 py-1.5 text-center"
                    style={{ background, color }}
                  >
                    <span className="font-mono text-[13px] font-semibold tabular-nums leading-none sm:text-sm">
                      {formatRate(rate)}
                    </span>
                    <span
                      className={`mt-1 leading-none ${
                        isBest
                          ? "text-[10px] font-bold tracking-wide sm:text-[11px]"
                          : "font-mono text-[11px] tabular-nums opacity-90"
                      }`}
                    >
                      {formatBehind(behind)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <HeatmapLegend />
    </div>
  );
}

function HeatmapLegend() {
  const ticks = [
    { value: 0, label: "0.0" },
    { value: 0.5, label: "0.5" },
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 4, label: "4" },
    { value: 8, label: "8+" },
  ];

  return (
    <div className="hidden h-full min-h-0 shrink-0 sm:flex sm:flex-col">
      <p className="mb-2 max-w-[7.5rem] text-[11px] leading-tight text-zinc-500">
        LKR per £1 behind the leader
      </p>
      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        <div
          className="w-3 rounded-sm"
          style={{ background: heatmapGradient() }}
        />
        <div className="relative w-8">
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className="absolute left-0 -translate-y-1/2 font-mono text-[11px] tabular-nums text-zinc-500"
              style={{ top: `${(tick.value / 8) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
