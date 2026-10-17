import { describe, it, expect } from "vitest";
import {
  assertRsvp,
  assertAdmission,
  invitationInput,
  rsvpInput,
  admissionInput,
  stats,
  type Invitation,
} from "../src/lib/domain";
import { parseImport } from "../src/lib/csv";
const now = new Date("2026-10-04T12:00:00Z");
const row = (quota = 5): Invitation => ({
  id: "12345678-1234-4234-8234-123456789abc",
  code: "AG-0047",
  name: "Famille OUEDRAOGO",
  phone: "",
  category: "Amis",
  quota,
  confirmed: 0,
  admitted: 0,
  status: "pending",
  active: true,
  sent_at: null,
  comment: "",
  created_at: now.toISOString(),
});
describe("Quotas et RSVP", () => {
  it("permet de modifier la réponse jusqu’à la nouvelle échéance", () => {
    expect(() =>
      assertRsvp(row(), "confirmed", 2, new Date("2026-10-17T19:59:59Z")),
    ).not.toThrow();
  });
  it.each([1, 2, 5])("accepte une invitation de %i place(s)", (q) =>
    expect(() => assertRsvp(row(q), "confirmed", q, now)).not.toThrow(),
  );
  it("accepte une réponse inférieure au quota", () =>
    expect(() => assertRsvp(row(5), "confirmed", 3, now)).not.toThrow());
  it.each([6, -1, 1.5, 0])("refuse la réponse manipulée %i", (n) =>
    expect(() => assertRsvp(row(), "confirmed", n, now)).toThrow(),
  );
  it("refuse un déclin avec des personnes", () =>
    expect(() => assertRsvp(row(), "declined", 1, now)).toThrow());
  it("bloque annulation, première entrée et échéance", () => {
    expect(() =>
      assertRsvp({ ...row(), active: false }, "confirmed", 1, now),
    ).toThrow("annulée");
    expect(() =>
      assertRsvp({ ...row(), admitted: 1 }, "confirmed", 1, now),
    ).toThrow("verrouillée");
    expect(() =>
      assertRsvp(row(), "confirmed", 1, new Date("2026-10-17T20:00:00Z")),
    ).toThrow("closes");
  });
});
describe("Admissions", () => {
  const confirmed = { ...row(), status: "confirmed" as const, confirmed: 3 };
  it("groupe complet ou partiel", () => {
    expect(() => assertAdmission(confirmed, 3)).not.toThrow();
    expect(() =>
      assertAdmission({ ...confirmed, admitted: 2 }, 1),
    ).not.toThrow();
  });
  it("empêche dépassement et explique complet", () => {
    expect(() => assertAdmission(confirmed, 4)).toThrow("insuffisantes");
    expect(() => assertAdmission({ ...confirmed, admitted: 3 }, 1)).toThrow(
      "entièrement",
    );
  });
  it("empêche absence de RSVP et annulation", () => {
    expect(() => assertAdmission(row(), 1)).toThrow("non confirmée");
    expect(() => assertAdmission({ ...confirmed, active: false }, 1)).toThrow(
      "annulée",
    );
  });
  it("les schémas filtrent les champs non autorisés", () => {
    expect(
      invitationInput.parse({
        ...row(),
        admitted: 999,
        invite_token: "pirate",
      }),
    ).not.toHaveProperty("admitted");
    expect(() =>
      rsvpInput.parse({ status: "confirmed", count: "4" }),
    ).toThrow();
    expect(() =>
      admissionInput.parse({ id: row().id, count: 1, requestId: "fake" }),
    ).toThrow();
  });
  it("distingue invitations et personnes, garde les présents annulés", () => {
    const s = stats([
      confirmed,
      { ...confirmed, id: "other", active: false, admitted: 1 },
    ]);
    expect(s.created).toBe(2);
    expect(s.confirmed).toBe(1);
    expect(s.people).toBe(3);
    expect(s.present).toBe(1);
  });
});
describe("Import CSV", () => {
  it("lit les accents, séparateur Excel et commentaires avec virgules", () => {
    expect(
      parseImport(
        'Nom;Téléphone;Catégorie;Nombre de places;Commentaire\nFamille ÉLI;+22670000000;Amis;5;"Bonjour, famille"',
      )[0],
    ).toMatchObject({
      name: "Famille ÉLI",
      quota: 5,
      comment: "Bonjour, famille",
    });
  });
  it("refuse le fichier entier si une ligne dépasse le quota", () =>
    expect(() =>
      parseImport("Nom,Nombre de places\nAwa TRAORÉ,1\nFamille Test,301"),
    ).toThrow("Ligne 3"));
});
