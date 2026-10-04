import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import { demoEnabled } from "@/lib/demo";
import { Shell } from "@/components/shell";
import { Reception } from "@/components/reception";
export const dynamic = "force-dynamic";
export default async function ReceptionPage() {
  let user;
  try {
    user = await identity();
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");
  return (
    <Shell role={user.role} demo={demoEnabled()}>
      <Reception />
    </Shell>
  );
}
