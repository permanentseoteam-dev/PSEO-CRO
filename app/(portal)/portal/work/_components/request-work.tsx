"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Input, Textarea, useToast } from "@/components/ui";
import { requestWork } from "../../actions";

/** "Request new work" button and form. Sending it opens a ticket and starts the team's reply clock. */
export function RequestWork({ today }: { today: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Request new work
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Request new work"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="portal-request" disabled={pending}>
              Send request
            </Button>
          </>
        }
      >
        <form
          id="portal-request"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await requestWork({ what: f.get("what"), due: f.get("due") });
              if (!r.ok) return toast(r.error);
              toast("Request sent. We will reply soon.");
              setOpen(false);
            });
          }}
        >
          <FormGrid>
            <Field label="What you need" htmlFor="pwr-what" full>
              <Textarea id="pwr-what" name="what" rows={4} required minLength={3} maxLength={4000} placeholder="For example: ads for our Ramadan service offer" />
            </Field>
            <Field label="By when" htmlFor="pwr-when">
              <Input id="pwr-when" name="due" type="date" min={today} />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}
