"use client";
import { useEffect, useState } from "react";
export function Connectivity() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return !online ? (
    <div className="offline" role="alert">
      Hors connexion · Admissions suspendues. Rétablissez le réseau avant de
      continuer.
    </div>
  ) : null;
}
