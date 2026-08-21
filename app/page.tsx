import { HeatmapApp } from "@/components/HeatmapApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <div className="box-border flex h-full max-h-full w-full overflow-hidden overscroll-none bg-zinc-100 p-2">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <HeatmapApp />
      </div>
    </div>
  );
}
