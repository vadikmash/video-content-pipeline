import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "video-content-pipeline",
  description: "Ideas, projects and gates for the short-video pipeline",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const inngestUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  return (
    <html lang="en">
      <body>
        <nav className="top">
          <span className="brand">vcp</span>
          <Link href="/ideas">Ideas</Link>
          <Link href="/projects">Projects</Link>
          <span style={{ flex: 1 }} />
          <a href={inngestUrl} target="_blank" rel="noreferrer" className="small muted">
            Inngest dev UI
          </a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
