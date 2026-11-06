"use client";

import { ListPlus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui";

/** Open the existing subtask and attachment controls without duplicating their forms. */
export function SoftActions({ canEdit, hasSubtasks }: { canEdit: boolean; hasSubtasks: boolean }) {
  const press = (id: string, label: RegExp) => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const button = [...(section?.querySelectorAll("button") ?? [])].find((b) => label.test(b.textContent ?? ""));
    button?.click();
  };

  return (
    <>
      {hasSubtasks && canEdit ? (
        <Button size="sm" variant="ghost" onClick={() => press("tp-subtasks", /^add subtask$/i)}>
          <ListPlus size={15} aria-hidden="true" /> Add subtask
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => press("tp-files", /^upload$/i)}>
        <Paperclip size={15} aria-hidden="true" /> Attach file
      </Button>
    </>
  );
}
