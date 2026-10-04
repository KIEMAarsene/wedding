import { LoginForm } from "@/components/login-form";
import { demoEnabled } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return <LoginForm demo={demoEnabled()} />;
}
