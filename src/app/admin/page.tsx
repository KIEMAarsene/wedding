import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo";
import { Shell } from "@/components/shell";
import { Admin } from "@/components/admin";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  let user;
  try {
    user = await identity();
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/accueil");
  return (
    <Shell role={user.role} demo={demoEnabled()}>
      <Admin />
    </Shell>
  );
}
