/** True when `zone` is an IANA time zone this runtime knows. */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a wall-clock time ("2026-12-01T18:30", as a datetime-local input sends it) in
 * `zone` to a UTC ISO instant. A wall time skipped by a DST jump resolves forward by the
 * jump; an ambiguous one (clocks going back) resolves to the earlier instant.
 */
export function zonedTimeToInstant(local: string, zone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) throw new Error(`invalid local date-time "${local}"`);
  if (!isTimeZone(zone)) throw new Error(`unknown time zone "${zone}"`);
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0)) as [number, number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  // A zone has at most two offsets around any wall time: the ones in force well before and well after it.
  const before = offsetMs(wall - 86_400_000, zone);
  const after = offsetMs(wall + 86_400_000, zone);
  const matches = [wall - before, wall - after].filter((t) => t + offsetMs(t, zone) === wall);
  // No match means the wall time fell in a DST gap: the pre-jump offset moves it forward.
  const instant = matches.length ? Math.min(...matches) : wall - before;
  return new Date(instant).toISOString();
}

/** Wall-clock rendering of an instant in `zone`, e.g. "2026-12-01 18:30". */
export function formatInZone(iso: string, zone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Offset of `zone` from UTC at `instant`, in ms (positive east of Greenwich). */
function offsetMs(instant: number, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  return asUtc - Math.floor(instant / 1000) * 1000;
}
