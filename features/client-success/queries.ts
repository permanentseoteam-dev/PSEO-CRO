import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Brief,
  CheckIn,
  Commitment,
  DeliveryRating,
  LogEntry,
  MonthlyReport,
  Opportunity,
  Person,
  Qbr,
  RelDate,
  RelPerson,
  Removal,
  SocialProfile,
  SuccessProfile,
} from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. Errors read as empty lists.
const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];

export async function getProfile(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("client_success_profiles").select("*").eq("client_id", clientId).maybeSingle();
  return (data ?? null) as SuccessProfile | null;
}

export async function getClientName(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  return (data?.name as string | undefined) ?? "Client";
}

export async function listStaff() {
  const supabase = await createClient();
  const r = await supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return rows<Person>(r);
}

export async function listDepartments() {
  const supabase = await createClient();
  const r = await supabase.from("departments").select("id, name").order("name");
  return rows<{ id: string; name: string }>(r);
}

export async function getCommitments(clientId: string) {
  const supabase = await createClient();
  const [c, k] = await Promise.all([
    supabase
      .from("commitments")
      .select("id, client_id, title, kind, cadence, target, latest, status, client_visible, last_checkin_on, owner:owner_id(id, name)")
      .eq("client_id", clientId)
      .order("created_at"),
    supabase
      .from("commitment_checkins")
      .select("id, commitment_id, value, status, note, checked_on, by:by_id(id, name), commitment:commitment_id(title)")
      .eq("client_id", clientId)
      .order("checked_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const checkins = rows<Omit<CheckIn, "commitment_title"> & { commitment: { title: string } | null }>(k).map(({ commitment, ...x }) => ({
    ...x,
    commitment_title: commitment?.title ?? "",
  }));
  return { commitments: rows<Commitment>(c), checkins };
}

export async function getRelationship(clientId: string) {
  const supabase = await createClient();
  const [people, dates, log, briefs, social, opps, removals] = await Promise.all([
    supabase.from("relationship_people").select("id, name, role, decision_power, personal_notes, birthday").eq("client_id", clientId).order("created_at"),
    supabase.from("relationship_dates").select("id, title, on_date, yearly, person_id").eq("client_id", clientId).order("on_date"),
    supabase
      .from("relationship_log")
      .select("id, kind, mood, note, on_date, person:person_id(name), by:by_id(id, name)")
      .eq("client_id", clientId)
      .order("on_date", { ascending: false })
      .limit(50),
    supabase.from("meeting_briefs").select("id, title, meeting_on, points").eq("client_id", clientId).order("meeting_on", { ascending: false }).limit(3),
    supabase.from("social_profiles").select("id, name, is_client, instagram_followers, ads_running, note").eq("client_id", clientId).order("is_client", { ascending: false }).order("name"),
    supabase.from("client_opportunities").select("id, title, value, currency, billing, stage, stage_note").eq("client_id", clientId).order("created_at"),
    supabase.from("privacy_removals").select("id, person_name, removed_at, by:removed_by(id, name)").eq("client_id", clientId).order("removed_at", { ascending: false }).limit(5),
  ]);
  return {
    people: rows<RelPerson>(people),
    dates: rows<RelDate>(dates),
    log: rows<Omit<LogEntry, "person_name"> & { person: { name: string } | null }>(log).map(({ person, ...x }) => ({ ...x, person_name: person?.name ?? null })),
    briefs: rows<Brief>(briefs),
    social: rows<SocialProfile>(social),
    opportunities: rows<Opportunity>(opps).map((o) => ({ ...o, value: o.value == null ? null : Number(o.value) })),
    removals: rows<Removal>(removals),
  };
}

export async function getReports(clientId: string) {
  const supabase = await createClient();
  const [reports, qbrs] = await Promise.all([
    supabase
      .from("monthly_reports")
      .select("id, month, status, due_on, auto_send, had_changes, summary, highlights, plan, changes_note, sent_at, owner:owner_id(id, name)")
      .eq("client_id", clientId)
      .order("month", { ascending: false })
      .limit(12),
    supabase.from("qbrs").select("id, quarter, status, meeting_on, deck_url").eq("client_id", clientId).order("quarter", { ascending: false }),
  ]);
  return { reports: rows<MonthlyReport>(reports), qbrs: rows<Qbr>(qbrs) };
}

export async function getRatings(clientId: string) {
  const supabase = await createClient();
  const r = await supabase
    .from("delivery_ratings")
    .select("id, month, department_id, quality, on_time, communication, rated_by_name, department:department_id(name)")
    .eq("client_id", clientId)
    .order("month", { ascending: false })
    .limit(36);
  return rows<Omit<DeliveryRating, "department_name"> & { department: { name: string } | null }>(r).map(({ department, ...x }) => ({
    ...x,
    department_name: department?.name ?? "",
  }));
}
