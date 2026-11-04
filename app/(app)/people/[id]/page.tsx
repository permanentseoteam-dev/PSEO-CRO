import Link from "next/link";
import type { ReactNode } from "react";
import { requireMe, can } from "@/lib/auth/can";
import { Avatar, Card, CardBody, CardHead, EmptyState, NoAccess, StatusDot } from "@/components/ui";
import { fmtDay, PRESENCE } from "@/lib/modules/team/logic";
import { listPeople } from "@/lib/modules/team/queries";
import { AvatarDot } from "../_components/avatar-dot";

export const metadata = { title: "Team member" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "hr.directory.view")) return <NoAccess />;
  const { id } = await params;
  const { people } = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) return <EmptyState title="Person not found">They may have left or the link is wrong.</EmptyState>;

  const manager = people.find((x) => x.id === p.managerId);
  const reports = people.filter((x) => x.managerId === p.id);
  const pr = PRESENCE[p.presence] ?? PRESENCE.offline;
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
        </CardBody>
      </Card>

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
    </div>
  );
}
