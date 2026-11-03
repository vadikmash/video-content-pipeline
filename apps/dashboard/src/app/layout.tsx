import { listProjects } from "@vcp/db";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
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

async function waitingCount(): Promise<number | undefined> {
  await connection();
  try {
    return (await listProjects()).filter((p) => p.status === "waiting").length;
  } catch {
    return undefined;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const inngestUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  const waiting = await waitingCount();
  return (
    <html lang="en" data-theme="dark" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <TopBar
          homeHref="/ideas"
          items={[
            { key: "ideas", label: "Ideas", href: "/ideas" },
            { key: "projects", label: "Projects", href: "/projects", attention: waiting },
          ]}
          right={
            <Button variant="ghost" size="sm" iconRight="external" href={inngestUrl} target="_blank">
              Inngest dev UI
            </Button>
          }
        />
        <main className="vcp-page">{children}</main>
      </body>
    </html>
  );
}
