import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Connectivity } from "@/components/connectivity";
export const metadata: Metadata = {
  title: "Arsène & Geneviève · Notre mariage",
  description: "Invitations et accueil · 17 octobre 2026 · Ouagadougou",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#172c43",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Connectivity />
        {children}
      </body>
    </html>
  );
}
