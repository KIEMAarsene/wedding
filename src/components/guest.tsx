"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Heart, Check, MapPin, Download } from "lucide-react";
import { api } from "@/lib/api";
import { WEDDING, type GuestInvitation } from "@/lib/domain";
export function Guest({ token }: { token: string }) {
  const [i, setI] = useState<GuestInvitation>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(1);
  const [edit, setEdit] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    api<GuestInvitation>("guest", { token })
      .then((i) => {
        setI(i);
        setCount(i.confirmed || 1);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    if (i?.pass_token && canvas.current)
      QRCode.toCanvas(canvas.current, i.pass_token, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#172c43", light: "#ffffff" },
      }).catch(() =>
        setError("Impossible de générer le QR. Rechargez la page."),
      );
  }, [i, edit]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locked =
    !!i && (i.admitted > 0 || now >= new Date(WEDDING.deadline).getTime());
  async function reply(status: "confirmed" | "declined") {
    setBusy(true);
    setError("");
    try {
      const next = await api<GuestInvitation>(
        "rsvp",
        { token, status, count: status === "declined" ? 0 : count },
        true,
      );
      setI(next);
      setEdit(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="guest-page">
      <div className="guest-top">
        A <span>&</span> G
      </div>
      <section className="invitation-card">
        <div className="ornament">✦</div>
        <p className="eyebrow">UNE JOURNÉE, UNE VIE, NOTRE HISTOIRE</p>
        <h1>
          Arsène <em>&</em>
          <br />
          Geneviève
        </h1>
        <div className="gold-rule" />
        <p className="wedding-date">SAMEDI 17 OCTOBRE 2026</p>
        <p className="venue">
          <MapPin size={16} />
          Ouagadougou
        </p>
        <p className="muted">Espace Dieudonné · Salle Princesse</p>
        <section
          className="wedding-programme"
          aria-labelledby="programme-title"
        >
          <h2 id="programme-title">Le programme de notre journée</h2>
          <ol>
            {WEDDING.programme.map((event) => (
              <li key={event.time}>
                <time
                  dateTime={`2026-10-17T${event.time.replace("h", ":")}:00Z`}
                >
                  {event.time}
                </time>
                <div>
                  <strong>{event.title}</strong>
                  <span>{event.venue}</span>
                </div>
              </li>
            ))}
          </ol>
          <p>Horaires à Ouagadougou.</p>
        </section>
        <div className="guest-greeting">
          <p className="eyebrow">
            NOUS SERIONS HEUREUX DE VOUS AVOIR À NOS CÔTÉS
          </p>
          <h2>{i?.name || "Votre invitation"}</h2>
          {i && (
            <p>
              Cette invitation est valable pour{" "}
              <strong>
                {i.quota} personne{i.quota > 1 ? "s" : ""}
              </strong>
              .
            </p>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {!i && !error && <p role="status">Chargement de votre invitation…</p>}
        {i && !i.active ? (
          <div className="notice error">
            Cette invitation a été annulée.
            <br />
            Contactez les mariés pour en savoir plus.
          </div>
        ) : (
          i && (
            <>
              {i.status === "confirmed" && !edit ? (
                <>
                  <div className="pass">
                    <p className="badge confirmed">
                      <Check size={15} /> Présence confirmée : {i.confirmed}{" "}
                      personne{i.confirmed > 1 ? "s" : ""}
                    </p>
                    <h3>Votre laissez-passer</h3>
                    <p className="pass-purpose">Accès à la réception · 14h30</p>
                    <p>Invitation : {i.code}</p>
                    <canvas
                      ref={canvas}
                      aria-label="QR code du laissez-passer"
                    />
                    <p className="pass-help">
                      Présentez ce QR à l’accueil de la réception.
                      <br />
                      Les personnes d’une même invitation peuvent arriver
                      séparément. Le même laissez-passer reste utilisable
                      jusqu’à ce que les {i.confirmed} personne
                      {i.confirmed > 1 ? "s" : ""} confirmée
                      {i.confirmed > 1 ? "s" : ""} aient été admise
                      {i.confirmed > 1 ? "s" : ""}.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (!canvas.current) return;
                        const a = document.createElement("a");
                        a.href = canvas.current.toDataURL("image/png");
                        a.download = `pass-${i.code}.png`;
                        a.click();
                      }}
                    >
                      <Download size={16} />
                      Enregistrer le QR
                    </button>
                    <button
                      className="button-text"
                      onClick={() => window.print()}
                    >
                      Imprimer le laissez-passer
                    </button>
                    {i.admitted > 0 && (
                      <p>
                        {i.admitted}/{i.confirmed} personnes déjà entrées
                      </p>
                    )}
                  </div>
                  {!locked && (
                    <button
                      className="button-text"
                      onClick={() => setEdit(true)}
                    >
                      Modifier ma réponse
                    </button>
                  )}
                </>
              ) : i.status === "declined" && !edit ? (
                <>
                  <div className="notice">
                    Votre réponse a été enregistrée.
                    <br />
                    Vous serez dans nos pensées.
                  </div>
                  {!locked && (
                    <button
                      className="button secondary"
                      onClick={() => setEdit(true)}
                    >
                      Modifier ma réponse
                    </button>
                  )}
                </>
              ) : (
                <div className="rsvp">
                  <h3>Serez-vous des nôtres ?</h3>
                  {locked ? (
                    <p className="notice">
                      Les réponses sont closes. Contactez les mariés.
                    </p>
                  ) : (
                    <>
                      <label>
                        Combien de personnes seront présentes ?
                        <select
                          aria-label="Nombre de personnes présentes"
                          value={count}
                          onChange={(e) => setCount(Number(e.target.value))}
                        >
                          {Array.from({ length: i.quota }, (_, n) => (
                            <option key={n} value={n + 1}>
                              {n + 1} personne{n > 0 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button full"
                        disabled={busy}
                        onClick={() => reply("confirmed")}
                      >
                        <Heart size={16} />
                        {busy ? "Enregistrement…" : "Oui, nous serons présents"}
                      </button>
                      <button
                        className="button secondary full"
                        disabled={busy}
                        onClick={() => reply("declined")}
                      >
                        Nous ne pourrons pas être présents
                      </button>
                      {edit && (
                        <button
                          className="button-text"
                          onClick={() => setEdit(false)}
                        >
                          Conserver ma réponse actuelle
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              <p className="response-rule">
                Réponse modifiable jusqu’au 16 octobre à 18 h (Ouagadougou),
                <br />
                avant toute entrée à la réception.
              </p>
            </>
          )
        )}
        <Heart size={20} className="heart" />
        <p className="signature">
          Avec toute notre affection,
          <br />
          Arsène & Geneviève
        </p>
      </section>
      <p className="guest-bottom">
        Ce lien est personnel. Conservez-le pour retrouver votre invitation.
      </p>
    </main>
  );
}
