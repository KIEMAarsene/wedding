// Projet de recette exclusivement. Deux connexions Auth distinctes au même serveur PostgreSQL.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error("Configurez le projet Supabase de recette dans .env.test.");
if (process.env.TEST_ALLOW_DATABASE_WRITES !== "yes")
  throw new Error(
    "Utilisez un projet Supabase de recette et TEST_ALLOW_DATABASE_WRITES=yes.",
  );
const make = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const a = make(),
  b = make(),
  c = make();
const accounts = [
  [a, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, "admin"],
  [b, process.env.TEST_AGENT_EMAIL, process.env.TEST_AGENT_PASSWORD, "accueil"],
  [
    c,
    process.env.TEST_AGENT2_EMAIL,
    process.env.TEST_AGENT2_PASSWORD,
    "accueil",
  ],
];
if (!url || !key || accounts.some(([, email, password]) => !email || !password))
  throw new Error(
    "Configurez la base de recette, un admin et deux comptes accueil distincts dans .env.test.",
  );
if (new Set(accounts.map(([, email]) => email.toLowerCase())).size !== 3)
  throw new Error("Utilisez trois comptes distincts.");
for (const [client, email, password] of [
  [a, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD],
  [b, process.env.TEST_AGENT_EMAIL, process.env.TEST_AGENT_PASSWORD],
  [c, process.env.TEST_AGENT2_EMAIL, process.env.TEST_AGENT2_PASSWORD],
]) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(
      "Connexion de recette impossible. Vérifiez les comptes et rôles.",
    );
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
for (const [client, , , role] of accounts)
  assert.equal(
    await rpc(client, "staff_role", {}),
    role,
    "Rôle de recette incorrect.",
  );
const i = await rpc(a, "admin_save", {
  p_data: {
    name: `RECETTE CONCURRENCE ${Date.now()}`,
    phone: "",
    category: "Recette",
    quota: 3,
    comment: "Créée par test-supabase ; ne pas partager.",
  },
});
try {
  await rpc(a, "admin_action", {
    p_id: i.id,
    p_action: "rsvp",
    p_value: {
      status: "confirmed",
      count: 3,
      reason: "Test concurrence deux sessions",
    },
  });
  const results = await Promise.allSettled([
    rpc(c, "admit", {
      p_id: i.id,
      p_count: 2,
      p_request_id: crypto.randomUUID(),
    }),
    rpc(b, "admit", {
      p_id: i.id,
      p_count: 2,
      p_request_id: crypto.randomUUID(),
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    results.find((r) => r.status === "rejected").reason.message,
    /insuffisantes/,
  );
  const row = await rpc(a, "staff_scan", { p_token: i.pass_token });
  assert.equal(row.admitted, 2);
  assert(!("pass_token" in row));
  assert(!("invite_token" in row));
  const id = crypto.randomUUID();
  const args = { p_id: i.id, p_count: 1, p_request_id: id };
  const [first, second] = await Promise.all([
    rpc(b, "admit", args),
    rpc(b, "admit", args),
  ]);
  assert.equal(first.admitted, 3);
  assert.equal(second.admitted, 3);
  assert.equal(
    (await rpc(a, "staff_scan", { p_token: i.pass_token })).admitted,
    3,
  );
  const over = await b.rpc("admit", {
    p_id: i.id,
    p_count: 1,
    p_request_id: crypto.randomUUID(),
  });
  assert(over.error);
  assert.match(over.error.message, /entièrement/);
  const denied = await b.rpc("admin_save", {
    p_data: { name: "Test accès agent", category: "Recette", quota: 1 },
  });
  assert(denied.error);
  assert.equal(denied.error.code, "42501");
  console.log(
    "PASS : deux comptes accueil concurrents, quota respecté, réessai idempotent et accès admin refusé.",
  );
} finally {
  await rpc(a, "admin_action", {
    p_id: i.id,
    p_action: "active",
    p_value: { active: false },
  });
  console.log("Invitation de recette annulée ; historique conservé.");
}
