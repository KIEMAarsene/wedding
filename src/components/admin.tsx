"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Download,
  Upload,
  Users,
  Check,
  Send,
  Clock,
  ArrowUpRight,
  Copy,
  MessageCircle,
  Pencil,
  X,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  categories,
  stats,
  WEDDING,
  type Invitation,
  type Audit,
  invitationInput,
} from "@/lib/domain";
import { parseImport, csvDownload } from "@/lib/csv";
const statusLabels = {
  pending: "Sans réponse",
  confirmed: "Confirmée",
  declined: "Déclinée",
};
type Row = ReturnType<typeof invitationInput.parse>;
export function Admin() {
  const [list, setList] = useState<Invitation[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState("invitations");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Invitation | null | undefined>();
  const [selected, setSelected] = useState<Invitation>();
  const [imports, setImports] = useState<Row[]>();
  const inputFile = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const [rows, logs] = await Promise.all([
        api<Invitation[]>("list"),
        api<Audit[]>("audit"),
      ]);
      setList(rows);
      setAudit(logs);
      setSelected((old) =>
        old ? rows.find((i) => i.id === old.id) : undefined,
      );
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);
  const s = stats(list);
  const visible = list.filter(
    (i) =>
      [i.name, i.code, i.phone].some((v) =>
        v.toLowerCase().includes(query.toLowerCase()),
      ) &&
      (category === "all" || i.category === category) &&
      (filter === "all" ||
        (filter === "cancelled" && !i.active) ||
        (filter === "sent" && i.active && !!i.sent_at) ||
        (filter === i.status && i.active)),
  );
  async function mutate(
    command: string,
    data: Record<string, unknown>,
    message: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(command, data, true);
      setNotice(message);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function action(
    i: Invitation,
    action: string,
    value: Record<string, unknown> = {},
  ) {
    await mutate(
      "action",
      { id: i.id, action, value },
      "Modification enregistrée.",
    );
  }
  function link(i: Invitation) {
    return `${window.location.origin}/i/${i.invite_token}`;
  }
  function exportList() {
    csvDownload(
      "invitations-mariage.csv",
      list.map((i) => ({
        Code: i.code,
        Nom: i.name,
        Téléphone: i.phone,
        Catégorie: i.category,
        "Nombre de places": i.quota,
        Confirmées: i.confirmed,
        Entrées: i.admitted,
        Statut: statusLabels[i.status],
        Active: i.active ? "Oui" : "Non",
        Envoyée: i.sent_at ? "Oui" : "Non",
        Commentaire: i.comment,
      })),
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LE GRAND JOUR SE PRÉPARE</p>
          <h1>Chaque invité compte.</h1>
          <p className="muted">
            Vos invitations, les réponses et l’accueil, au même endroit.
          </p>
        </div>
        <button className="button" onClick={() => setEditing(null)}>
          <Plus size={18} />
          Nouvelle invitation
        </button>
      </div>
      <div className="event-strip">
        <div>
          <span className="small-caps">NOTRE MARIAGE</span>
          <strong>Arsène & Geneviève</strong>
        </div>
        <div>
          <span className="small-caps">17 OCTOBRE 2026</span>
          <span>Espace Dieudonné · Salle Princesse</span>
        </div>
        <span className="event-city">
          Ouagadougou <ArrowUpRight size={17} />
        </span>
      </div>
      {loadError && (
        <p className="notice error" role="alert">
          {loadError} Les données affichées peuvent être anciennes.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      <div className="stats-grid">
        <Stat
          title="Invitations créées"
          number={s.created}
          sub={`${s.sent} envoyées`}
          icon={<Send size={20} />}
        />
        <Stat
          title="Invitations confirmées"
          number={s.confirmed}
          sub={`${s.declined} déclinées · ${s.pending} sans réponse`}
          icon={<Check size={20} />}
        />
        <Stat
          title="Personnes confirmées"
          number={s.people}
          sub={`${s.allocated} places attribuées`}
          icon={<Users size={20} />}
        />
        <Stat
          title="Personnes accueillies"
          number={s.present}
          sub={`${s.remaining} personnes attendues`}
          icon={<Clock size={20} />}
          accent
        />
      </div>
      <div className="capacity">
        <span>
          Capacité de la réception <strong>{WEDDING.capacity} personnes</strong>
        </span>
        <div className="progress">
          <i style={{ width: `${Math.min(100, s.allocated / 3)}%` }} />
        </div>
        <span className={s.allocated > 300 ? "over-capacity" : ""}>
          {s.allocated > 300 ? "Capacité dépassée · " : ""}
          {s.allocated} / 300 places attribuées
        </span>
      </div>
      <section className="panel directory">
        <div className="section-tabs">
          <button
            className={tab === "invitations" ? "current" : ""}
            onClick={() => setTab("invitations")}
          >
            Liste des invitations <span>{list.length}</span>
          </button>
          <button
            className={tab === "categories" ? "current" : ""}
            onClick={() => setTab("categories")}
          >
            Par catégorie
          </button>
          <button
            className={tab === "audit" ? "current" : ""}
            onClick={() => setTab("audit")}
          >
            Journal
          </button>
          <button
            className="button-text refresh"
            title="Actualiser"
            aria-label="Actualiser"
            onClick={load}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {tab === "invitations" ? (
          <>
            <div className="list-toolbar">
              <div className="search-box">
                <Search size={18} />
                <input
                  placeholder="Rechercher un nom, un code, un téléphone…"
                  aria-label="Rechercher une invitation"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="toolbar-actions">
                <button
                  className="button secondary compact"
                  onClick={() => inputFile.current?.click()}
                >
                  <Upload size={15} />
                  Importer CSV
                </button>
                <button
                  className="button secondary compact"
                  onClick={exportList}
                >
                  <Download size={15} />
                  Exporter
                </button>
                <input
                  ref={inputFile}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.size > 1_000_000)
                        throw new Error("Le fichier dépasse 1 Mo.");
                      setImports(parseImport(await file.text()));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="filters">
              <div className="filter-pills">
                {[
                  ["all", "Toutes"],
                  ["confirmed", "Confirmées"],
                  ["pending", "Sans réponse"],
                  ["declined", "Déclinées"],
                  ["cancelled", "Annulées"],
                  ["sent", "Envoyées"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    className={filter === v ? "active" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filtrer par catégorie"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Toutes les catégories</option>
                {Array.from(
                  new Set([...categories, ...list.map((i) => i.category)]),
                ).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>INVITÉ / INVITATION</th>
                    <th>CATÉGORIE</th>
                    <th>PLACES</th>
                    <th>RÉPONSE</th>
                    <th>ENTRÉES</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <button
                          className="guest-name"
                          onClick={() => setSelected(i)}
                        >
                          <span className="avatar">{i.name.charAt(0)}</span>
                          <span>
                            <strong>{i.name}</strong>
                            <small>
                              {i.code}
                              {i.sent_at ? " · Envoyée" : ""}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="category-label">{i.category}</span>
                      </td>
                      <td>
                        <strong>{i.quota}</strong>
                        <small>
                          {i.confirmed} confirmé{i.confirmed > 1 ? "s" : ""}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge ${!i.active ? "cancelled" : i.status}`}
                        >
                          {!i.active ? "Annulée" : statusLabels[i.status]}
                        </span>
                      </td>
                      <td>
                        <span>
                          {i.admitted}{" "}
                          <span className="muted">/ {i.confirmed}</span>
                        </span>
                        <div className="entry-progress">
                          <i
                            style={{
                              width: `${i.confirmed ? (i.admitted / i.confirmed) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          title={`Gérer ${i.name}`}
                          aria-label={`Gérer ${i.name}`}
                          onClick={() => setSelected(i)}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <p className="empty">
                  {loading
                    ? "Chargement…"
                    : "Aucune invitation dans cette sélection."}
                </p>
              )}
            </div>
            <div className="list-footer">
              <span>
                {visible.length} invitation{visible.length > 1 ? "s" : ""}{" "}
                affichée{visible.length > 1 ? "s" : ""}
              </span>
              <span>
                <i className="status-dot" />
                Actualisation toutes les 15 s
              </span>
            </div>
          </>
        ) : tab === "categories" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Invitations actives</th>
                  <th>Places</th>
                  <th>Confirmées (personnes)</th>
                  <th>Présentes</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(list.map((i) => i.category))).map((c) => {
                  const group = list.filter((i) => i.category === c);
                  const v = stats(group);
                  return (
                    <tr key={c}>
                      <td>{c}</td>
                      <td>{group.filter((i) => i.active).length}</td>
                      <td>{v.allocated}</td>
                      <td>{v.people}</td>
                      <td>{v.present}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="audit-list">
            <p className="muted">
              200 dernières opérations. Les corrections préservent les
              admissions initiales.
            </p>
            <button
              className="button secondary compact"
              onClick={() =>
                csvDownload(
                  "journal-mariage.csv",
                  audit.map((a) => ({
                    Date: a.created_at,
                    Action: a.action,
                    Invitation:
                      list.find((i) => i.id === a.invitation_id)?.code || "",
                    Agent: a.actor_id || "Invité",
                    Détails: JSON.stringify(a.details),
                  })),
                )
              }
            >
              Exporter ce journal
            </button>
            {audit.map((a) => (
              <div key={a.id}>
                <strong>
                  {a.action} ·{" "}
                  {list.find((i) => i.id === a.invitation_id)?.code}
                </strong>
                <small>
                  {new Date(a.created_at).toLocaleString("fr-FR", {
                    timeZone: "Africa/Ouagadougou",
                  })}{" "}
                  · {a.actor_id || "Invité"}
                </small>
                <p>{JSON.stringify(a.details)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="privacy-note">
        Les liens d’invitation sont personnels. Partagez-les uniquement avec
        leurs destinataires.
      </p>
      {editing !== undefined && (
        <Modal
          title={editing ? "Modifier l’invitation" : "Une nouvelle invitation"}
          close={() => setEditing(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const row = {
                ...Object.fromEntries(f),
                quota: Number(f.get("quota")),
              };
              if (
                await mutate(
                  "save",
                  { row, id: editing?.id },
                  "Invitation enregistrée.",
                )
              )
                setEditing(undefined);
            }}
          >
            <label>
              Nom de la personne / famille
              <input
                name="name"
                defaultValue={editing?.name}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <div className="form-grid">
              <label>
                Téléphone
                <input
                  name="phone"
                  defaultValue={editing?.phone}
                  type="tel"
                  placeholder="+226…"
                  maxLength={30}
                />
              </label>
              <label>
                Places autorisées
                <input
                  name="quota"
                  type="number"
                  min={Math.max(1, editing?.confirmed || 0)}
                  max={300}
                  defaultValue={editing?.quota || 1}
                  required
                />
              </label>
            </div>
            <CategoryField
              key={editing?.id || "new"}
              initial={editing?.category || "Amis"}
            />
            <label>
              Commentaire interne
              <textarea
                name="comment"
                maxLength={1000}
                defaultValue={editing?.comment}
              />
            </label>
            <button className="button full" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer l’invitation"}
            </button>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} close={() => setSelected(undefined)}>
          <p className="muted">
            {selected.code} · {selected.quota} places · {selected.confirmed}{" "}
            confirmées · {selected.admitted} entrées
          </p>
          <div className="detail-actions">
            <button
              className="button secondary"
              onClick={() => {
                setEditing(selected);
                setSelected(undefined);
              }}
            >
              <Pencil size={16} />
              Modifier les informations
            </button>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link(selected));
                  setNotice("Lien copié.");
                } catch {
                  setError(
                    "Copie indisponible. Sélectionnez le lien ci-dessous.",
                  );
                }
              }}
            >
              <Copy size={16} />
              Copier le lien personnel
            </button>
            <input
              readOnly
              aria-label="Lien personnel"
              value={typeof window !== "undefined" ? link(selected) : ""}
            />
            <a
              className="button"
              href={`https://wa.me/${selected.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${selected.name}, nous sommes heureux de vous inviter à notre mariage le 17 octobre 2026 à Ouagadougou. Voici votre invitation personnelle : ${link(selected)} — Arsène & Geneviève`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} />
              Préparer le message WhatsApp
            </a>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => action(selected, "sent")}
            >
              Marquer comme envoyée
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                action(selected, "active", { active: !selected.active })
              }
            >
              {selected.active
                ? "Annuler cette invitation"
                : "Réactiver cette invitation"}
            </button>
            <details>
              <summary>Corriger une réponse ou une entrée</summary>
              <p className="muted">
                Réservé à l’administrateur. Chaque intervention est journalisée.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await action(selected, "rsvp", {
                    status: f.get("status"),
                    count: Number(f.get("count")),
                    reason: f.get("reason"),
                  });
                }}
              >
                <label>
                  Réponse
                  <select name="status" defaultValue={selected.status}>
                    <option value="pending">Sans réponse</option>
                    <option value="confirmed">Confirmée</option>
                    <option value="declined">Déclinée</option>
                  </select>
                </label>
                <label>
                  Personnes confirmées
                  <input
                    name="count"
                    type="number"
                    defaultValue={selected.confirmed}
                    min={selected.admitted}
                    max={selected.quota}
                    required
                  />
                </label>
                <label>
                  Motif
                  <input name="reason" required minLength={5} maxLength={500} />
                </label>
                <button className="button secondary" disabled={busy}>
                  Corriger la réponse
                </button>
              </form>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await action(selected, "correct", {
                    count: Number(f.get("count")),
                    reason: f.get("reason"),
                  });
                }}
              >
                <label>
                  Nombre réel de personnes déjà entrées
                  <input
                    name="count"
                    type="number"
                    min={0}
                    max={selected.confirmed}
                    defaultValue={selected.admitted}
                    required
                  />
                </label>
                <label>
                  Motif de correction
                  <input name="reason" required minLength={5} maxLength={500} />
                </label>
                <button className="button secondary" disabled={busy}>
                  Corriger les entrées
                </button>
              </form>
            </details>
            <details>
              <summary>Remplacer les liens et le QR</summary>
              <p>
                Les anciens liens et QR ne fonctionneront plus. Envoyez le
                nouveau lien à l’invité.
              </p>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => action(selected, "rotate")}
              >
                Invalider les anciens liens et QR
              </button>
            </details>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {imports && (
        <Modal
          title="Vérifier l’import CSV"
          close={() => setImports(undefined)}
        >
          <p>
            {imports.length} nouvelles invitations ·{" "}
            {imports.reduce((n, r) => n + r.quota, 0)} places.
          </p>
          <p className="muted">
            L’import ajoute des invitations ; il ne fusionne pas les doublons.
            Vérifiez la liste avant de valider.
          </p>
          <div className="import-preview">
            {imports.map((r, n) => (
              <p key={n}>
                <strong>{r.name}</strong> · {r.quota} places · {r.category}
              </p>
            ))}
          </div>
          <button
            className="button full"
            disabled={busy}
            onClick={async () => {
              if (await mutate("import", { rows: imports }, "Import terminé."))
                setImports(undefined);
            }}
          >
            {busy ? "Import…" : "Importer ces invitations"}
          </button>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function CategoryField({ initial }: { initial: string }) {
  const [choice, setChoice] = useState(initial);
  const [custom, setCustom] = useState("");
  const options = Array.from(new Set([...categories, initial]));
  const isCustom = choice === "__custom__";
  return (
    <>
      <label>
        Catégorie
        <select
          name={isCustom ? undefined : "category"}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          required
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__custom__">Autre catégorie…</option>
        </select>
      </label>
      {isCustom && (
        <label>
          Nom de la catégorie
          <input
            name="category"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            required
            maxLength={80}
          />
        </label>
      )}
    </>
  );
}
function Stat({
  title,
  number,
  sub,
  icon,
  accent = false,
}: {
  title: string;
  number: number;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{number}</strong>
      <small>{sub}</small>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="modal" onCancel={close}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
