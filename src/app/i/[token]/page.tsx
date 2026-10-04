import { Guest } from "@/components/guest";
export const dynamic = "force-dynamic";
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <Guest token={token} />;
}
