"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button, Checkbox, Dialog, Field, FormGrid, IconButton, Input, Select, useToast } from "@/components/ui";
import { scheduleChannelMeeting } from "../actions";
import { MEETING_MINUTES, meetingWhen } from "../logic";
import type { Person } from "../types";

type Props = {
  channelId: string;
  meId: string;
  /** Staff in this conversation (getChannelExtras().staff). */
  people: Person[];
  /** Default date, e.g. tomorrow (YYYY-MM-DD). */
  defaultDate: string;
};

/** Calendar button in the conversation header: books a calendar event with chosen members and posts a note. */
export function ScheduleMeeting({ channelId, meId, people, defaultDate }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const others = people.filter((p) => p.id !== meId);
  const [picked, setPicked] = useState<string[]>([]);

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const date = String(f.get("date"));
    const time = String(f.get("time"));
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime())) {
      toast("Pick a date and time");
      return;
    }
    start(async () => {
      const res = await scheduleChannelMeeting({
        channelId,
        title: f.get("title"),
        startsAt: startsAt.toISOString(),
        when: meetingWhen(date, time),
        minutes: f.get("minutes"),
        attendees: picked,
      });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast("Meeting scheduled and invites sent");
      setOpen(false);
      setPicked([]);
      router.refresh();
    });
  }

  return (
    <>
      <IconButton label="Schedule meeting" onClick={() => setOpen(true)}>
        <CalendarPlus size={16} />
      </IconButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule meeting"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="chat-p2-meeting" disabled={pending}>Schedule</Button>
          </>
        }
      >
        <form
          id="chat-p2-meeting"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="stack"
          style={{ gap: 14 }}
        >
          <FormGrid>
            <Field label="Title" htmlFor="cp2-mt-title" full>
              <Input id="cp2-mt-title" name="title" required maxLength={200} />
            </Field>
            <Field label="Date" htmlFor="cp2-mt-date">
              <Input id="cp2-mt-date" name="date" type="date" required defaultValue={defaultDate} />
            </Field>
            <Field label="Time" htmlFor="cp2-mt-time">
              <Input id="cp2-mt-time" name="time" type="time" required defaultValue="15:00" />
            </Field>
            <Field label="Duration" htmlFor="cp2-mt-min">
              <Select id="cp2-mt-min" name="minutes" defaultValue="30">
                {MEETING_MINUTES.map((m) => (
                  <option key={m} value={m}>{m === 60 ? "1 hour" : `${m} minutes`}</option>
                ))}
              </Select>
            </Field>
            <Field label="Video link" hint="Connect Google in Settings to add Meet links.">
              <Checkbox label="Add Google Meet link" name="meet" disabled />
            </Field>
          </FormGrid>
          <Field label={`Attendees (${picked.length})`}>
            {others.length === 0 ? (
              <span className="small muted">No one else in this conversation yet.</span>
            ) : (
              <div className="stack" style={{ maxHeight: 200, overflowY: "auto" }}>
                {others.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.name}
                    checked={picked.includes(p.id)}
                    onChange={(e) => setPicked((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                  />
                ))}
              </div>
            )}
          </Field>
        </form>
      </Dialog>
    </>
  );
}
