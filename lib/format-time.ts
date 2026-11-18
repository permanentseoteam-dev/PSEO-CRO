// Times shown to people are 12-hour ("8:06 PM"). Stored, sent and compared values stay 24-hour "HH:MM".

/** "20:06" or "20:06:00" -> "8:06 PM". Anything that is not a clock time comes back unchanged. */
export function fmt12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]) % 24;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** Clock time of an instant as "8:06 PM" in `timeZone` (the runtime's zone when left out). */
export function time12(at: Date | string | number, timeZone?: string): string {
  // Some runtimes put a narrow no-break space before AM/PM; use a plain space so strings stay stable.
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(at))
    .replace(/\s/g, " ");
}
