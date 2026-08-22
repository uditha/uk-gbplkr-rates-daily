import { HeatmapApp } from "@/components/HeatmapApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <div className="box-border flex h-dvh max-h-dvh w-full overflow-hidden overscroll-none bg-zinc-100 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:p-2">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm">
        <HeatmapApp />
      </div>
    </div>
  );
}
