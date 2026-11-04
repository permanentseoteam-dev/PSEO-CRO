"use client";

import { useState, useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { REPEATS, REPEAT_LABEL, calHref, fmtShort, fmtT, isWeekend, toMin, type Repeat, type View } from "@/lib/modules/calendar/logic";
import type { CalEvent, ClientOption, Person, Visibility } from "@/lib/modules/calendar/types";
import { findTime, saveMeeting } from "../actions";
import type { CalMe } from "./calendar";
import s from "./calendar.module.css";

export type FormState = { kind: "client" | "internal"; event?: CalEvent };

const LENGTHS: [number, string][] = [
  [15, "15 min"],
  [30, "30 min"],
  [45, "45 min"],
  [60, "1 hour"],
  [90, "1 hour 30 min"],
  [120, "2 hours"],
];
const STARTS: string[] = [];
for (let m = 7 * 60; m <= 20 * 60 - 15; m += 15) STARTS.push(fmtT(m));

type Values = {
  clientId: string;
  title: string;
  date: string;
  start: string;
  minutes: number;
  guests: string;
  memberIds: string[];
  where: "meet" | "loc";
  meetLink: string;
  location: string;
  agenda: string;
  repeat: Repeat;
  visibility: Visibility;
  invite: boolean;
};

function initial(state: FormState, defaultDate: string): Values {
  const e = state.event;
  if (e)
    return {
      clientId: e.clientId ?? "",
      title: e.title,
      date: e.date,
      start: fmtT(e.start),
      minutes: e.mins,
      guests: e.guests.join(", "),
      memberIds: e.attendees.map((a) => a.id),
      where: e.meetLink || !e.location ? "meet" : "loc",
      meetLink: e.meetLink ?? "",
      location: e.location ?? "",
      agenda: e.agenda ?? "",
      repeat: e.repeat,
      visibility: e.visibility,
      invite: e.sendInvites,
    };
  return {
    clientId: "",
    title: "",
    date: defaultDate,
    start: "11:00",
    minutes: 30,
    guests: "",
    memberIds: [],
    where: "meet",
    meetLink: "",
    location: "",
    agenda: "",
    repeat: "none",
    visibility: state.kind === "client" ? "client" : "team",
    invite: true,
  };
}

export function MeetingForm(props: {
  state: FormState | null;
  onClose: () => void;
  me: CalMe;
  people: Person[];
  clients: ClientOption[];
  defaultDate: string;
  view: View;
  showCol: boolean;
}) {
  const [pending, start] = useTransition();
  const editing = !!props.state?.event;
  const title = editing ? "Edit meeting" : props.state?.kind === "client" ? "New client meeting" : "New meeting";
  return (
    <Dialog
      open={!!props.state}
      onClose={props.onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cal-form" variant="primary" disabled={pending}>
            {editing ? "Save changes" : "Create meeting"}
          </Button>
        </>
      }
    >
      {/* Dialog unmounts its body when closed, so the form starts fresh each time it opens. */}
      {props.state ? <FormBody {...props} state={props.state} pending={pending} start={start} /> : null}
    </Dialog>
  );
}

function FormBody({
  state,
  onClose,
  me,
  people,
  clients,
  defaultDate,
  view,
  showCol,
  pending,
  start,
}: {
  state: FormState;
  onClose: () => void;
  me: CalMe;
  people: Person[];
  clients: ClientOption[];
  defaultDate: string;
  view: View;
  showCol: boolean;
  pending: boolean;
  start: TransitionStartFunction;
}) {
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState<Values>(() => initial(state, defaultDate));
  const [slots, setSlots] = useState<{ note: string; times: string[] } | null>(null);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const editing = !!state.event;
  const others = (x: Values) => x.memberIds.filter((id) => id !== me.id);

  const find = () =>
    start(async () => {
      const r = await findTime({ date: v.date, minutes: v.minutes, memberIds: others(v) });
      if (!r.ok) return toast(r.error);
      const names = [me.name, ...others(v).map((id) => people.find((p) => p.id === id)?.name ?? "")]
        .filter(Boolean)
        .map((n) => n.split(" ")[0]);
      setSlots(
        isWeekend(v.date)
          ? { note: "That day is a weekend. Pick another date.", times: [] }
          : { note: r.slots.length ? `Free for ${names.join(", ")} on ${fmtShort(v.date)}:` : "No shared free time. Try another day.", times: r.slots },
      );
    });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    start(async () => {
      const r = await saveMeeting({ ...v, id: state.event?.id ?? "", memberIds: others(v) });
      if (!r.ok) return toast(r.error);
      toast(editing ? "Changes saved" : "Meeting created");
      onClose();
      router.push(calHref(view, r.date, showCol));
    });
  };

  return (
        <form id="cal-form" onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <FormGrid>
            <Field label="Client" htmlFor="cf-client">
              <Select
                id="cf-client"
                value={v.clientId}
                required={state.kind === "client"}
                onChange={(e) => {
                  set("clientId", e.target.value);
                  if (!e.target.value && v.visibility === "client") set("visibility", "team");
                }}
              >
                <option value="">No client (internal)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="cf-title">
              <Input id="cf-title" required maxLength={200} placeholder="e.g. Monthly report call" value={v.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="cf-date">
              <Input id="cf-date" type="date" required value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Start" htmlFor="cf-start">
              <Select id="cf-start" value={v.start} onChange={(e) => set("start", e.target.value)}>
                {(STARTS.includes(v.start) ? STARTS : [v.start, ...STARTS]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Length" htmlFor="cf-len">
              <Select id="cf-len" value={v.minutes} onChange={(e) => set("minutes", Number(e.target.value))}>
                {LENGTHS.map(([m, l]) => (
                  <option key={m} value={m}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Guests" htmlFor="cf-guests">
              <Input id="cf-guests" placeholder="client@company.com, another@company.com" value={v.guests} onChange={(e) => set("guests", e.target.value)} />
            </Field>
            <Field label="Team members" full>
              <div className={s.members}>
                {people.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.name}
                    checked={p.id === me.id || v.memberIds.includes(p.id)}
                    disabled={p.id === me.id}
                    onChange={(e) =>
                      set("memberIds", e.target.checked ? [...v.memberIds, p.id] : v.memberIds.filter((id) => id !== p.id))
                    }
                  />
                ))}
              </div>
            </Field>
            <div className={`field full ${s.findbox}`}>
              <div className="row between">
                <strong>Find a time</strong>
                <Button size="sm" disabled={pending} onClick={find}>
                  Find a time
                </Button>
              </div>
              <div className="small muted">{slots?.note ?? "Checks your calendar and the team members you pick, 09:00–18:00."}</div>
              {slots?.times.length ? (
                <div className={s.slots}>
                  {slots.times.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={v.start === t ? "primary" : "default"}
                      onClick={() => {
                        set("start", t);
                        toast(`Start set to ${t}`);
                      }}
                    >
                      {t}–{fmtT(toMin(t) + v.minutes)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            <Field label="Where" htmlFor="cf-where">
              <Select id="cf-where" value={v.where} onChange={(e) => set("where", e.target.value as Values["where"])}>
                <option value="meet">Google Meet</option>
                <option value="loc">In person</option>
              </Select>
            </Field>
            {v.where === "meet" ? (
              <Field label="Meet link" htmlFor="cf-meet">
                <Input id="cf-meet" placeholder="meet.google.com/abc-defg-hij" value={v.meetLink} onChange={(e) => set("meetLink", e.target.value)} />
              </Field>
            ) : (
              <Field label="Location" htmlFor="cf-loc">
                <Input id="cf-loc" placeholder="Office, board room" value={v.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
            )}
            <Field label="Agenda" htmlFor="cf-agenda" full>
              <Textarea
                id="cf-agenda"
                rows={3}
                placeholder="What you'll cover, and what you need from the client"
                value={v.agenda}
                onChange={(e) => set("agenda", e.target.value)}
              />
            </Field>
            <Field label="Repeat" htmlFor="cf-repeat">
              <Select id="cf-repeat" value={v.repeat} disabled={editing} onChange={(e) => set("repeat", e.target.value as Repeat)}>
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {REPEAT_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Visibility" htmlFor="cf-vis">
              <Select id="cf-vis" value={v.visibility} onChange={(e) => set("visibility", e.target.value as Visibility)}>
                <option value="team">Team can see details</option>
                <option value="private">Private: others see busy only</option>
                <option value="client" disabled={!v.clientId}>
                  Client can see it in their portal
                </option>
              </Select>
            </Field>
            <Checkbox
              className="field full"
              label="Notify team members"
              checked={v.invite}
              onChange={(e) => set("invite", e.target.checked)}
            />
          </FormGrid>
        </form>
  );
}
