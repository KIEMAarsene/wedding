"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScanLine,
  Search,
  Minus,
  Plus,
  CheckCircle2,
  AlertTriangle,
  CameraOff,
  RefreshCw,
} from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { api, ApiError } from "@/lib/api";
import { admissionInput, type Invitation } from "@/lib/domain";
const PENDING_KEY = "wedding-pending-admission";
function clearPendingStorage() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* Les restrictions du navigateur ne doivent pas annuler une admission réussie. */
  }
}
export function Reception() {
  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Invitation[]>([]);
  const [selected, setSelected] = useState<Invitation>();
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [qr, setQr] = useState("");
  const [online, setOnline] = useState(true);
  const [retry, setRetry] = useState<{
    id: string;
    count: number;
    requestId: string;
  }>();
  const video = useRef<HTMLVideoElement>(null);
  const admissionPanel = useRef<HTMLElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const cameraGeneration = useRef(0);
  const paused = useRef(false);
  const busyRef = useRef(false);
  const search = useCallback(async (q: string) => {
    try {
      setRows(await api<Invitation[]>("search", { query: q }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pending = admissionInput.parse(JSON.parse(raw));
      api<Invitation[]>("search")
        .then((matches) => {
          const i = matches.find((i) => i.id === pending.id);
          if (i) {
            setSelected(i);
            setCount(pending.count);
            setRetry(pending);
            setMessage(
              "Une admission attend une vérification. Réessayez cette opération pour connaître son résultat.",
            );
          }
        })
        .catch((e) => setError((e as Error).message));
    } catch {
      clearPendingStorage();
    }
  }, []);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    handler();
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    const invalidateCamera = () => {
      cameraGeneration.current++;
    };
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
      invalidateCamera();
      controls.current?.stop();
    };
  }, []);
  function pick(i: Invitation) {
    setSelected(i);
    setCount(Math.max(1, Math.min(i.confirmed - i.admitted, 1)));
    setMessage("");
    setError("");
    setRetry(undefined);
    requestAnimationFrame(() =>
      admissionPanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }
  async function scan(text: string) {
    if (paused.current || retry || busyRef.current) return;
    paused.current = true;
    controls.current?.stop();
    setCamera(false);
    setError("");
    setSelected(undefined);
    setVerifying(true);
    try {
      const token = text.trim();
      if (!/^[a-f0-9]{64}$/.test(token))
        throw new Error(
          "Ce QR n’est pas un laissez-passer du mariage. Utilisez le pass reçu après confirmation.",
        );
      pick(await api<Invitation>("scan", { token }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      paused.current = false;
      setVerifying(false);
    }
  }
  async function startCamera() {
    if (retry || busy || verifying) return;
    setError("");
    setSelected(undefined);
    setCamera(true);
    paused.current = false;
    const generation = ++cameraGeneration.current;
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
          audio: false,
        },
        video.current!,
        (result, _error, scannerControls) => {
          if (generation !== cameraGeneration.current) {
            scannerControls.stop();
            return;
          }
          if (result) {
            scannerControls.stop();
            void scan(result.getText());
          }
        },
      );
      if (generation !== cameraGeneration.current) scanner.stop();
      else controls.current = scanner;
    } catch {
      setCamera(false);
      setError(
        "Caméra indisponible. Autorisez la caméra dans le navigateur, utilisez HTTPS ou recherchez le nom/code.",
      );
    }
  }
  const refresh = useCallback(async () => {
    if (!selected) return;
    try {
      const matches = await api<Invitation[]>("search", {
        query: selected.code,
      });
      const next = matches.find((i) => i.id === selected.id);
      if (next) {
        setSelected(next);
        setCount((n) =>
          Math.max(1, Math.min(n, next.confirmed - next.admitted)),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    const timer = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [selected, refresh]);
  async function admit() {
    if (!selected || busyRef.current || !navigator.onLine) return;
    const request = retry || {
      id: selected.id,
      count,
      requestId: crypto.randomUUID(),
    };
    setRetry(request);
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(request));
    } catch {
      /* L'identifiant reste conservé en mémoire. */
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await api<Invitation>("admit", request, true);
      setSelected(next);
      setCount(Math.max(1, Math.min(count, next.confirmed - next.admitted)));
      setMessage(
        `${request.count} personne${request.count > 1 ? "s" : ""} enregistrée${request.count > 1 ? "s" : ""} · ${next.admitted}/${next.confirmed} entrées.`,
      );
      setRetry(undefined);
      clearPendingStorage();
      await search(query);
    } catch (e) {
      const rejected =
        e instanceof ApiError && [400, 404, 409, 422].includes(e.status);
      if (rejected) {
        setRetry(undefined);
        clearPendingStorage();
      }
      setError(
        `${(e as Error).message}${rejected ? "" : " Réessayez la même opération pour vérifier son résultat ; elle ne sera pas comptée deux fois."}`,
      );
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const valid = selected?.active && selected.status === "confirmed";
  const remaining = selected ? selected.confirmed - selected.admitted : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BIENVENUE À LA RÉCEPTION</p>
          <h1>Accueillir, simplement.</h1>
          <p className="muted">
            Un QR par invitation. Chaque entrée compte, même en plusieurs fois.
          </p>
        </div>
        <span className={`connection ${online ? "" : "error"}`}>
          <i className="status-dot" />
          {online ? "Connexion disponible" : "Hors connexion"}
        </span>
      </div>
      <div className="reception-layout">
        <section className="panel reception-tools">
          <div className="section-tabs">
            <button
              className={mode === "scan" ? "current" : ""}
              onClick={() => setMode("scan")}
            >
              <ScanLine size={18} />
              Scanner le QR
            </button>
            <button
              className={mode === "search" ? "current" : ""}
              onClick={() => {
                cameraGeneration.current++;
                controls.current?.stop();
                setCamera(false);
                setMode("search");
              }}
            >
              <Search size={18} />
              Recherche manuelle
            </button>
          </div>
          {mode === "scan" ? (
            <div className="scanner">
              <div className={`camera-view ${camera ? "live" : ""}`}>
                <video ref={video} autoPlay muted playsInline />
                {!camera && (
                  <>
                    <ScanLine size={65} />
                    <p>
                      Placez le QR du laissez-passer
                      <br />
                      devant la caméra.
                    </p>
                  </>
                )}
              </div>
              {camera ? (
                <button
                  className="button secondary full"
                  onClick={() => {
                    cameraGeneration.current++;
                    controls.current?.stop();
                    setCamera(false);
                  }}
                >
                  <CameraOff size={16} />
                  Arrêter la caméra
                </button>
              ) : (
                <button
                  className="button full"
                  disabled={!online || busy || !!retry || verifying}
                  onClick={startCamera}
                >
                  <ScanLine size={18} />
                  Ouvrir la caméra
                </button>
              )}
              <details>
                <summary>Saisir le token du QR</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void scan(qr);
                  }}
                >
                  <label>
                    Token sécurisé
                    <input
                      value={qr}
                      onChange={(e) => setQr(e.target.value)}
                      minLength={64}
                      maxLength={64}
                      required
                    />
                  </label>
                  <button
                    className="button secondary full"
                    disabled={!online || busy || !!retry || verifying}
                  >
                    Vérifier
                  </button>
                </form>
              </details>
            </div>
          ) : (
            <div className="manual-search">
              <div className="search-box">
                <Search size={18} />
                <input
                  placeholder="Nom, famille, code AG-0001, téléphone…"
                  value={query}
                  aria-label="Recherche à l’accueil"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <p className="muted">
                Téléphone déchargé ou QR oublié ? Retrouvez l’invitation et
                vérifiez le nom annoncé.
              </p>
              <div className="search-results">
                {rows.map((i) => (
                  <button
                    key={i.id}
                    className={selected?.id === i.id ? "picked" : ""}
                    disabled={!!retry || busy || verifying}
                    onClick={() => pick(i)}
                  >
                    <span>
                      <strong>{i.name}</strong>
                      <small>
                        {i.code} · {i.category}
                      </small>
                    </span>
                    <span
                      className={`badge ${!i.active ? "cancelled" : i.status}`}
                    >
                      {!i.active
                        ? "Annulée"
                        : i.status === "confirmed"
                          ? `${i.admitted}/${i.confirmed} entrées`
                          : i.status === "declined"
                            ? "Déclinée"
                            : "Sans réponse"}
                    </span>
                  </button>
                ))}
                {!rows.length && (
                  <p className="empty">Aucune invitation trouvée.</p>
                )}
              </div>
            </div>
          )}
        </section>
        <section
          ref={admissionPanel}
          className="panel admission-panel"
          aria-label="Vérification et admission"
        >
          {verifying && <p role="status">Vérification du laissez-passer…</p>}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice success" role="status">
              {message}
            </p>
          )}
          {selected ? (
            <>
              <div
                className={`admission-status ${valid && remaining > 0 ? "good" : "warning"}`}
              >
                {valid && remaining > 0 ? (
                  <CheckCircle2 size={30} />
                ) : (
                  <AlertTriangle size={30} />
                )}
                <strong>
                  {!selected.active
                    ? "INVITATION ANNULÉE"
                    : selected.status !== "confirmed"
                      ? "PRÉSENCE NON CONFIRMÉE"
                      : remaining <= 0
                        ? "INVITATION COMPLÈTE"
                        : "INVITATION VALIDE"}
                </strong>
              </div>
              <h2>{selected.name}</h2>
              <p className="muted">Invitation {selected.code}</p>
              <dl className="admission-numbers">
                <div>
                  <dt>Places autorisées</dt>
                  <dd>{selected.quota}</dd>
                </div>
                <div>
                  <dt>Personnes confirmées</dt>
                  <dd>{selected.confirmed}</dd>
                </div>
                <div>
                  <dt>Déjà entrées</dt>
                  <dd>{selected.admitted}</dd>
                </div>
                <div className="remaining">
                  <dt>Places restantes</dt>
                  <dd>{valid ? remaining : 0}</dd>
                </div>
              </dl>
              {valid && remaining > 0 ? (
                <>
                  <label className="counter-label">
                    Combien de personnes entrent maintenant ?
                  </label>
                  <div className="counter">
                    <button
                      aria-label="Diminuer le nombre"
                      disabled={count <= 1 || busy || !!retry}
                      onClick={() => setCount(count - 1)}
                    >
                      <Minus />
                    </button>
                    <strong>{count}</strong>
                    <button
                      aria-label="Augmenter le nombre"
                      disabled={count >= remaining || busy || !!retry}
                      onClick={() => setCount(count + 1)}
                    >
                      <Plus />
                    </button>
                  </div>
                </>
              ) : (
                <p className="notice">
                  {!selected.active
                    ? "Cette invitation ne permet aucune entrée."
                    : selected.status !== "confirmed"
                      ? "Demandez à un administrateur de vérifier la présence et le nombre de personnes."
                      : "Invitation déjà entièrement utilisée. Aucune place restante."}
                </p>
              )}
              {((valid && remaining > 0) || retry) && (
                <button
                  className="button full"
                  disabled={busy || !online}
                  onClick={admit}
                >
                  <CheckCircle2 size={18} />
                  {busy
                    ? "Vérification et enregistrement…"
                    : retry
                      ? "Vérifier / réessayer la même admission"
                      : "Enregistrer l’entrée"}
                </button>
              )}
              {!retry && (
                <button
                  className="button-text"
                  disabled={busy}
                  onClick={refresh}
                >
                  <RefreshCw size={15} />
                  Actualiser l’invitation
                </button>
              )}
              {retry && (
                <p className="muted">
                  Résolvez cette opération avant de passer à une autre
                  invitation. Le même identifiant est conservé pour éviter une
                  double entrée.
                </p>
              )}
              <small>
                La disponibilité est vérifiée à nouveau par le serveur à chaque
                admission.
              </small>
            </>
          ) : (
            <div className="admission-empty">
              <CheckCircle2 size={48} />
              <h2>Prêts à les accueillir.</h2>
              <p>
                Scannez un laissez-passer
                <br />
                ou sélectionnez une invitation.
              </p>
              <span>17 OCTOBRE 2026 · OUAGADOUGOU</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
