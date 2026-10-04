import { z } from "zod";
export class DomainError extends Error {}
export const WEDDING = {
  names: "Arsène & Geneviève",
  date: "17 octobre 2026",
  venue: "Espace Dieudonné · Salle Princesse",
  city: "Ouagadougou",
  capacity: 300,
  deadline: "2026-10-16T18:00:00Z",
  programme: [
    {
      time: "11h00",
      title: "Cérémonie religieuse",
      venue: "Église Saint Camille",
    },
    { time: "13h30", title: "Mariage civil", venue: "Mairie de Bogodogo" },
    {
      time: "14h30",
      title: "Réception",
      venue: "Espace Dieudonné – Salle Princesse",
    },
  ],
};
export const categories = [
  "Famille marié",
  "Famille mariée",
  "Collègues CILSS",
  "Collègues Ministère",
  "Promotionnaires",
  "Amis",
  "Connaissances",
  "Invités spéciaux",
];
export type Invitation = {
  id: string;
  code: string;
  name: string;
  phone: string;
  category: string;
  quota: number;
  confirmed: number;
  admitted: number;
  status: "pending" | "confirmed" | "declined";
  active: boolean;
  sent_at: string | null;
  comment: string;
  invite_token?: string;
  pass_token?: string;
  created_at: string;
};
export type GuestInvitation = Pick<
  Invitation,
  "code" | "name" | "quota" | "confirmed" | "admitted" | "status" | "active"
> & { pass_token?: string };
export type Audit = {
  id: string;
  invitation_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};
export const invitationInput = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/),
  category: z.string().trim().min(1).max(80),
  quota: z.number().int().min(1).max(300),
  comment: z.string().trim().max(1000).default(""),
});
export const rsvpInput = z.object({
  status: z.enum(["confirmed", "declined"]),
  count: z.number().int().min(0).max(300),
});
export const admissionInput = z.object({
  id: z.uuid(),
  count: z.number().int().min(1).max(300),
  requestId: z.uuid(),
});
export function assertRsvp(
  i: GuestInvitation,
  status: "confirmed" | "declined",
  count: number,
  now = new Date(),
) {
  if (!i.active)
    throw new DomainError(
      "Cette invitation a été annulée. Contactez les mariés.",
    );
  if (i.admitted > 0)
    throw new DomainError(
      "La réponse est verrouillée après une première entrée.",
    );
  if (now.getTime() >= new Date(WEDDING.deadline).getTime())
    throw new DomainError("Les réponses sont closes. Contactez les mariés.");
  if (
    !Number.isInteger(count) ||
    (status === "confirmed" && (count < 1 || count > i.quota)) ||
    (status === "declined" && count !== 0)
  )
    throw new DomainError(
      "Le nombre demandé dépasse les places autorisées ou est invalide.",
    );
}
export function assertAdmission(i: GuestInvitation, count: number) {
  if (!i.active)
    throw new DomainError("Invitation annulée. Aucune entrée autorisée.");
  if (i.status !== "confirmed")
    throw new DomainError(
      "Présence non confirmée. Demandez à un administrateur.",
    );
  if (i.admitted >= i.confirmed)
    throw new DomainError("Invitation déjà entièrement utilisée.");
  if (!Number.isInteger(count) || count < 1 || count > i.confirmed - i.admitted)
    throw new DomainError(
      "Places restantes insuffisantes. Actualisez cette invitation.",
    );
}
export function stats(list: Invitation[]) {
  const active = list.filter((i) => i.active);
  return {
    created: list.length,
    sent: active.filter((i) => i.sent_at).length,
    confirmed: active.filter((i) => i.status === "confirmed").length,
    declined: active.filter((i) => i.status === "declined").length,
    pending: active.filter((i) => i.status === "pending").length,
    allocated: active.reduce((s, i) => s + i.quota, 0),
    people: active.reduce((s, i) => s + i.confirmed, 0),
    present: list.reduce((s, i) => s + i.admitted, 0),
    remaining: active.reduce(
      (s, i) => s + Math.max(0, i.confirmed - i.admitted),
      0,
    ),
  };
}
