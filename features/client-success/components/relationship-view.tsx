"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  EmptyState,
  Field,
  FormGrid,
  Input,
  Select,
  StatCard,
  Stats,
  StatusDot,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { addDate, addLogEntry, addSocialProfile, removePersonOnRequest, saveBrief, saveOpportunity, savePerson, saveProfile } from "../actions";
import { OPPORTUNITY_STAGE, lines, profileCompletion, shortDate, upcomingMoments } from "../logic";
import {
  LOG_KINDS,
  MOODS,
  OPPORTUNITY_STAGES,
  TIERS,
  type Brief,
  type LogEntry,
  type Opportunity,
  type RelDate,
  type RelPerson,
  type Removal,
  type SocialProfile,
  type SuccessProfile,
} from "../types";
import { FormDialog, formValues, numOrNull, strOrNull, useRun } from "./shared";

type Props = {
  clientId: string;
  profile: SuccessProfile | null;
  people: RelPerson[];
  dates: RelDate[];
  log: LogEntry[];
  briefs: Brief[];
  social: SocialProfile[];
  opportunities: Opportunity[];
  removals: Removal[];
  canManage: boolean;
  today: string;
};

type Sub = "people" | "records" | "prep" | "privacy";
const fmtNum = (n: number | null) => (n == null ? "" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const money = (o: Opportunity) => (o.value == null ? "" : `${o.currency} ${o.value.toLocaleString("en-US")}${o.billing === "monthly" ? "/mo" : " once"}`);

export function RelationshipView(p: Props) {
  const [sub, setSub] = useState<Sub>("people");
  const [dlg, setDlg] = useState<null | "summary" | "person" | "date" | "log" | "brief" | "niche" | "social" | "opp" | "remove">(null);
  const [editPerson, setEditPerson] = useState<RelPerson | null>(null);
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [removeId, setRemoveId] = useState(p.people[0]?.id ?? "");
  const { pending, run } = useRun();
  const close = () => setDlg(null);
  const { clientId, profile, today } = p;

  const completion = profileCompletion({
    profile,
    people: p.people,
    hasDates: p.dates.length > 0,
    hasBrief: p.briefs.length > 0,
    hasSocial: p.social.length > 0,
  });
  const moments = upcomingMoments(p.dates, p.people, today);
  const keyDates = p.dates.filter((d) => d.yearly);
  const brief = p.briefs[0];
  const removeTarget = p.people.find((x) => x.id === removeId) ?? p.people[0];
  const profileBase = { clientId, tier: profile?.tier ?? null, rapport: profile?.rapport ?? null, rapport_note: profile?.rapport_note ?? null, niche_profile: profile?.niche_profile ?? null };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard label="Tier" value={profile?.tier ?? "Not set"} sub={tierHint(profile?.tier)} />
        <StatCard label="Rapport" value={profile?.rapport ? `${profile.rapport} / 5` : "Not set"} sub={profile?.rapport_note ?? undefined} />
        <div className="stat">
          <span className="label">Profile complete</span>
          <span className="value num">{completion}%</span>
          <div className="bar">
            <i style={{ width: `${completion}%` }} />
          </div>
        </div>
      </Stats>
      {p.canManage ? (
        <div className="row">
          <Button size="sm" onClick={() => setDlg("summary")}>
            Edit tier and rapport
          </Button>
        </div>
      ) : null}

      <Tabs
        label="Relationship"
        value={sub}
        onChange={(v) => setSub(v as Sub)}
        items={[
          { value: "people", label: "People" },
          { value: "records", label: "Records" },
          { value: "prep", label: "Prep" },
          { value: "privacy", label: "Privacy" },
        ]}
      />

      {sub === "people" ? (
        <div className="stack">
          {p.canManage ? (
            <div className="row">
              <Button size="sm" variant="primary" onClick={() => (setEditPerson(null), setDlg("person"))}>
                Add person
              </Button>
            </div>
          ) : null}
          {p.people.length === 0 ? (
            <Card>
              <EmptyState icon={<Users />} title="No people yet">
                Add who decides, who approves and what they care about.
              </EmptyState>
            </Card>
          ) : (
            <div className="grid-3">
              {p.people.map((x) => (
                <Card key={x.id}>
                  <CardBody className="stack">
                    <div className="between">
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={x.name} size={36} />
                        <div className="stack" style={{ gap: 0 }}>
                          <strong>{x.name}</strong>
                          <span className="small muted">{x.role}</span>
                        </div>
                      </div>
                      {p.canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => (setEditPerson(x), setDlg("person"))}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                    <div className="between small">
                      <span className="muted">Decision power</span>
                      <span>{x.decision_power ?? "Not set"}</span>
                    </div>
                    {x.birthday ? (
                      <div className="between small">
                        <span className="muted">Birthday</span>
                        <span>{shortDate(`${today.slice(0, 4)}${x.birthday.slice(4)}`, today)}</span>
                      </div>
                    ) : null}
                    {x.personal_notes ? (
                      <p className="small" style={{ margin: 0 }}>
                        {x.personal_notes}
                      </p>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {sub === "records" ? (
        <>
          <div className="grid-2">
            <Card>
              <CardHead title="Moments, next 90 days" actions={p.canManage ? <Button size="sm" onClick={() => setDlg("date")}>Add date</Button> : null} />
              <DateList items={moments.map((m) => ({ key: m.title + m.on, title: m.title, on: m.on }))} today={today} empty="Nothing in the next 90 days." />
            </Card>
            <Card>
              <CardHead title="Key dates" />
              <DateList items={keyDates.map((d) => ({ key: d.id, title: d.title, on: d.on_date, yearly: true }))} today={today} empty="No yearly dates yet." />
            </Card>
          </div>
          <Card>
            <CardHead title="Relationship log" actions={p.canManage ? <Button size="sm" onClick={() => setDlg("log")}>Add entry</Button> : null} />
            {p.log.length === 0 ? (
              <p className="card-body small muted" style={{ margin: 0 }}>
                No entries yet.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Kind</Th>
                    <Th>Note</Th>
                    <Th hideSm>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.log.map((l) => (
                    <tr key={l.id}>
                      <Td className="num">{shortDate(l.on_date, today)}</Td>
                      <Td>{l.kind}</Td>
                      <Td>
                        {l.note}
                        {l.mood === "unhappy" ? (
                          <>
                            {" "}
                            <StatusDot tone="danger">Unhappy</StatusDot>
                          </>
                        ) : null}
                      </Td>
                      <Td hideSm>{l.by?.name ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      ) : null}

      {sub === "prep" ? (
        <div className="grid-2">
          <Card>
            <CardHead
              title={brief ? `Meeting brief: ${brief.title}, ${shortDate(brief.meeting_on, today)}` : "Meeting brief"}
              actions={p.canManage ? <Button size="sm" onClick={() => setDlg("brief")}>{brief ? "Edit brief" : "Write brief"}</Button> : null}
            />
            <CardBody>
              {brief && lines(brief.points).length ? (
                <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {lines(brief.points).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  No brief for the next meeting yet.
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Niche profile" actions={p.canManage ? <Button size="sm" onClick={() => setDlg("niche")}>Edit</Button> : null} />
            <CardBody>
              <p className={profile?.niche_profile ? "small" : "small muted"} style={{ margin: 0, whiteSpace: "pre-line" }}>
                {profile?.niche_profile || "What they sell, who buys, when demand peaks, and how buyers decide."}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Social and competitors" actions={p.canManage ? <Button size="sm" onClick={() => setDlg("social")}>Add</Button> : null} />
            {p.social.length === 0 ? (
              <p className="card-body small muted" style={{ margin: 0 }}>
                No accounts tracked yet.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th right>Instagram</Th>
                    <Th right>Ads running</Th>
                    <Th hideSm>Note</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.social.map((s) => (
                    <tr key={s.id}>
                      <Td>{s.is_client ? <strong>{s.name}</strong> : s.name}</Td>
                      <Td right num>
                        {fmtNum(s.instagram_followers)}
                      </Td>
                      <Td right num>
                        {s.ads_running ?? ""}
                      </Td>
                      <Td hideSm>{s.note}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHead title="Opportunities" actions={p.canManage ? <Button size="sm" onClick={() => (setEditOpp(null), setDlg("opp"))}>Add</Button> : null} />
            {p.opportunities.length === 0 ? (
              <p className="card-body small muted" style={{ margin: 0 }}>
                No opportunities yet.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Opportunity</Th>
                    <Th right>Value</Th>
                    <Th>Stage</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.opportunities.map((o) => {
                    const st = OPPORTUNITY_STAGE[o.stage];
                    return (
                      <tr key={o.id} className={p.canManage ? "click" : undefined} onClick={p.canManage ? () => (setEditOpp(o), setDlg("opp")) : undefined}>
                        <Td>{o.title}</Td>
                        <Td right num>
                          {money(o)}
                        </Td>
                        <Td>
                          <StatusDot tone={st.tone}>{o.stage_note || st.label}</StatusDot>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}

      {sub === "privacy" ? (
        <Card>
          <CardHead title="Privacy" />
          <CardBody className="stack">
            <p className="small" style={{ margin: 0 }}>
              Personal notes about client contacts are visible to the account team only. If a contact asks, remove everything we hold about
              them. This deletes their personal profile, dates and log entries, and keeps a record that the removal happened.
            </p>
            {p.canManage && p.people.length ? (
              <div className="row">
                <Select aria-label="Contact" value={removeTarget?.id} onChange={(e) => setRemoveId(e.target.value)}>
                  {p.people.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
                <Button variant="danger" onClick={() => setDlg("remove")}>
                  Remove on request
                </Button>
              </div>
            ) : null}
            <p className="small muted" style={{ margin: 0 }}>
              {p.removals[0]
                ? `Last removal: ${p.removals[0].person_name}, ${shortDate(p.removals[0].removed_at.slice(0, 10), today)}${p.removals[0].by ? ` by ${p.removals[0].by.name}` : ""}.`
                : "Last removal: none."}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* ------------------------------------------------ dialogs */}
      <FormDialog
        id="cs-rel-summary"
        title="Tier and rapport"
        submitLabel="Save"
        pending={pending}
        open={dlg === "summary"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(() => saveProfile({ ...profileBase, tier: strOrNull(v.tier), rapport: numOrNull(v.rapport), rapport_note: v.rapport_note }), "Saved", close);
        }}
      >
        <FormGrid>
          <Field label="Tier" htmlFor="cs-r-tier">
            <Select id="cs-r-tier" name="tier" defaultValue={profile?.tier ?? ""}>
              <option value="">Not set</option>
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Rapport (1 to 5)" htmlFor="cs-r-rapport">
            <Select id="cs-r-rapport" name="rapport" defaultValue={profile?.rapport ?? ""}>
              <option value="">Not set</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field label="Rapport note" htmlFor="cs-r-note" full>
            <Input id="cs-r-note" name="rapport_note" maxLength={200} defaultValue={profile?.rapport_note ?? ""} />
          </Field>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-niche"
        title="Niche profile"
        submitLabel="Save"
        pending={pending}
        open={dlg === "niche"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(() => saveProfile({ ...profileBase, niche_profile: v.niche_profile }), "Saved", close);
        }}
      >
        <Field label="Niche profile" htmlFor="cs-r-niche">
          <Textarea id="cs-r-niche" name="niche_profile" rows={6} defaultValue={profile?.niche_profile ?? ""} />
        </Field>
      </FormDialog>

      <FormDialog
        id="cs-rel-person"
        title={editPerson ? `Edit ${editPerson.name}` : "Add person"}
        submitLabel={editPerson ? "Save" : "Add person"}
        pending={pending}
        open={dlg === "person"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () => savePerson({ clientId, id: editPerson?.id, name: v.name, role: v.role, decision_power: v.decision_power, personal_notes: v.personal_notes, birthday: v.birthday }),
            "Saved",
            close,
          );
        }}
      >
        <FormGrid key={editPerson?.id ?? "new"}>
          <Field label="Name" htmlFor="cs-p-name">
            <Input id="cs-p-name" name="name" required maxLength={120} defaultValue={editPerson?.name} />
          </Field>
          <Field label="Role" htmlFor="cs-p-role">
            <Input id="cs-p-role" name="role" maxLength={120} defaultValue={editPerson?.role ?? ""} />
          </Field>
          <Field label="Decision power" htmlFor="cs-p-power">
            <Input id="cs-p-power" name="decision_power" maxLength={120} placeholder="e.g. Final say on budget" defaultValue={editPerson?.decision_power ?? ""} />
          </Field>
          <Field label="Birthday" htmlFor="cs-p-bday">
            <Input id="cs-p-bday" name="birthday" type="date" defaultValue={editPerson?.birthday ?? ""} />
          </Field>
          <Field label="Personal profile" htmlFor="cs-p-notes" full>
            <Textarea id="cs-p-notes" name="personal_notes" rows={3} placeholder="Family, interests, how they like to be contacted" defaultValue={editPerson?.personal_notes ?? ""} />
          </Field>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-date"
        title="Add date"
        submitLabel="Add date"
        pending={pending}
        open={dlg === "date"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(() => addDate({ clientId, title: v.title, on_date: v.on_date, yearly: v.yearly, person_id: strOrNull(v.person_id) }), "Date added", close);
        }}
      >
        <FormGrid>
          <Field label="What" htmlFor="cs-d-title" full>
            <Input id="cs-d-title" name="title" required maxLength={120} placeholder="e.g. Showroom opening anniversary" />
          </Field>
          <Field label="Date" htmlFor="cs-d-date">
            <Input id="cs-d-date" name="on_date" type="date" required defaultValue={today} />
          </Field>
          <Field label="Person" htmlFor="cs-d-person">
            <PersonSelect id="cs-d-person" people={p.people} />
          </Field>
          <div className="field full">
            <Checkbox name="yearly" label="Repeats every year" />
          </div>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-log"
        title="Add log entry"
        submitLabel="Save to log"
        pending={pending}
        open={dlg === "log"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () => addLogEntry({ clientId, kind: v.kind, mood: strOrNull(v.mood), note: v.note, on_date: v.on_date, person_id: strOrNull(v.person_id) }),
            "Logged",
            close,
          );
        }}
      >
        <FormGrid>
          <Field label="Kind" htmlFor="cs-l-kind">
            <Select id="cs-l-kind" name="kind" defaultValue="touch">
              {LOG_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="With" htmlFor="cs-l-person">
            <PersonSelect id="cs-l-person" people={p.people} />
          </Field>
          <Field label="Date" htmlFor="cs-l-date">
            <Input id="cs-l-date" name="on_date" type="date" required defaultValue={today} />
          </Field>
          <Field label="Mood" htmlFor="cs-l-mood">
            <Select id="cs-l-mood" name="mood" defaultValue="">
              <option value="">Not noted</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" htmlFor="cs-l-note" full>
            <Textarea id="cs-l-note" name="note" rows={3} required />
          </Field>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-brief"
        title={brief ? "Edit meeting brief" : "Write meeting brief"}
        submitLabel="Save brief"
        pending={pending}
        open={dlg === "brief"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(() => saveBrief({ clientId, id: brief?.id, title: v.title, meeting_on: v.meeting_on, points: v.points }), "Brief saved", close);
        }}
      >
        <FormGrid>
          <Field label="Meeting" htmlFor="cs-b-title">
            <Input id="cs-b-title" name="title" required maxLength={120} defaultValue={brief?.title ?? "Monthly review"} />
          </Field>
          <Field label="Date" htmlFor="cs-b-date">
            <Input id="cs-b-date" name="meeting_on" type="date" required defaultValue={brief?.meeting_on ?? today} />
          </Field>
          <Field label="Talking points (one per line)" htmlFor="cs-b-points" full>
            <Textarea id="cs-b-points" name="points" rows={6} defaultValue={brief?.points ?? ""} />
          </Field>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-social"
        title="Add social account or competitor"
        submitLabel="Add"
        pending={pending}
        open={dlg === "social"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () =>
              addSocialProfile({
                clientId,
                name: v.name,
                is_client: v.is_client,
                instagram_followers: numOrNull(v.instagram_followers),
                ads_running: numOrNull(v.ads_running),
                note: v.note,
              }),
            "Added",
            close,
          );
        }}
      >
        <FormGrid>
          <Field label="Name" htmlFor="cs-s-name" full>
            <Input id="cs-s-name" name="name" required maxLength={120} />
          </Field>
          <Field label="Instagram followers" htmlFor="cs-s-ig">
            <Input id="cs-s-ig" name="instagram_followers" type="number" min={0} inputMode="numeric" />
          </Field>
          <Field label="Ads running" htmlFor="cs-s-ads">
            <Input id="cs-s-ads" name="ads_running" type="number" min={0} inputMode="numeric" />
          </Field>
          <Field label="Note" htmlFor="cs-s-note" full>
            <Input id="cs-s-note" name="note" maxLength={300} />
          </Field>
          <div className="field full">
            <Checkbox name="is_client" label="This is the client's own account" />
          </div>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-opp"
        title={editOpp ? "Edit opportunity" : "Add opportunity"}
        submitLabel={editOpp ? "Save" : "Add opportunity"}
        pending={pending}
        open={dlg === "opp"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () =>
              saveOpportunity({
                clientId,
                id: editOpp?.id,
                title: v.title,
                value: numOrNull(v.value),
                currency: v.currency,
                billing: v.billing,
                stage: v.stage,
                stage_note: v.stage_note,
              }),
            "Saved",
            close,
          );
        }}
      >
        <FormGrid key={editOpp?.id ?? "new"}>
          <Field label="Opportunity" htmlFor="cs-o-title" full>
            <Input id="cs-o-title" name="title" required maxLength={200} defaultValue={editOpp?.title} />
          </Field>
          <Field label="Value" htmlFor="cs-o-value">
            <Input id="cs-o-value" name="value" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={editOpp?.value ?? ""} />
          </Field>
          <Field label="Currency" htmlFor="cs-o-cur">
            <Select id="cs-o-cur" name="currency" defaultValue={editOpp?.currency ?? "AED"}>
              {["AED", "USD", "PKR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Billing" htmlFor="cs-o-billing">
            <Select id="cs-o-billing" name="billing" defaultValue={editOpp?.billing ?? "monthly"}>
              <option value="monthly">Monthly</option>
              <option value="once">One-off</option>
            </Select>
          </Field>
          <Field label="Stage" htmlFor="cs-o-stage">
            <Select id="cs-o-stage" name="stage" defaultValue={editOpp?.stage ?? "idea"}>
              {OPPORTUNITY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {OPPORTUNITY_STAGE[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage note" htmlFor="cs-o-note" full>
            <Input id="cs-o-note" name="stage_note" maxLength={120} placeholder="e.g. Pitch on 5 Nov" defaultValue={editOpp?.stage_note ?? ""} />
          </Field>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rel-remove"
        title={`Remove ${removeTarget?.name ?? "contact"}'s personal data`}
        submitLabel="Remove for good"
        danger
        pending={pending}
        open={dlg === "remove"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!removeTarget) return;
          run(() => removePersonOnRequest({ clientId, personId: removeTarget.id }), "Personal data removed", () => {
            close();
            setRemoveId("");
          });
        }}
      >
        <p className="small" style={{ margin: 0 }}>
          This deletes {removeTarget?.name}&apos;s personal profile, their dates and their log entries. It can&apos;t be undone. We keep a
          record that the removal happened.
        </p>
      </FormDialog>
    </div>
  );
}

function tierHint(t: string | null | undefined) {
  if (t === "A") return "Top accounts by fee and potential";
  if (t === "B") return "Steady accounts";
  if (t === "C") return "Small or at-risk accounts";
  return undefined;
}

function PersonSelect({ id, people }: { id: string; people: RelPerson[] }) {
  return (
    <Select id={id} name="person_id" defaultValue="">
      <option value="">No one in particular</option>
      {people.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </Select>
  );
}

function DateList({ items, today, empty }: { items: { key: string; title: string; on: string; yearly?: boolean }[]; today: string; empty: string }) {
  if (!items.length)
    return (
      <p className="card-body small muted" style={{ margin: 0 }}>
        {empty}
      </p>
    );
  return (
    <div className="list">
      {items.map((m) => (
        <div key={m.key} className="item between">
          <span>{m.title}</span>
          <span className="small muted">{m.yearly ? shortDate(`${today.slice(0, 4)}${m.on.slice(4)}`, today) : shortDate(m.on, today)}</span>
        </div>
      ))}
    </div>
  );
}
