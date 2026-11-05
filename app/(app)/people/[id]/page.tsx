import Link from "next/link";
import type { ReactNode } from "react";
import { requireMe, can } from "@/lib/auth/can";
import { Avatar, Card, CardBody, CardHead, EmptyState, NoAccess, StatusDot, Tabs } from "@/components/ui";
import { HrFormButtons, LeavingTab, PayTab, PersonalTab, ProbationCard, ToolsTab } from "@/features/hr-p2";
import { fmtDay, PRESENCE } from "@/lib/modules/team/logic";
import { listPeople } from "@/lib/modules/team/queries";
import { AvatarDot } from "../_components/avatar-dot";

export const metadata = { title: "Team member" };

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "hr.directory.view")) return <NoAccess />;
  const { id } = await params;
  const { people } = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) return <EmptyState title="Person not found">They may have left or the link is wrong.</EmptyState>;

  const manager = people.find((x) => x.id === p.managerId);
  const reports = people.filter((x) => x.managerId === p.id);
  const pr = PRESENCE[p.presence] ?? PRESENCE.offline;
  // HR tabs follow the show rules in features/hr-p2/WIRING.md §1; each tab also checks access itself.
  const self = id === me.id;
  const hr = can(me, "hr.records.manage", "team");
  const tabs = [
    { value: "profile", label: "Profile", show: true },
    { value: "job", label: "Job", show: self || hr },
    { value: "pay", label: "Pay", show: self || can(me, "hr.pay.view", "team") },
    { value: "tools", label: "Tools", show: self || hr },
    { value: "personal", label: "Personal", show: self || can(me, "hr.personal.view", "team") },
    { value: "leaving", label: "Leaving", show: !self && hr },
  ].filter((t) => t.show);
  const sp = await searchParams;
  const tab = tabs.some((t) => t.value === sp.tab) ? sp.tab! : "profile";
  const facts: [string, ReactNode][] = [
    ["Email", <a key="e" href={`mailto:${p.email}`}>{p.email}</a>],
    ["Phone", p.phone ? <a key="p" href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a> : "–"],
    ["Department", p.department ?? "–"],
    ["Reports to", manager ? <Link key="m" href={`/people/${manager.id}`}>{manager.name}</Link> : "–"],
    ["Joined", p.joinedOn ? fmtDay(p.joinedOn, true) : "–"],
    ["Working hours", p.shift ?? "–"],
  ];

  return (
    <div className="page">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <AvatarDot name={p.name} size={64} presence={p.presence} />
          <div className="min-w-0 flex-1">
            <h2>{p.name}</h2>
            <div className="muted">{[p.title, p.department].filter(Boolean).join(" · ")}</div>
            <div className="small mt-1.5 flex flex-wrap gap-1.5">
              <StatusDot tone={pr.tone}>{pr.label}</StatusDot>
              {p.statusNote ? <span className="muted">{p.statusNote}</span> : null}
              <span className="muted">· {p.clockedIn ? "Clocked in" : "Not clocked in"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <HrFormButtons memberId={id} />
          </div>
        </CardBody>
      </Card>

      {tabs.length > 1 ? (
        <div className="max-w-full overflow-x-auto">
          <Tabs label="Profile sections" value={tab} items={tabs.map((t) => ({ value: t.value, label: t.label, href: `/people/${id}?tab=${t.value}` }))} />
        </div>
      ) : null}

      {tab === "job" ? <ProbationCard memberId={id} /> : null}
      {tab === "pay" ? <PayTab memberId={id} payslipBase="/me/payslips" /> : null}
      {tab === "tools" ? <ToolsTab memberId={id} /> : null}
      {tab === "personal" ? <PersonalTab memberId={id} /> : null}
      {tab === "leaving" ? <LeavingTab memberId={id} /> : null}

      {tab === "profile" ? (
        <div className="grid-2">
          <Card>
            <CardHead title="Contact and work" />
            <CardBody>
              <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="muted">{k}</dt>
                    <dd className="m-0 min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <div className="stack">
            <Card>
              <CardHead title="Skills" />
              <CardBody>{p.skills.length ? p.skills.join(", ") : <span className="muted">No skills added yet.</span>}</CardBody>
            </Card>
            <Card>
              <CardHead title="Team" actions={<b>{reports.length}</b>} />
              {reports.length ? (
                <div className="list">
                  {reports.map((r) => (
                    <Link key={r.id} href={`/people/${r.id}`} className="item">
                      <Avatar name={r.name} size={28} />
                      <div className="min-w-0">
                        <b>{r.name}</b>
                        <div className="small muted">{r.title}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <CardBody>
                  <span className="muted">No one reports to {p.name.split(" ")[0]}.</span>
                </CardBody>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
