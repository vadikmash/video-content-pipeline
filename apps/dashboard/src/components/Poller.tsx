"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server component tree every `ms` while mounted. */
export function Poller({ ms = 3000, enabled = true }: { ms?: number; enabled?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms, enabled]);
  return null;
}
