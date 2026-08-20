import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-white">
      <AdminPanel />
    </div>
  );
}
