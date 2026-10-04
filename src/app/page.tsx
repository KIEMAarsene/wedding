import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { demoEnabled, DEMO_TOKEN } from "@/lib/demo";
export default function Home() {
  return (
    <main className="landing">
      <div className="ornament">✦</div>
      <p className="eyebrow">NOUS NOUS DISONS OUI</p>
      <h1>
        Arsène <em>&</em>
        <br />
        Geneviève
      </h1>
      <div className="gold-rule" />
      <p className="wedding-date">17 OCTOBRE 2026</p>
      <p>
        Ouagadougou
        <br />
        <span className="muted">Espace Dieudonné · Salle Princesse</span>
      </p>
      <Heart className="heart" size={24} />
      <p className="landing-note">
        Une journée pour célébrer l’amour,
        <br />
        entourés de ceux qui nous sont chers.
      </p>
      {demoEnabled() && (
        <Link className="button" href={`/i/${DEMO_TOKEN}`}>
          Voir l’invitation de démonstration <ArrowRight size={16} />
        </Link>
      )}
      <Link className="staff-link" href="/login">
        Accès à l’équipe d’organisation →
      </Link>
      <small>
        Pour consulter votre invitation, ouvrez le lien personnel reçu des
        mariés.
      </small>
    </main>
  );
}
