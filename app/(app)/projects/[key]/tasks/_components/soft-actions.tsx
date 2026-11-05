"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ListPlus, Paperclip, Play } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { startTimer } from "@/lib/modules/tickets/actions";

/** Shortcut row under the properties. Subtasks, files and the log-time dialog live further down / in the property list, so these jump there. */
export function SoftActions({ ticketId, canEdit, hasSubtasks }: { ticketId: string; canEdit: boolean; hasSubtasks: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Clicks the first matching button inside a section once it is on screen.
  const press = (id: string, label: RegExp) => {
    jump(id);
    const btn = [...(document.getElementById(id)?.querySelectorAll("button") ?? [])].find((b) => label.test(b.textContent ?? ""));
    btn?.click();
  };

  function timer() {
    start(async () => {
      const r = await startTimer({ ticketId });
      toast(r.ok ? "Timer started" : r.error);
      router.refresh();
    });
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {hasSubtasks && canEdit ? (
        <Button size="sm" variant="ghost" onClick={() => press("tp-subtasks", /^add subtask$/i)}>
          <ListPlus size={15} aria-hidden="true" /> Add subtask
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => press("tp-files", /^upload$/i)}>
        <Paperclip size={15} aria-hidden="true" /> Attach file
      </Button>
      <Button size="sm" variant="ghost" onClick={timer} disabled={pending}>
        <Play size={15} aria-hidden="true" /> Start timer
      </Button>
      <Button size="sm" variant="ghost" onClick={() => press("tp-props", /^log time$/i)}>
        <Clock size={15} aria-hidden="true" /> Log time
      </Button>
    </div>
  );
}
