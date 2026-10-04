import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  DomainError,
  assertAdmission,
  assertRsvp,
  type Invitation,
  type Audit,
  type GuestInvitation,
} from "./domain";
type Store = {
  invitations: Invitation[];
  audit: Audit[];
  requests: Record<string, { id: string; count: number; actor: string }>;
  sequence: number;
};
export const demoEnabled = () =>
  process.env.DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production" &&
  !process.env.VERCEL;
export const DEMO_TOKEN = "a".repeat(64);
// Les serveurs localhost et Wi-Fi ont chacun leur stockage et leur file locale.
const folder = path.join(
  process.cwd(),
  process.env.PHONE_TEST_HOST ? ".demo-phone" : ".demo",
);
let queue: Promise<unknown> = Promise.resolve();
const staffView = (i: Invitation) => ({
  ...i,
  invite_token: undefined,
  pass_token: undefined,
  comment: undefined,
});
function seed(): Store {
  const rows: [string, number, string, string, number][] = [
    ["Famille OUEDRAOGO", 5, "Famille marié", "confirmed", 3],
    ["Awa TRAORÉ", 1, "Amis", "pending", 0],
    ["Paul & Marie KABORÉ", 2, "Famille mariée", "confirmed", 2],
    ["Équipe CILSS", 4, "Collègues CILSS", "declined", 0],
    ["Invitation annulée", 2, "Connaissances", "confirmed", 2],
  ];
  return {
    sequence: rows.length,
    requests: {},
    audit: [],
    invitations: rows.map(([name, quota, category, status, confirmed], n) => ({
      id: randomUUID(),
      code: `AG-${String(n + 1).padStart(4, "0")}`,
      name,
      quota,
      category,
      status: status as Invitation["status"],
      confirmed,
      admitted: 0,
      active: n !== 4,
      phone: "",
      comment: "Donnée fictive",
      sent_at: n === 0 ? new Date().toISOString() : null,
      invite_token: n === 0 ? DEMO_TOKEN : randomBytes(32).toString("hex"),
      pass_token: n === 0 ? "b".repeat(64) : randomBytes(32).toString("hex"),
      created_at: new Date().toISOString(),
    })),
  };
}
async function transaction<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
  if (!demoEnabled())
    throw new DomainError("Mode démo interdit en production.");
  const job = queue.then(async () => {
    await mkdir(folder, { recursive: true });
    let s: Store;
    try {
      s = JSON.parse(await readFile(path.join(folder, "data.json"), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      s = seed();
    }
    const result = await fn(s);
    const temp = path.join(folder, "data.tmp");
    await writeFile(temp, JSON.stringify(s, null, 2));
    await rename(temp, path.join(folder, "data.json"));
    return result;
  });
  queue = job.catch(() => {});
  return job;
}
function log(
  s: Store,
  id: string | null,
  actor: string | null,
  action: string,
  details: Record<string, unknown> = {},
) {
  s.audit.unshift({
    id: randomUUID(),
    invitation_id: id,
    actor_id: actor,
    action,
    details,
    created_at: new Date().toISOString(),
  });
}
const guest = (i: Invitation): GuestInvitation => ({
  code: i.code,
  name: i.name,
  quota: i.quota,
  confirmed: i.confirmed,
  admitted: i.admitted,
  status: i.status,
  active: i.active,
  ...(i.active && i.status === "confirmed" ? { pass_token: i.pass_token } : {}),
});
function find(s: Store, id: string) {
  const i = s.invitations.find((i) => i.id === id);
  if (!i) throw new DomainError("Invitation introuvable.");
  return i;
}
export async function demo(
  command: string,
  data: Record<string, unknown>,
  actor = "demo-admin",
) {
  return transaction((s) => {
    if (command === "guest" || command === "rsvp") {
      const i = s.invitations.find((i) => i.invite_token === data.token);
      if (!i) throw new DomainError("Lien inconnu. Vérifiez votre invitation.");
      if (command === "rsvp") {
        assertRsvp(
          i,
          data.status as "confirmed" | "declined",
          data.count as number,
        );
        i.status = data.status as Invitation["status"];
        i.confirmed = data.count as number;
        log(s, i.id, null, "rsvp", { status: i.status, count: i.confirmed });
      }
      return guest(i);
    }
    if (command === "list") return s.invitations;
    if (command === "audit") return s.audit.slice(0, 200);
    if (command === "search")
      return s.invitations
        .filter((i) =>
          [i.name, i.code, i.phone].some((v) =>
            v
              .toLocaleLowerCase("fr")
              .includes(String(data.query ?? "").toLocaleLowerCase("fr")),
          ),
        )
        .map(staffView);
    if (command === "scan") {
      const i = s.invitations.find((i) => i.pass_token === data.token);
      if (!i)
        throw new DomainError(
          "QR inconnu. Utilisez la recherche par nom ou code.",
        );
      return staffView(i);
    }
    if (command === "admit") {
      const i = find(s, String(data.id));
      const key = String(data.requestId);
      const old = s.requests[key];
      if (old) {
        if (old.id !== i.id || old.count !== data.count || old.actor !== actor)
          throw new DomainError("Identifiant de requête déjà utilisé.");
        return { ...staffView(i), replayed: true };
      }
      assertAdmission(i, data.count as number);
      i.admitted += data.count as number;
      s.requests[key] = { id: i.id, count: data.count as number, actor };
      log(s, i.id, actor, "admission", { count: data.count, request_id: key });
      return staffView(i);
    }
    const save = (row: Record<string, unknown>, id?: string) => {
      let i: Invitation;
      if (id) {
        i = find(s, id);
        if (Number(row.quota) < i.confirmed)
          throw new DomainError(
            "Le quota ne peut pas être inférieur au nombre confirmé.",
          );
        Object.assign(i, row);
      } else {
        i = {
          ...row,
          id: randomUUID(),
          code: `AG-${String(++s.sequence).padStart(4, "0")}`,
          status: "pending",
          active: true,
          confirmed: 0,
          admitted: 0,
          sent_at: null,
          invite_token: randomBytes(32).toString("hex"),
          pass_token: randomBytes(32).toString("hex"),
          created_at: new Date().toISOString(),
        } as Invitation;
        s.invitations.push(i);
      }
      log(s, i.id, actor, id ? "edit" : "create", { quota: i.quota });
      return i;
    };
    if (command === "save")
      return save(
        data.row as Record<string, unknown>,
        data.id as string | undefined,
      );
    if (command === "import") {
      for (const row of data.rows as Record<string, unknown>[]) save(row);
      return (data.rows as unknown[]).length;
    }
    if (command === "action") {
      const i = find(s, String(data.id));
      const v = data.value as Record<string, unknown>;
      const previous = i.admitted;
      if (data.action === "active") i.active = v.active as boolean;
      else if (data.action === "sent") i.sent_at = new Date().toISOString();
      else if (data.action === "rotate") {
        i.invite_token = randomBytes(32).toString("hex");
        i.pass_token = randomBytes(32).toString("hex");
      } else if (data.action === "correct") {
        if (Number(v.count) > i.confirmed)
          throw new DomainError("Correction supérieure au nombre confirmé.");
        i.admitted = v.count as number;
      } else if (data.action === "rsvp") {
        if (Number(v.count) > i.quota || Number(v.count) < i.admitted)
          throw new DomainError(
            "Réponse incompatible avec les quotas ou entrées.",
          );
        i.confirmed = v.count as number;
        i.status = v.status as Invitation["status"];
      }
      log(s, i.id, actor, String(data.action), {
        ...v,
        previous_admitted: previous,
      });
      return i;
    }
    throw new DomainError("Action inconnue.");
  });
}
