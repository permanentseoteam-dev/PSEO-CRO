// Pure rules for the Phase 2 work extras. No I/O. Dates are "YYYY-MM-DD" strings, maths in UTC.
import type {
  AlertKind,
  Capacity,
  Frequency,
  LoadTicket,
  MostRevisedRow,
  Person,
  QualityGroupRow,
  RecurringRule,
  ReviewRound,
  ScopeStatus,
  ScopeTerms,
  WorkloadAlert,
  WorkloadRow,
  WorkloadSettings,
} from "./types";

// ---------------------------------------------------------------- dates
const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => fromMs(toMs(iso) + n * DAY);
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoDow = (iso: string) => ((new Date(toMs(iso)).getUTCDay() + 6) % 7) + 1;
export const mondayOf = (iso: string) => addDays(iso, 1 - isoDow(iso));
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toMs(v));

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Mon 2" */
export function dayHead(iso: string) {
  return `${WEEKDAYS[isoDow(iso) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`;
}
/** "Nov 4" */
export function shortDate(iso: string) {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`;
}
/** "Week of Nov 2 – 8" (or "Nov 30 – Dec 6" across months). */
export function weekTitle(monday: string) {
  const sun = addDays(monday, 6);
  const end = sun.slice(5, 7) === monday.slice(5, 7) ? String(Number(sun.slice(8, 10))) : shortDate(sun);
  return `Week of ${shortDate(monday)} – ${end}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- workload
/**
 * Minutes a ticket puts on each day: the estimate (or the default) spread evenly over the
 * person's workdays from start to due. No start date means it all lands on the due day.
 * No due date means it isn't scheduled, so it's left off the grid.
 */
export function planTicket(t: LoadTicket, cap: Pick<Capacity, "workdays">, settings: WorkloadSettings): Map<string, number> {
  const out = new Map<string, number>();
  if (!t.due) return out;
  const minutes = t.estimateMin ?? settings.default_estimate_min;
  let start = t.start && t.start <= t.due ? t.start : t.due;
  // Keep very long ranges bounded: only the last year before the due date counts.
  if (daysBetween(start, t.due) > 366) start = addDays(t.due, -366);
  const days: string[] = [];
  for (let d = start; d <= t.due; d = addDays(d, 1)) if (cap.workdays.includes(isoDow(d))) days.push(d);
  if (!days.length) days.push(t.due);
  for (const d of days) out.set(d, minutes / days.length);
  return out;
}

export function buildWorkload(
  people: Person[],
  tickets: LoadTicket[],
  capacities: Capacity[],
  settings: WorkloadSettings,
  monday: string,
  fallback: Omit<Capacity, "member_id">,
): WorkloadRow[] {
  const days = weekDays(monday);
  const capOf = new Map(capacities.map((c) => [c.member_id, c]));
  return people.map((person) => {
    const cap = capOf.get(person.id) ?? { member_id: person.id, ...fallback };
    const perDay = cap.workdays.length ? cap.weekly_hours / cap.workdays.length : 0;
    const minutes = new Map<string, number>();
    for (const t of tickets) {
      if (t.assigneeId !== person.id) continue;
      for (const [d, m] of planTicket(t, cap, settings)) minutes.set(d, (minutes.get(d) ?? 0) + m);
    }
    const cells = days.map((d) => ({
      planned: round1((minutes.get(d) ?? 0) / 60),
      capacity: cap.workdays.includes(isoDow(d)) ? round1(perDay) : 0,
    }));
    const planned = round1(cells.reduce((a, c) => a + c.planned, 0));
    const capacity = round1(cap.weekly_hours);
    return { person, days: cells, planned, capacity, pct: capacity ? Math.round((planned / capacity) * 100) : planned ? 100 : 0 };
  });
}

/** Bar tone for a load percentage: over capacity warns, under the has-room line is ok. */
export function loadTone(pct: number, settings: WorkloadSettings): "warn" | "ok" | undefined {
  if (pct > 100) return "warn";
  if (pct < settings.has_room_pct) return "ok";
  return undefined;
}

/** Tone of a single day cell: over its capacity warns, work on a day off warns. */
export function dayTone(planned: number, capacity: number, settings: WorkloadSettings): "warn" | "ok" | undefined {
  if (!capacity) return planned ? "warn" : undefined;
  return loadTone(Math.round((planned / capacity) * 100), settings);
}

export const ALERT_LABEL: Record<AlertKind, { label: string; tone: "danger" | "warn" | "ok" }> = {
  overloaded: { label: "Overloaded", tone: "danger" },
  overdue: { label: "Overdue work", tone: "warn" },
  has_room: { label: "Has room", tone: "ok" },
  unestimated: { label: "Unestimated", tone: "warn" },
};

/** Capacity alerts for one week, in the order shown: overloaded, overdue, has room, unestimated. */
export function buildAlerts(rows: WorkloadRow[], tickets: LoadTicket[], settings: WorkloadSettings, today: string, monday: string): WorkloadAlert[] {
  const out: WorkloadAlert[] = [];
  const byPerson = (id: string) => tickets.filter((t) => t.assigneeId === id);
  const inWeek = (t: LoadTicket) => {
    if (!t.due) return false;
    const start = t.start && t.start <= t.due ? t.start : t.due;
    return start <= addDays(monday, 6) && t.due >= monday;
  };
  const sorted = (kind: AlertKind) => out.filter((a) => a.kind === kind);

  for (const r of rows) {
    const mine = byPerson(r.person.id);
    if (r.capacity && r.pct > settings.overloaded_pct) {
      // Suggest the biggest ticket this week as the one to hand over.
      const big = mine.filter(inWeek).sort((a, b) => (b.estimateMin ?? settings.default_estimate_min) - (a.estimateMin ?? settings.default_estimate_min))[0];
      out.push({ memberId: r.person.id, kind: "overloaded", detail: `${r.pct}%`, moveTicket: big ? { id: big.id, key: big.key } : null });
    }
    const overdue = mine.filter((t) => t.due && t.due < today).sort((a, b) => (a.due! < b.due! ? -1 : 1));
    if (settings.overdue_count > 0 && overdue.length >= settings.overdue_count) {
      out.push({ memberId: r.person.id, kind: "overdue", detail: `${overdue.length} overdue`, moveTicket: { id: overdue[0].id, key: overdue[0].key } });
    }
    if (r.capacity && r.pct < settings.has_room_pct) out.push({ memberId: r.person.id, kind: "has_room", detail: `${r.pct}%`, moveTicket: null });
    const unest = mine.filter((t) => t.estimateMin == null && inWeek(t)).length;
    if (unest) out.push({ memberId: r.person.id, kind: "unestimated", detail: `${unest} ${unest === 1 ? "ticket" : "tickets"} with no estimate`, moveTicket: null });
  }
  return [...sorted("overloaded"), ...sorted("overdue"), ...sorted("has_room"), ...sorted("unestimated")];
}

/** People a ticket can move to: everyone else under 100% this week, lightest first. */
export function moveTargets(rows: WorkloadRow[], exceptId: string) {
  return rows
    .filter((r) => r.person.id !== exceptId && r.capacity > 0 && r.pct < 100)
    .sort((a, b) => a.pct - b.pct)
    .map((r) => ({ id: r.person.id, name: r.person.name, pct: r.pct }));
}

/** Who the viewer may see on the workload grid, by their `work.workload.view` scope. */
export function visiblePeople(people: Person[], me: { id: string; departmentId: string | null }, scope: "none" | "own" | "team" | "all") {
  if (scope === "all") return people;
  if (scope === "team") return people.filter((p) => p.id === me.id || p.managerId === me.id || (me.departmentId != null && p.departmentId === me.departmentId));
  if (scope === "own") return people.filter((p) => p.id === me.id);
  return [];
}

// ---------------------------------------------------------------- recurring rules
type RepeatShape = Pick<RecurringRule, "frequency" | "weekday" | "month_day">;

/** First date on or after `from` that the rule fires on. Mirrors public.recurring_next_run() in 0204. */
export function nextRun(rule: RepeatShape, from: string): string {
  switch (rule.frequency) {
    case "daily":
      return from;
    case "weekdays": {
      const dow = isoDow(from);
      return dow <= 5 ? from : addDays(from, 8 - dow);
    }
    case "weekly": {
      const want = rule.weekday ?? 1;
      return addDays(from, (want - isoDow(from) + 7) % 7);
    }
    case "monthly": {
      const day = Math.min(Math.max(rule.month_day ?? 1, 1), 28);
      const y = Number(from.slice(0, 4));
      const m = Number(from.slice(5, 7));
      const thisMonth = `${from.slice(0, 7)}-${String(day).padStart(2, "0")}`;
      if (thisMonth >= from) return thisMonth;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
}

/** Next run for a new or resumed rule: never before its start date or today. */
export function firstRun(rule: RepeatShape & { starts_on: string }, today: string) {
  return nextRun(rule, rule.starts_on > today ? rule.starts_on : today);
}

export function repeatsLabel(rule: RepeatShape): string {
  const labels: Record<Frequency, string> = {
    daily: "Daily",
    weekdays: "Weekdays",
    weekly: `Weekly on ${WEEKDAYS[(rule.weekday ?? 1) - 1]}`,
    monthly: `Monthly on day ${rule.month_day ?? 1}`,
  };
  return labels[rule.frequency];
}

/** Fills {client}, {project}, {month} ("November 2026") and {date} ("Nov 4"). Mirrors the SQL in 0204. */
export function renderTitle(pattern: string, ctx: { client: string | null; project: string; runOn: string }) {
  const month = `${MONTHS[Number(ctx.runOn.slice(5, 7)) - 1]} ${ctx.runOn.slice(0, 4)}`;
  return pattern
    .replaceAll("{client}", ctx.client ?? ctx.project)
    .replaceAll("{project}", ctx.project)
    .replaceAll("{month}", month)
    .replaceAll("{date}", shortDate(ctx.runOn))
    .trim();
}

// ---------------------------------------------------------------- dependencies
/**
 * Would "ticket is blocked by blocker" close a loop? True when the blocker is already,
 * directly or through others, waiting on the ticket (or is the ticket itself).
 */
export function wouldCycle(edges: { ticketId: string; blockedById: string }[], ticketId: string, blockerId: string) {
  if (ticketId === blockerId) return true;
  const blockersOf = new Map<string, string[]>();
  for (const e of edges) blockersOf.set(e.ticketId, [...(blockersOf.get(e.ticketId) ?? []), e.blockedById]);
  const seen = new Set<string>();
  const stack = [blockerId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === ticketId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(blockersOf.get(cur) ?? []));
  }
  return false;
}

export const openCount = (tickets: { status: string }[]) => tickets.filter((t) => t.status !== "done").length;

/** "CPD-139" style key, normalised to upper case. Null when it doesn't look like a key. */
export function parseTicketKey(raw: string) {
  const k = raw.trim().toUpperCase();
  return /^[A-Z]{2,8}-\d+(\.\d+)?$/.test(k) ? k : null;
}

// ---------------------------------------------------------------- scope
/** Terms from client_terms: a text[] or free text, one item per line, comma or semicolon. */
export function splitTerms(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(/[\n,;•]+/) : [];
  return parts.map((s) => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

/** A term matches when the text contains the phrase, or every 4+ letter word of it. */
function matches(text: string, term: string) {
  const t = ` ${words(text).join(" ")} `;
  const phrase = words(term).join(" ");
  if (phrase && t.includes(` ${phrase} `)) return true;
  const key = words(term).filter((w) => w.length >= 4);
  return key.length > 0 && key.every((w) => t.includes(` ${w}`));
}

/** Suggested scope for a ticket against the client's terms. Out-of-scope terms win over in-scope ones. */
export function checkScope(text: string, terms: ScopeTerms): { status: ScopeStatus; term: string | null } {
  const out = terms.outOfScope.find((term) => matches(text, term));
  if (out) return { status: "out_of_scope", term: out };
  const inn = terms.inScope.find((term) => matches(text, term));
  if (inn) return { status: "in_scope", term: inn };
  return { status: "unsure", term: null };
}

export const SCOPE_LABEL: Record<ScopeStatus, { label: string; tone: "ok" | "danger" | "muted" }> = {
  in_scope: { label: "In scope", tone: "ok" },
  out_of_scope: { label: "Out of scope", tone: "danger" },
  unsure: { label: "Not checked", tone: "muted" },
};

// ---------------------------------------------------------------- quality report
export const RANGES = { d30: { label: "30 days", days: 30 }, d90: { label: "90 days", days: 90 }, y: { label: "Last year", days: 365 } } as const;
export type RangeKey = keyof typeof RANGES;
export const rangeKey = (v: string | undefined): RangeKey => (v === "d90" || v === "y" ? v : "d30");
export const rangeStart = (range: RangeKey, today: string) => addDays(today, -RANGES[range].days);

const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Reviewed, first-time pass %, average rounds and average wait per group (service, person…). */
export function qualityGroups(rounds: ReviewRound[], groupOf: (ticketId: string) => string | null): QualityGroupRow[] {
  const byTicket = new Map<string, ReviewRound[]>();
  for (const r of rounds) if (r.status !== "waiting") byTicket.set(r.ticketId, [...(byTicket.get(r.ticketId) ?? []), r]);
  const groups = new Map<string, { tickets: ReviewRound[][]; waits: number[] }>();
  for (const [ticketId, list] of byTicket) {
    const g = groupOf(ticketId);
    if (!g) continue;
    const entry = groups.get(g) ?? { tickets: [], waits: [] };
    list.sort((a, b) => a.round - b.round);
    entry.tickets.push(list);
    for (const r of list) if (r.decidedAt) entry.waits.push(Math.max(0, hoursBetween(r.submittedAt, r.decidedAt)));
    groups.set(g, entry);
  }
  return [...groups]
    .map(([name, { tickets, waits }]) => {
      const first = tickets.filter((l) => l[0].status === "approved").length;
      const avgRounds = mean(tickets.map((l) => l[l.length - 1].round));
      const avgWait = mean(waits);
      return {
        name,
        reviewed: tickets.length,
        firstTimePct: tickets.length ? Math.round((first / tickets.length) * 100) : null,
        avgRounds: avgRounds == null ? null : round1(avgRounds),
        avgWaitH: avgWait == null ? null : Math.round(avgWait),
      };
    })
    .sort((a, b) => b.reviewed - a.reviewed || a.name.localeCompare(b.name));
}

/** Tickets sent back the most. Rounds = highest round; main reason = most common send-back reason. */
export function mostRevised(rounds: ReviewRound[], limit = 10): MostRevisedRow[] {
  const byTicket = new Map<string, ReviewRound[]>();
  for (const r of rounds) byTicket.set(r.ticketId, [...(byTicket.get(r.ticketId) ?? []), r]);
  const rows: (MostRevisedRow & { changes: number })[] = [];
  for (const [ticketId, list] of byTicket) {
    const changes = list.filter((r) => r.status === "changes");
    if (!changes.length) continue;
    const counts = new Map<string, number>();
    for (const r of changes) for (const why of r.reasons) counts.set(why, (counts.get(why) ?? 0) + 1);
    const main = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    rows.push({ ticketId, rounds: Math.max(...list.map((r) => r.round)), mainReason: main, changes: changes.length });
  }
  return rows
    .sort((a, b) => b.changes - a.changes || b.rounds - a.rounds)
    .slice(0, limit)
    .map(({ ticketId, rounds: n, mainReason }) => ({ ticketId, rounds: n, mainReason }));
}

/** QA checks that failed most, highest first. */
export function failedChecks(results: { label: string; passed: boolean }[], limit = 6): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of results) if (!r.passed && r.label) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}
