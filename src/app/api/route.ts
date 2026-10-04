import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { demo, demoEnabled } from "@/lib/demo";
import { sessionClient, serviceClient } from "@/lib/supabase";
import { demoLogin, HttpError, identity, requireRole } from "@/lib/auth";
import {
  admissionInput,
  invitationInput,
  rsvpInput,
  DomainError,
} from "@/lib/domain";
export const runtime = "nodejs";
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Token invalide.");
const localRates = new Map<string, { at: number; n: number }>();
async function rate(req: NextRequest) {
  const key = createHash("sha256")
    .update(
      req.headers.get("x-vercel-forwarded-for") ||
        req.headers.get("x-forwarded-for") ||
        "local",
    )
    .digest("hex");
  if (demoEnabled()) {
    const now = Date.now();
    for (const [k, v] of localRates)
      if (now - v.at > 60_000) localRates.delete(k);
    const v = localRates.get(key) || { at: now, n: 0 };
    v.n++;
    localRates.set(key, v);
    if (v.n > 60)
      throw new HttpError("Trop de demandes. Réessayez dans une minute.", 429);
  } else {
    const { data, error } = await serviceClient().rpc("consume_rate_limit", {
      p_key: key,
    });
    if (error) throw new HttpError("Service temporairement indisponible.", 503);
    if (!data)
      throw new HttpError("Trop de demandes. Réessayez dans une minute.", 429);
  }
}
function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_URL || req.url).origin;
  if (!origin || origin !== expected)
    throw new HttpError("Origine de la requête refusée.", 403);
}
function errorResponse(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      { error: e.issues[0]?.message || "Données invalides." },
      { status: 400 },
    );
  if (e instanceof HttpError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof DomainError)
    return NextResponse.json({ error: e.message }, { status: 400 });
  return NextResponse.json(
    { error: "Service temporairement indisponible." },
    { status: 503 },
  );
}
async function rpc(name: string, args: Record<string, unknown>, guest = false) {
  const client = guest ? serviceClient() : await sessionClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === "42501") throw new HttpError("Accès refusé.", 403);
    if (error.code?.startsWith("23"))
      throw new HttpError(
        "Données incompatibles avec les quotas ou entrées existantes.",
      );
    if (error.code === "P0001") throw new HttpError(error.message);
    throw new HttpError(
      "Impossible de vérifier le résultat. Réessayez la même opération.",
      503,
    );
  }
  return data;
}
export async function GET(req: NextRequest) {
  try {
    const command = req.nextUrl.searchParams.get("command") || "";
    if (command === "session")
      return NextResponse.json({ user: await identity(), demo: demoEnabled() });
    if (command === "guest") {
      await rate(req);
      const token = tokenSchema.parse(req.nextUrl.searchParams.get("token"));
      return NextResponse.json(
        demoEnabled()
          ? await demo("guest", { token })
          : await rpc("guest_invitation", { p_token: token }, true),
      );
    }
    await requireRole(["list", "audit"].includes(command));
    if (command === "list" || command === "audit") {
      if (demoEnabled()) return NextResponse.json(await demo(command, {}));
      const client = await sessionClient();
      const { data, error } = await client
        .from(command === "list" ? "invitations" : "audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(command === "list" ? 1000 : 200);
      if (error) throw new HttpError("Impossible de charger les données.", 503);
      return NextResponse.json(data);
    }
    if (command === "search") {
      const query = z
        .string()
        .max(160)
        .parse(req.nextUrl.searchParams.get("query") || "");
      return NextResponse.json(
        demoEnabled()
          ? await demo("search", { query })
          : await rpc("staff_search", { p_query: query }),
      );
    }
    if (command === "scan") {
      const token = tokenSchema.parse(req.nextUrl.searchParams.get("token"));
      return NextResponse.json(
        demoEnabled()
          ? await demo("scan", { token })
          : await rpc("staff_scan", { p_token: token }),
      );
    }
    throw new HttpError("Action inconnue.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    if (Number(req.headers.get("content-length") || 0) > 1_000_000)
      throw new HttpError("Fichier trop volumineux.", 413);
    const raw = await req.text();
    if (raw.length > 1_000_000)
      throw new HttpError("Fichier trop volumineux.", 413);
    let b: Record<string, unknown>;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new HttpError("Requête JSON invalide.");
    }
    const command = z.string().parse(b.command);
    if (command === "login") {
      await rate(req);
      const input = z
        .object({
          email: z.string().max(254),
          password: z.string().min(1).max(200),
          role: z.enum(["admin", "accueil"]).default("admin"),
        })
        .parse(b);
      if (demoEnabled()) await demoLogin(input.password, input.role);
      else {
        const client = await sessionClient();
        const { error } = await client.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });
        if (error) throw new HttpError("Identifiants incorrects.", 401);
        if (!(await identity())) {
          await client.auth.signOut();
          throw new HttpError("Ce compte n’a pas de rôle autorisé.", 403);
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (command === "logout") {
      if (demoEnabled())
        (await (await import("next/headers")).cookies()).delete("wedding-demo");
      else await (await sessionClient()).auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (command === "rsvp") {
      await rate(req);
      const token = tokenSchema.parse(b.token);
      const v = rsvpInput.parse(b);
      return NextResponse.json(
        demoEnabled()
          ? await demo("rsvp", { token, ...v })
          : await rpc(
              "guest_rsvp",
              { p_token: token, p_status: v.status, p_count: v.count },
              true,
            ),
      );
    }
    const user = await requireRole(command !== "admit");
    if (command === "admit") {
      const v = admissionInput.parse(b);
      return NextResponse.json(
        demoEnabled()
          ? await demo("admit", v, user.id)
          : await rpc("admit", {
              p_id: v.id,
              p_count: v.count,
              p_request_id: v.requestId,
            }),
      );
    }
    if (command === "save") {
      const row = invitationInput.parse(b.row);
      const id = z.uuid().optional().parse(b.id);
      return NextResponse.json(
        demoEnabled()
          ? await demo("save", { row, id }, user.id)
          : await rpc("admin_save", { p_data: row, p_id: id ?? null }),
      );
    }
    if (command === "import") {
      const rows = z.array(invitationInput).min(1).max(500).parse(b.rows);
      return NextResponse.json(
        demoEnabled()
          ? await demo("import", { rows }, user.id)
          : await rpc("admin_import", { p_rows: rows }),
      );
    }
    if (command === "action") {
      const id = z.uuid().parse(b.id);
      const action = z
        .enum(["active", "sent", "rotate", "correct", "rsvp"])
        .parse(b.action);
      let value: Record<string, unknown> = {};
      if (action === "active")
        value = z.object({ active: z.boolean() }).parse(b.value);
      if (action === "correct")
        value = z
          .object({
            count: z.number().int().min(0).max(300),
            reason: z.string().trim().min(5).max(500),
          })
          .parse(b.value);
      if (action === "rsvp") {
        value = z
          .object({
            status: z.enum(["confirmed", "declined", "pending"]),
            count: z.number().int().min(0).max(300),
            reason: z.string().trim().min(5).max(500),
          })
          .parse(b.value);
        if (
          value.status === "confirmed"
            ? Number(value.count) < 1
            : value.count !== 0
        )
          throw new HttpError("Nombre incompatible avec le statut.");
      }
      return NextResponse.json(
        demoEnabled()
          ? await demo("action", { id, action, value }, user.id)
          : await rpc("admin_action", {
              p_id: id,
              p_action: action,
              p_value: value,
            }),
      );
    }
    throw new HttpError("Action inconnue.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}
