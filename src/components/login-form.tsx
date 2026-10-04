"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { api } from "@/lib/api";
export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-wrap">
      <Link href="/" className="login-brand">
        A <em>&</em> G
      </Link>
      <section className="panel login-panel">
        <LockKeyhole className="gold" size={30} />
        <p className="eyebrow">ÉQUIPE DU MARIAGE</p>
        <h1>Bienvenue.</h1>
        <p className="muted">
          Connectez-vous pour préparer les invitations
          <br />
          ou accueillir nos invités.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("login", Object.fromEntries(f), true);
              const { user } = await api<{ user: { role: string } }>("session");
              router.push(user.role === "admin" ? "/admin" : "/accueil");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Adresse e-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="vous@exemple.com"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {demo && (
            <label>
              Rôle en démonstration
              <select name="role">
                <option value="admin">Administrateur</option>
                <option value="accueil">Agent d’accueil</option>
              </select>
            </label>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </section>
      <p className="muted">Arsène & Geneviève · 17 octobre 2026</p>
    </main>
  );
}
