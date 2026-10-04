import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { demoEnabled } from "./demo";
import { sessionClient } from "./supabase";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function sign(v: string) {
  return createHmac("sha256", process.env.DEMO_PASSWORD || "disabled")
    .update(v)
    .digest("hex");
}
export async function demoLogin(password: string, role: "admin" | "accueil") {
  if (!demoEnabled() || !process.env.DEMO_PASSWORD)
    throw new HttpError("Configurez DEMO_PASSWORD dans .env.local.", 503);
  const a = Buffer.from(password);
  const b = Buffer.from(process.env.DEMO_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError("Identifiants incorrects.", 401);
  const v = Buffer.from(
    JSON.stringify({ role, exp: Date.now() + 8 * 3600_000 }),
  ).toString("base64url");
  (await cookies()).set("wedding-demo", `${v}.${sign(v)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function identity() {
  if (demoEnabled()) {
    const token = (await cookies()).get("wedding-demo")?.value;
    if (!token) return null;
    const [v, s] = token.split(".");
    if (
      !s ||
      s.length !== 64 ||
      !timingSafeEqual(Buffer.from(s), Buffer.from(sign(v)))
    )
      return null;
    try {
      const p = JSON.parse(Buffer.from(v, "base64url").toString());
      if (p.exp < Date.now() || !["admin", "accueil"].includes(p.role))
        return null;
      return { id: `demo-${p.role}`, role: p.role as "admin" | "accueil" };
    } catch {
      return null;
    }
  }
  const client = await sessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || !["admin", "accueil"].includes(data.role)) return null;
  return { id: user.id, role: data.role as "admin" | "accueil" };
}
export async function requireRole(admin = false) {
  const user = await identity();
  if (!user)
    throw new HttpError("Connectez-vous avec un compte autorisé.", 401);
  if (admin && user.role !== "admin")
    throw new HttpError("Cette action est réservée à l’administrateur.", 403);
  return user;
}
