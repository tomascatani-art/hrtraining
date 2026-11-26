import { StaleReload } from "@/components/stale-reload";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Hrtraining — Rendimiento deportivo", template: "%s · Hrtraining" },
  description: "Rutinas, seguimiento y comunicación entre el preparador físico y sus alumnos.",
  applicationName: "Hrtraining",
  appleWebApp: { capable: true, title: "Hrtraining", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh"><StaleReload />{children}</body>
    </html>
  );
}
