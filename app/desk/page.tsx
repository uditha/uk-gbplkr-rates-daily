import { isDeskAuthenticated } from "@/lib/desk-session";
import { DeskLoginForm } from "./login-form";
import { DeskPanel } from "./desk-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DeskPage() {
  const signedIn = await isDeskAuthenticated();

  return (
    <div className="min-h-dvh bg-white">
      {signedIn ? <DeskPanel /> : <DeskLoginForm />}
    </div>
  );
}
