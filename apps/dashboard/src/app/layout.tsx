import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import "./tokens.css";
import "./vcp.css";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "video-content-pipeline",
  description: "Ideas, projects and gates for the short-video pipeline",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const inngestUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  return (
    <html lang="en" data-theme="dark" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <nav className="top">
          <span className="brand">vcp</span>
          <Link href="/ideas">Ideas</Link>
          <Link href="/projects">Projects</Link>
          <a href={inngestUrl} target="_blank" rel="noreferrer">
            Inngest dev UI
          </a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
