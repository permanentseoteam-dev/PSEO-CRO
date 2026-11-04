// Pure Team logic: presence labels, directory search, org tree, KPI scores, quarters. No I/O.
import type { Tone } from "@/components/ui/tone";
import type { Confidence, Department, Direction, KeyResult, KpiRow, Person, Presence, ReviewStatus } from "./types";

export const PRESENCE: Record<Presence, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "ok" },
  meeting: { label: "Meeting", tone: "violet" },
  focus: { label: "Focus", tone: "blue" },
  away: { label: "Away", tone: "warn" },
  sick: { label: "Sick", tone: "danger" },
  offline: { label: "Off", tone: "muted" },
};

export const REVIEW: Record<ReviewStatus, { label: string; tone: Tone }> = {
  self_review: { label: "Self-review due", tone: "warn" },
  manager_review: { label: "Manager review", tone: "violet" },
  shared: { label: "Shared", tone: "blue" },
  acknowledged: { label: "Acknowledged", tone: "ok" },
};

export const CONFIDENCE: Record<Confidence, { label: string; tone: Tone }> = {
  on_track: { label: "On track", tone: "ok" },
  at_risk: { label: "At risk", tone: "warn" },
  off_track: { label: "Off track", tone: "danger" },
};

export const MAX_KEY_RESULTS = 6;

// ---------------------------------------------------------------- directory

/** Department filter ("" = all) plus a search over name, title and skills. */
export function matchesPerson(p: Pick<Person, "name" | "title" | "skills" | "department">, dept: string, q: string) {
  if (dept && p.department !== dept) return false;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.name, p.title ?? "", ...p.skills].join(" ").toLowerCase().includes(s);
}

// ---------------------------------------------------------------- org chart

export type OrgNode = { person: Person; children: OrgNode[]; teamSize: number };

/** Manager, else the department head (never yourself). Null = no position. */
export function parentOf(p: Person, byId: Map<string, Person>, heads: Map<string, string | null>): string | null {
  if (p.managerId && p.managerId !== p.id && byId.has(p.managerId)) return p.managerId;
  const head = p.departmentId ? heads.get(p.departmentId) : null;
  if (head && head !== p.id && byId.has(head)) return head;
  return null;
}

/**
 * Tree from manager_id (falling back to the department head). Cycle-safe: anyone only reachable
 * through a loop, or with no position and no reports, lands in `unplaced`.
 */
export function buildOrg(people: Person[], departments: Department[]): { roots: OrgNode[]; unplaced: Person[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const heads = new Map(departments.map((d) => [d.id, d.headId]));
  const kids = new Map<string, Person[]>();
  const parentless: Person[] = [];
  for (const p of people) {
    const parent = parentOf(p, byId, heads);
    if (!parent) parentless.push(p);
    else kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }

  const seen = new Set<string>();
  const grow = (p: Person): OrgNode => {
    seen.add(p.id);
    const children = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id)).map(grow);
    return { person: p, children, teamSize: children.reduce((a, c) => a + 1 + c.teamSize, 0) };
  };

  const roots = parentless.filter((p) => kids.has(p.id)).map(grow);
  const unplaced = [
    ...parentless.filter((p) => !kids.has(p.id)),
    ...people.filter((p) => !seen.has(p.id) && parentOf(p, byId, heads)), // stuck in a loop
  ];
  return { roots, unplaced };
}

/** Why someone isn't in the tree: recent joiners show their join date. */
export function unplacedReason(p: Pick<Person, "joinedOn">, now: Date): string {
  if (p.joinedOn) {
    const days = (now.getTime() - new Date(p.joinedOn + "T00:00:00Z").getTime()) / 86_400_000;
    if (days >= 0 && days <= 30) return `Joined ${fmtDay(p.joinedOn)}`;
  }
  return "No manager set";
}

/** Ids of matching nodes and of every ancestor that must open to show them. */
export function searchOrg(roots: OrgNode[], q: string): { hits: Set<string>; open: Set<string> } {
  const hits = new Set<string>();
  const open = new Set<string>();
  const s = q.trim().toLowerCase();
  if (!s) return { hits, open };
  const walk = (n: OrgNode, path: string[]): void => {
    const p = n.person;
    if ([p.name, p.title ?? "", p.department ?? ""].join(" ").toLowerCase().includes(s)) {
      hits.add(p.id);
      path.forEach((id) => open.add(id));
    }
    n.children.forEach((c) => walk(c, [...path, p.id]));
  };
  roots.forEach((r) => walk(r, []));
  return { hits, open };
}

/** People I see on the Team tab: everyone for 'all'; reports, my department and departments I head for 'team'. */
export function teamOf(me: { id: string; departmentId: string | null }, people: Person[], departments: Department[], scope: "team" | "all") {
  const headed = new Set(departments.filter((d) => d.headId === me.id).map((d) => d.id));
  return people.filter(
    (p) =>
      p.id !== me.id &&
      (scope === "all" ||
        p.managerId === me.id ||
        (p.departmentId != null && (p.departmentId === me.departmentId || headed.has(p.departmentId)))),
  );
}

// ---------------------------------------------------------------- KPIs and scores

/** 0–100. Higher-is-better: value / target. Lower-is-better: target / value. */
export function kpiScore(value: number, target: number, direction: Direction): number {
  const ratio = direction === "higher" ? (target <= 0 ? 1 : value / target) : value <= 0 ? 1 : target / value;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function onTarget(r: Pick<KpiRow, "value" | "target" | "direction">) {
  return r.direction === "higher" ? r.value >= r.target : r.value <= r.target;
}

/** Weighted average of KPI scores, or null when there is nothing to score. */
export function quarterScore(rows: Pick<KpiRow, "value" | "target" | "direction" | "weight">[]): number | null {
  const w = rows.reduce((a, r) => a + r.weight, 0);
  if (!rows.length) return null;
  if (w <= 0) return Math.round(rows.reduce((a, r) => a + kpiScore(r.value, r.target, r.direction), 0) / rows.length);
  return Math.round(rows.reduce((a, r) => a + kpiScore(r.value, r.target, r.direction) * r.weight, 0) / w);
}

/** On target, and how many others are within 5%. */
export function kpiSummary(rows: Pick<KpiRow, "value" | "target" | "direction">[]) {
  const hit = rows.filter(onTarget).length;
  const near = rows.filter((r) => !onTarget(r) && kpiScore(r.value, r.target, r.direction) >= 95).length;
  return { onTarget: hit, near, total: rows.length };
}

/** Score bands: 80+ good, 60–79 warn, below 60 low. */
export function band(score: number): Tone {
  return score >= 80 ? "ok" : score >= 60 ? "warn" : "danger";
}

export function okrAverage(krs: Pick<KeyResult, "progress">[]): number {
  return krs.length ? Math.round(krs.reduce((a, k) => a + k.progress, 0) / krs.length) : 0;
}

/** "2 of 3 on track" across all key results of one person's objectives. */
export function krOnTrack(krs: Pick<KeyResult, "confidence">[]) {
  return { onTrack: krs.filter((k) => k.confidence === "on_track").length, total: krs.length };
}

export function fmtValue(v: number, unit: string) {
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;
}

// ---------------------------------------------------------------- dates and quarters

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" -> "14 Nov", or "14 Nov 2026" with the year. */
export function fmtDay(ymd: string, withYear = false) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** Quarter label for a moment, using the Dubai calendar (UTC+4): "Q4 2026". */
export function quarterOf(at: Date): string {
  const d = new Date(at.getTime() + 4 * 3_600_000);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}

/** The current quarter and the n-1 before it, newest first. */
export function recentQuarters(now: Date, n = 4): string[] {
  const [q, y] = quarterOf(now).slice(1).split(" ").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = y * 4 + (q - 1) - i;
    out.push(`Q${(idx % 4) + 1} ${Math.floor(idx / 4)}`);
  }
  return out;
}

export const QUARTER_RE = /^Q[1-4] \d{4}$/;
