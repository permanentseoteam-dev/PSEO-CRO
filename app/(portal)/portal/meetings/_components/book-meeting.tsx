"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { bookMeeting } from "../../actions";

const TIMES = ["10:00", "11:00", "14:00", "16:00"];

/** "Book a meeting": goes to the team as a request with a reply clock. */
export function BookMeeting({ team, today, readOnly = false }: { team: string[]; today: string; readOnly?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="primary" disabled={readOnly} onClick={() => setOpen(true)}>
        Book a meeting
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Book a meeting"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="portal-book" disabled={pending}>
              Send booking request
            </Button>
          </>
        }
      >
        <form
          id="portal-book"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await bookMeeting({
                topic: f.get("topic"),
                day: f.get("day"),
                time: f.get("time"),
                attendees: f.getAll("who").map(String),
                note: f.get("note") || undefined,
              });
              if (!r.ok) return toast(r.error);
              toast("Booking request sent");
              setOpen(false);
            });
          }}
        >
          <FormGrid>
            <Field label="Topic" htmlFor="pmb-topic" full>
              <Input id="pmb-topic" name="topic" required minLength={3} maxLength={200} placeholder="For example: Black Friday plans" />
            </Field>
            <Field label="Preferred day" htmlFor="pmb-day">
              <Input id="pmb-day" name="day" type="date" required min={today} />
            </Field>
            <Field label="Time" htmlFor="pmb-time">
              <Select id="pmb-time" name="time" defaultValue="11:00">
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            {team.length ? (
              <Field label="Attendees" full>
                {team.map((n) => (
                  <Checkbox key={n} name="who" value={n} defaultChecked label={n} />
                ))}
              </Field>
            ) : null}
            <Field label="Note" htmlFor="pmb-note" full>
              <Textarea id="pmb-note" name="note" rows={3} maxLength={2000} placeholder="Anything we should prepare" />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}
