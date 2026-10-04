import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { LoginForm } from "../src/components/login-form";
import { Shell } from "../src/components/shell";
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
describe("Aucune interface de démonstration en production", () => {
  it("connexion réelle sans sélection de rôle ni mention de démo", () => {
    const html = renderToStaticMarkup(<LoginForm demo={false} />);
    expect(html).not.toMatch(/démonstration|démo|<select/i);
    expect(html).toContain("Adresse e-mail");
    expect(html).toContain("Mot de passe");
  });
  it.each(["admin", "accueil"] as const)(
    "navigation %s sans bannière ou texte de démo",
    (role) => {
      const html = renderToStaticMarkup(
        <Shell role={role} demo={false}>
          <p>Contenu équipe</p>
        </Shell>,
      );
      expect(html).not.toMatch(/démonstration|démo|fictives/i);
      expect(html).toContain("Espace sécurisé");
      if (role === "accueil")
        expect(html).not.toContain("Invitations &amp; suivi");
    },
  );
  it("la sélection de rôle reste disponible exclusivement dans la démo", () => {
    expect(renderToStaticMarkup(<LoginForm demo={true} />)).toContain(
      "Rôle en démonstration",
    );
  });
});
