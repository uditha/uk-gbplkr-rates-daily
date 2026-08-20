import { AdminPanel } from "./admin-panel";
import { loadStore } from "@/lib/store/rates-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const initialState = await loadStore();

  return (
    <div className="min-h-dvh bg-white">
      <AdminPanel initialState={initialState} />
    </div>
  );
}
