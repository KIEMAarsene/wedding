"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LayoutDashboard, ScanLine, LogOut } from "lucide-react";
import { api } from "@/lib/api";
export function Shell({
  children,
  role,
  demo,
}: {
  children: React.ReactNode;
  role: "admin" | "accueil";
  demo: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="monogram">
            A<span>&</span>G
          </span>
          <span>
            ARSÈNE & GENEVIEVE<small>LE 17 OCTOBRE 2026</small>
          </span>
        </Link>
        <p className="nav-label">ESPACE ORGANISATION</p>
        <nav>
          {role === "admin" && (
            <Link
              className={pathname === "/admin" ? "selected" : ""}
              href="/admin"
            >
              <LayoutDashboard size={19} />
              Invitations & suivi
            </Link>
          )}
          <Link
            className={pathname === "/accueil" ? "selected" : ""}
            href="/accueil"
          >
            <ScanLine size={19} />
            Contrôle d’accès
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <Heart size={20} />
          <p>
            Un jour précieux.
            <br />
            Chaque présence compte.
          </p>
          <small>Ouagadougou, Burkina Faso</small>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            <i className="status-dot" />
            {demo ? "Démonstration locale" : "Espace sécurisé"} ·{" "}
            {role === "admin" ? "Administrateur" : "Accueil"}
          </span>
          <button
            className="button-text"
            onClick={async () => {
              await api("logout", {}, true);
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </header>
        {demo && (
          <div className="demo-banner">
            Données fictives · Mode démo local · Ne pas utiliser pour les
            admissions réelles.
          </div>
        )}
        <main className="content">{children}</main>
        <footer className="workspace-footer">
          ARSÈNE & GENEVIEVE <span>17.10.2026 · Avec vous, pour la vie.</span>
        </footer>
      </div>
    </div>
  );
}
