import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const admin = "11111111-1111-4111-8111-111111111111";
const accueil = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
async function user(id: string, role = "authenticated") {
  await db.exec(
    `reset role; select set_config('test.uid','${id}',false); set role ${role};`,
  );
}
async function call<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) {
  return (await db.query<{ result: T }>(`select ${sql} as result`, args))
    .rows[0].result;
}
async function make(quota = 5) {
  await user(admin);
  return call<{ id: string; invite_token: string; pass_token: string }>(
    "public.admin_save($1::jsonb)",
    [
      JSON.stringify({
        name: "Famille TEST",
        phone: "",
        category: "Amis",
        quota,
      }),
    ],
  );
}
async function confirm(token: string, n: number) {
  await user("", "service_role");
  return call("public.guest_rsvp($1,$2,$3)", [token, "confirmed", n]);
}
async function enter(
  id: string,
  count: number,
  requestId = crypto.randomUUID(),
) {
  await user(accueil);
  return call<{ admitted: number }>("public.admit($1::uuid,$2,$3::uuid)", [
    id,
    count,
    requestId,
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$; grant usage on schema auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  await db.exec(readFileSync("supabase/migrations/001_wedding.sql", "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}'),('${accueil}'),('${stranger}'); insert into public.staff_roles values('${admin}','admin'),('${accueil}','accueil');`,
  );
});
afterAll(async () => {
  await db.close();
});
describe("Migration PostgreSQL réellement exécutée", () => {
  it.each([1, 2, 5])("confirme et admet un groupe de %i", async (q) => {
    const i = await make(q);
    await confirm(i.invite_token, q);
    expect((await enter(i.id, q)).admitted).toBe(q);
    await expect(enter(i.id, 1)).rejects.toThrow("entièrement");
  });
  it("réponse inférieure, dépassement RSVP, entrées partielles", async () => {
    const i = await make();
    await expect(confirm(i.invite_token, 6)).rejects.toThrow("autorisé");
    await confirm(i.invite_token, 3);
    expect((await enter(i.id, 2)).admitted).toBe(2);
    await expect(enter(i.id, 2)).rejects.toThrow("insuffisantes");
    expect((await enter(i.id, 1)).admitted).toBe(3);
    await expect(confirm(i.invite_token, 2)).rejects.toThrow("verrouillée");
  });
  it("deux demandes en compétition ne dépassent pas le confirmé (moteur local sérialisé)", async () => {
    const i = await make();
    await confirm(i.invite_token, 3);
    await user(accueil);
    const results = await Promise.allSettled([
      call("public.admit($1::uuid,2,$2::uuid)", [i.id, crypto.randomUUID()]),
      call("public.admit($1::uuid,2,$2::uuid)", [i.id, crypto.randomUUID()]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const found = await call<InvitationScan>("public.staff_scan($1)", [
      i.pass_token,
    ]);
    expect(found.admitted).toBe(2);
  });
  it("réessai idempotent et collision de paramètres", async () => {
    const i = await make();
    await confirm(i.invite_token, 3);
    const id = crypto.randomUUID();
    expect((await enter(i.id, 2, id)).admitted).toBe(2);
    expect((await enter(i.id, 2, id)).admitted).toBe(2);
    await expect(enter(i.id, 1, id)).rejects.toThrow("déjà utilisé");
  });
  it("annulation et non confirmé", async () => {
    const i = await make();
    await expect(enter(i.id, 1)).rejects.toThrow("non confirmée");
    await confirm(i.invite_token, 2);
    await user(admin);
    await call("public.admin_action($1::uuid,$2,$3::jsonb)", [
      i.id,
      "active",
      JSON.stringify({ active: false }),
    ]);
    await expect(enter(i.id, 1)).rejects.toThrow("annulée");
    await expect(confirm(i.invite_token, 1)).rejects.toThrow("annulée");
  });
  it("recherche par nom/code et scan sans fuite de secrets", async () => {
    const i = await make();
    await user(accueil);
    const scan = await call<InvitationScan>("public.staff_scan($1)", [
      i.pass_token,
    ]);
    expect(scan).not.toHaveProperty("invite_token");
    expect(scan).not.toHaveProperty("pass_token");
    const matches = await call<InvitationScan[]>("public.staff_search($1)", [
      "Famille TEST",
    ]);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).not.toHaveProperty("comment");
    await expect(
      call("public.staff_scan($1)", ["z".repeat(64)]),
    ).rejects.toThrow("QR inconnu");
  });
  it("RLS refuse aux anonymes, rôle non attribué et agents les opérations admin", async () => {
    const i = await make();
    await user("", "anon");
    await expect(
      call("public.guest_invitation($1)", [i.invite_token]),
    ).rejects.toThrow("permission denied");
    await expect(db.query("select * from public.invitations")).rejects.toThrow(
      "permission denied",
    );
    await user(stranger);
    expect(
      (await db.query("select * from public.invitations")).rows,
    ).toHaveLength(0);
    await expect(call("public.staff_search()")).rejects.toThrow("Accès refusé");
    await user(accueil);
    expect(
      (await db.query("select * from public.invitations")).rows,
    ).toHaveLength(0);
    await expect(
      call("public.admin_save($1::jsonb)", [
        JSON.stringify({ name: "Pirate", category: "Amis", quota: 300 }),
      ]),
    ).rejects.toThrow("Accès refusé");
    await expect(
      db.query("update public.invitations set quota=300 where id=$1", [i.id]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(`insert into public.staff_roles values($1,'admin')`, [stranger]),
    ).rejects.toThrow("permission denied");
  });
  it("import atomique : une mauvaise ligne annule tout", async () => {
    await user(admin);
    const before = (await db.query("select * from public.invitations")).rows
      .length;
    await expect(
      call("public.admin_import($1::jsonb)", [
        JSON.stringify([
          { name: "Valid Test", category: "Amis", quota: 2 },
          { name: "Bad Test", category: "Amis", quota: 301 },
        ]),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.invitations")).rows,
    ).toHaveLength(before);
  });
  it("correction avec motif, journal conservé et rotation des tokens", async () => {
    const i = await make();
    await confirm(i.invite_token, 3);
    await enter(i.id, 2);
    await user(admin);
    await expect(
      call("public.admin_action($1::uuid,$2,$3::jsonb)", [
        i.id,
        "correct",
        JSON.stringify({ count: 1, reason: "x" }),
      ]),
    ).rejects.toThrow("motif");
    await call("public.admin_action($1::uuid,$2,$3::jsonb)", [
      i.id,
      "correct",
      JSON.stringify({ count: 1, reason: "Double comptage" }),
    ]);
    const logs = await db.query<{ action: string }>(
      "select action from public.audit_log where invitation_id=$1",
      [i.id],
    );
    expect(logs.rows.map((r) => r.action)).toContain("admission");
    expect(logs.rows.map((r) => r.action)).toContain("correct");
    await call("public.admin_action($1::uuid,$2)", [i.id, "rotate"]);
    await user("", "service_role");
    await expect(
      call("public.guest_invitation($1)", [i.invite_token]),
    ).rejects.toThrow("inconnu");
  });
  it("limitation persistante de requêtes publiques", async () => {
    await user("", "service_role");
    for (let n = 0; n < 60; n++)
      expect(await call("public.consume_rate_limit($1)", ["test-ip"])).toBe(
        true,
      );
    expect(await call("public.consume_rate_limit($1)", ["test-ip"])).toBe(
      false,
    );
  });

  it("trente requêtes en compétition pour trois places ne consomment que trois admissions", async () => {
    const i = await make(5);
    await confirm(i.invite_token, 3);
    await user(accueil);
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        call("public.admit($1::uuid,1,$2::uuid)", [i.id, crypto.randomUUID()]),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const current = await call<InvitationScan>("public.staff_scan($1)", [
      i.pass_token,
    ]);
    expect(current.admitted).toBe(3);
  });

  it("une correction admin ne peut pas rendre incohérents quota, confirmé et admis", async () => {
    const i = await make(5);
    await confirm(i.invite_token, 3);
    await enter(i.id, 2);
    await user(admin);
    await expect(
      call("public.admin_save($1::jsonb,$2::uuid)", [
        JSON.stringify({
          name: "Famille TEST",
          phone: "",
          category: "Amis",
          quota: 2,
        }),
        i.id,
      ]),
    ).rejects.toThrow("inférieur");
    await expect(
      call("public.admin_action($1::uuid,$2,$3::jsonb)", [
        i.id,
        "rsvp",
        JSON.stringify({ status: "confirmed", count: 1, reason: "Test quota" }),
      ]),
    ).rejects.toThrow();
    await expect(
      call("public.admin_action($1::uuid,$2,$3::jsonb)", [
        i.id,
        "correct",
        JSON.stringify({ count: 4, reason: "Test quota" }),
      ]),
    ).rejects.toThrow();
    const current = await call<InvitationScan>("public.staff_scan($1)", [
      i.pass_token,
    ]);
    expect(current.admitted).toBe(2);
  });
});
type InvitationScan = { id: string; name: string; admitted: number };
