import { getMe, can } from "@/lib/auth/can";
import { getEmployment, getMemberBasics, listDepartments, listStaff } from "../queries";
import { HrFormButtonsClient, ProbationCardClient } from "./hr-forms-client";

/**
 * Profile header buttons "Edit HR details" and "Title change". Renders nothing for people without
 * hr.records.manage "all" (those columns on members are admin-only).
 */
export async function HrFormButtons({ memberId }: { memberId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "hr.records.manage", "all")) return null;
  const [member, employment, departments, staff] = await Promise.all([getMemberBasics(memberId), getEmployment(memberId), listDepartments(), listStaff()]);
  if (!member) return null;
  return <HrFormButtonsClient member={member} employment={employment} departments={departments} staff={staff.filter((s) => s.id !== memberId)} />;
}

/** Profile → Job tab: probation card with Confirm, Extend +30/60/90 and End. */
export async function ProbationCard({ memberId }: { memberId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff") return null;
  const employment = await getEmployment(memberId);
  if (!employment) return null; // RLS: only the person and HR can read it
  const staff = await listStaff();
  const decidedBy = staff.find((s) => s.id === employment.probation_decided_by)?.name ?? null;
  return <ProbationCardClient employment={employment} decidedBy={decidedBy} canDecide={me.id !== memberId && can(me, "hr.records.manage", "team")} />;
}
