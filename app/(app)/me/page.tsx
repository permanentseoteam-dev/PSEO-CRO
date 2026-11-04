import type { ReactNode } from "react";
import { requireMe, can } from "@/lib/auth/can";
import {
  Avatar,
  ButtonLink,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  NoAccess,
  PhaseTwo,
  StatCard,
  Stats,
  StatusDot,
  Table,
  Tabs,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import {
  DOC_TYPE_LABEL,
  addDays,
  DOW,
  attendanceMonth,
  attendanceStats,
  balanceSub,
  dow,
  expiryInfo,
  fmtDay,
  fmtDays,
  fmtMinutes,
  fmtRange,
  leaveSummary,
  localTime,
  monthLabel,
  requestLabel,
  requestStatus,
  shiftMonth,
  today,
} from "@/lib/modules/personal/logic";
import {
  getDocuments,
  getLeave,
  getOpenSession,
  getProfile,
  getReviews,
  getSessions,
  listDepartments,
  listStaff,
  nameOf,
} from "@/lib/modules/personal/queries";
import type { Profile } from "@/lib/modules/personal/types";
import { EditHrDetails, EditMyDetails } from "./_components/details-dialogs";
import { ClockCard } from "./_components/clock-card";
import { RequestButton } from "./_components/request-button";
import { AckReview, CancelLeave, OpenDoc, UploadDoc } from "./_components/doc-controls";

export const metadata = { title: "My profile" };

const PRESENCE: Record<string, [string, Tone]> = {
  available: ["Available", "ok"],
  meeting: ["In a meeting", "blue"],
  focus: ["Focus", "violet"],
  away: ["Away", "warn"],
  sick: ["Sick", "danger"],
  offline: ["Offline", "muted"],
};
const CONTRACT = { full_time: "Full time", part_time: "Part time", contractor: "Contractor" };
const PROBATION: Record<Profile["probationStatus"], [string, Tone]> = {
  on_probation: ["On probation", "warn"],
  extended: ["Extended", "warn"],
  confirmed: ["Confirmed", "ok"],
  ended: ["Ended", "danger"],
};
const REVIEW: Record<string, [string, Tone]> = {
  self_review: ["Self-review due", "warn"],
  manager_review: ["With your manager", "blue"],
  shared: ["Shared", "blue"],
  acknowledged: ["Acknowledged", "ok"],
};
const CAREER = { joined: "Joined", promoted: "Promoted", transfer: "Transfer", title_change: "Title change" } as Record<string, string>;

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "job", label: "Job" },
  { value: "pay", label: <>Pay<PhaseTwo /></> },
  { value: "perf", label: "Performance" },
  { value: "docs", label: "Documents" },
  { value: "tools", label: <>Tools<PhaseTwo /></> },
  { value: "att", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "personal", label: <>Personal<PhaseTwo /></> },
  { value: "leaving", label: <>Leaving<PhaseTwo /></> },
];

function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 max-sm:grid-cols-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="m-0 min-w-0 break-words">{v ?? <span className="muted">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";
  const p = await getProfile(me.id);
  if (!p) return <NoAccess />;
  const canHr = can(me, "hr.manage", "all");
  const t = today();
  const shiftEnd = p.shift?.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/)?.[2] ?? null;

  return (
    <div className="page">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <Avatar name={p.name} size={96} />
        <div className="min-w-0">
          <h1 className="font-display">{p.name}</h1>
          <div>{[p.title, p.department].filter(Boolean).join(" · ")}</div>
          <div className="small mt-2 flex flex-wrap gap-x-[18px] gap-y-1.5">
            <StatusDot tone={PRESENCE[p.presence]?.[1] ?? "muted"}>{PRESENCE[p.presence]?.[0] ?? p.presence}</StatusDot>
            {p.shift ? <span className="muted">Shift {p.shift}</span> : null}
            {p.joinedOn ? <span className="muted">Joined {fmtDay(p.joinedOn)}</span> : null}
            <span className="muted">{p.email}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 max-sm:ml-0">
          <EditMyDetails
            initial={{
              bio: p.bio ?? "",
              skills: p.skills.join(", "),
              phone: p.phone ?? "",
              linkedin: p.linkedin ?? "",
              emergencyName: p.emergencyName ?? "",
              emergencyPhone: p.emergencyPhone ?? "",
            }}
          />
          {canHr ? <HrButton p={p} /> : null}
          <Button disabled>
            Title change<PhaseTwo />
          </Button>
        </div>
      </Card>

      <div className="max-w-full overflow-x-auto">
        <Tabs label="Profile sections" value={tab} items={TABS.map((x) => ({ ...x, href: `/me?tab=${x.value}` }))} />
      </div>

      {tab === "overview" ? <Overview p={p} /> : null}
      {tab === "job" ? <Job p={p} /> : null}
      {tab === "perf" ? <Perf memberId={me.id} /> : null}
      {tab === "docs" ? <Docs memberId={me.id} canHr={canHr} today={t} /> : null}
      {tab === "att" ? <Attendance memberId={me.id} month={sp.month} shiftEnd={shiftEnd} /> : null}
      {tab === "leave" ? <Leave memberId={me.id} managerId={p.managerId} today={t} /> : null}
      {["pay", "tools", "personal", "leaving"].includes(tab) ? (
        <Card>
          <EmptyState title="Coming in phase 2">This tab arrives with the HR tools in phase 2.</EmptyState>
        </Card>
      ) : null}
    </div>
  );
}

async function HrButton({ p }: { p: Profile }) {
  const [departments, people] = await Promise.all([listDepartments(), listStaff()]);
  return (
    <EditHrDetails
      departments={departments}
      people={people}
      initial={{
        memberId: p.id,
        title: p.title ?? "",
        departmentId: p.departmentId ?? "",
        managerId: p.managerId ?? "",
        shift: p.shift ?? "",
        joinedOn: p.joinedOn ?? "",
        contract: p.contract,
        location: p.location ?? "",
      }}
    />
  );
}

function Overview({ p }: { p: Profile }) {
  const li = p.linkedin ? (p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`) : null;
  return (
    <section className="grid-2">
      <div className="stack">
        <Card>
          <CardHead title="About" />
          <CardBody className="stack">
            {p.bio ? <p className="m-0">{p.bio}</p> : <p className="muted m-0">No bio yet. Use Edit my details to add one.</p>}
            <Dl
              rows={[
                ["Skills", p.skills.length ? p.skills.join(", ") : null],
                ["LinkedIn", li ? <a href={li} target="_blank" rel="noopener noreferrer">{p.linkedin!.replace(/^https?:\/\/(www\.)?/, "")}</a> : null],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Career" />
          <CardBody>
            {p.career.length ? (
              <ol className="m-0 list-none border-l-2 border-line py-0 pl-3.5">
                {p.career.map((c) => (
                  <li key={c.onDate + c.title} className="relative pb-3.5 pl-2.5 before:absolute before:-left-[21px] before:top-[5px] before:h-2.5 before:w-2.5 before:rounded-full before:bg-accent before:content-['']">
                    <b>{c.title}</b>
                    <div className="small muted">
                      {CAREER[c.kind] ?? c.kind} · {fmtDay(c.onDate)}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted m-0">No career history yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="stack">
        <Card>
          <CardHead title="Work" />
          <CardBody>
            <Dl
              rows={[
                ["Manager", p.manager],
                ["Department", p.department],
                ["Team", p.team.length ? p.team.join(", ") : null],
                ["Shift", p.shift],
                ["Location", p.location],
                ["Clients", p.clients.length ? p.clients.join(", ") : null],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Contact" />
          <CardBody>
            <Dl
              rows={[
                ["Email", p.email],
                ["Phone", p.phone],
                ["Emergency contact", p.emergencyName ? [p.emergencyName, p.emergencyPhone].filter(Boolean).join(" · ") : null],
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

async function Job({ p }: { p: Profile }) {
  const confirmedBy = await nameOf(p.probationConfirmedBy);
  const [label, tone] = PROBATION[p.probationStatus];
  return (
    <section className="grid-2">
      <Card>
        <CardHead title="Probation" actions={<StatusDot tone={tone}>{label}</StatusDot>} />
        <CardBody>
          <Dl
            rows={[
              ["Started", p.probationStart ? fmtDay(p.probationStart) : null],
              [p.probationStatus === "on_probation" || p.probationStatus === "extended" ? "Ends" : "Ended", p.probationEnd ? fmtDay(p.probationEnd) : null],
              ["Confirmed by", confirmedBy],
              ["Contract", CONTRACT[p.contract]],
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHead title="Job description" />
        <CardBody className="stack">
          {p.jobSummary ? <p className="m-0">{p.jobSummary}</p> : <p className="muted m-0">HR hasn&apos;t added a job description yet.</p>}
          {p.jobDuties.length ? (
            <ul className="m-0 pl-5">
              {p.jobDuties.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>
    </section>
  );
}

async function Perf({ memberId }: { memberId: string }) {
  const reviews = await getReviews(memberId);
  if (!reviews.length)
    return (
      <Card>
        <EmptyState title="No reviews yet">Your quarterly reviews show here once a cycle starts.</EmptyState>
      </Card>
    );
  return (
    <section className="grid-2">
      {reviews.map((r) => {
        const [label, tone] = REVIEW[r.status];
        return (
          <Card key={r.id}>
            <CardHead title={`${r.quarter} review`} actions={<StatusDot tone={tone}>{label}</StatusDot>} />
            <CardBody className="stack">
              <div className="row between">
                <span className="small muted">Manager: {r.reviewer ?? "Not set"}</span>
                {r.rating ? (
                  <span className="text-warn" aria-label={`${r.rating} of 5`}>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>
                ) : (
                  <span className="small muted">Not rated yet</span>
                )}
              </div>
              {r.notes ? <p className="m-0">{r.notes}</p> : null}
              {r.status === "self_review" ? (
                <>
                  {r.selfDue ? <p className="m-0">Your self-review is due {fmtDay(r.selfDue)}.</p> : null}
                  <div className="row">
                    <ButtonLink href="/performance" variant="primary" size="sm">Write self-review</ButtonLink>
                  </div>
                </>
              ) : null}
              {r.status === "shared" ? (
                <div className="row">
                  <AckReview id={r.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>
        );
      })}
    </section>
  );
}

async function Docs({ memberId, canHr, today: t }: { memberId: string; canHr: boolean; today: string }) {
  const docs = await getDocuments(memberId);
  return (
    <Card>
      <CardHead title="Documents" actions={<UploadDoc memberId={memberId} canHr={canHr} />} />
      {docs.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>HR only</Th>
              <Th>Expiry</Th>
              <Th hideSm>Uploaded</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const ex = expiryInfo(d.expiresOn, t);
              return (
                <tr key={d.id}>
                  <Td>{d.name}</Td>
                  <Td>{DOC_TYPE_LABEL[d.type]}</Td>
                  <Td>{d.hrOnly ? "Yes" : "No"}</Td>
                  <Td>{ex ? ex.warn ? <StatusDot tone="warn">{ex.label}</StatusDot> : ex.label : <span className="muted">None</span>}</Td>
                  <Td hideSm>{fmtDay(d.createdAt.slice(0, 10))}</Td>
                  <Td right>
                    <OpenDoc id={d.id} hasFile={!!d.storagePath} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No documents yet">Upload your ID, visa or certificates so HR has them on file.</EmptyState>
      )}
    </Card>
  );
}

async function Attendance({ memberId, month: qMonth, shiftEnd }: { memberId: string; month?: string; shiftEnd: string | null }) {
  const t = today();
  const thisMonth = t.slice(0, 7);
  // Default to the last full month, as in the mockup; ?month=YYYY-MM picks another.
  const month = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : shiftMonth(thisMonth, -1);
  const [sessions, open, leave] = await Promise.all([
    getSessions(memberId, `${month}-01`, addDays(`${shiftMonth(month, 1)}-01`, -1)),
    getOpenSession(memberId),
    getLeave(memberId, Number(month.slice(0, 4))),
  ]);
  const now = new Date();
  const days = attendanceMonth(sessions, leave.requests, month, now);
  const s = attendanceStats(days);
  const lead = dow(`${month}-01`);

  return (
    <section className="stack">
      <ClockCard clockedInAt={open ? localTime(open.clockIn) : null} onBreak={!!open?.breakStartedAt} shiftEnd={shiftEnd} />
      <Stats>
        <StatCard label="Days worked" value={<span className="num">{s.worked}</span>} sub={monthLabel(month)} />
        <StatCard label="Hours worked" value={<span className="num">{fmtMinutes(s.minutes)}</span>} sub="Breaks taken out" />
        <StatCard label="Late arrivals" value={<span className="num">{s.late}</span>} tone={s.late ? "warn" : undefined} sub="After 09:15" />
        <StatCard label="Punctuality" value={<span className="num">{s.punctuality}%</span>} sub="On time days" />
        <StatCard label="Absent" value={<span className="num">{s.absent}</span>} sub={s.sick ? `${s.sick} sick ${s.sick === 1 ? "day" : "days"}` : "No sick days"} />
      </Stats>
      <Card>
        <CardHead
          title={monthLabel(month)}
          actions={
            <>
              <ButtonLink size="sm" variant="ghost" href={`/me?tab=att&month=${shiftMonth(month, -1)}`}>Previous</ButtonLink>
              {month < thisMonth ? <ButtonLink size="sm" variant="ghost" href={`/me?tab=att&month=${shiftMonth(month, 1)}`}>Next</ButtonLink> : null}
            </>
          }
        />
        <CardBody>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-ink-3">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {Array.from({ length: lead }, (_, i) => (
              <div key={`b${i}`} className="cal-cell dim" />
            ))}
            {days.map((a) => (
              <div key={a.date} className={`cal-cell${a.off ? " dim" : ""}${a.date === t ? " today" : ""}`}>
                <span className="small">{Number(a.date.slice(8))}</span>
                {a.inTime ? (
                  <>
                    <div className={`ev${a.late ? " text-warn" : ""}`}>In {a.inTime}{a.late ? " · late" : ""}</div>
                    {a.outTime ? <div className="ev">Out {a.outTime}</div> : null}
                    {a.wfh ? <div className="ev">WFH</div> : null}
                  </>
                ) : a.absent ? (
                  <div className="ev text-danger">{a.absent}</div>
                ) : null}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

async function Leave({ memberId, managerId, today: t }: { memberId: string; managerId: string | null; today: string }) {
  const [{ balances, requests }, manager] = await Promise.all([getLeave(memberId, Number(t.slice(0, 4))), nameOf(managerId)]);
  const summary = leaveSummary(balances, requests, t);
  const shown = requests;
  return (
    <section className="stack">
      <div className="row between">
        <span className="muted">Annual leave needs 7 days&apos; notice.</span>
        <RequestButton kind="leave" variant="primary" />
      </div>
      <Stats>
        {summary.map((b) => (
          <StatCard key={b.type} label={b.label} value={fmtDays(b.left)} sub={balanceSub(b)} />
        ))}
      </Stats>
      <Card>
        <CardHead title="Requests" />
        {shown.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Dates</Th>
                <Th right>Days</Th>
                <Th hideSm>Reason</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = requestStatus(r, manager);
                return (
                  <tr key={r.id}>
                    <Td>{requestLabel(r.type)}</Td>
                    <Td>
                      {fmtRange(r.start, r.end)}
                      {r.halfDay ? " (half day)" : ""}
                    </Td>
                    <Td right num>{r.type === "overtime" ? fmtMinutes(r.minutes ?? 0) : r.days}</Td>
                    <Td hideSm>{r.reason ?? <span className="muted">None</span>}</Td>
                    <Td>
                      <StatusDot tone={st.tone}>{st.label}</StatusDot>
                    </Td>
                    <Td right>{r.status === "pending" ? <CancelLeave id={r.id} /> : null}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No requests yet">Your leave and work-from-home requests show here.</EmptyState>
        )}
      </Card>
    </section>
  );
}
