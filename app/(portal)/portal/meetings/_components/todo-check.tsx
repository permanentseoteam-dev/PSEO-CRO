"use client";

import { useState, useTransition } from "react";
import { Checkbox, useToast } from "@/components/ui";
import { setTodo } from "../../actions";

/** A meeting to-do the client ticks off. */
export function TodoCheck({ id, title, done, disabled }: { id: string; title: string; done: boolean; disabled?: boolean }) {
  const toast = useToast();
  const [checked, setChecked] = useState(done);
  const [pending, start] = useTransition();
  return (
    <Checkbox
      label={title}
      checked={checked}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.checked;
        setChecked(next);
        start(async () => {
          const r = await setTodo({ id, done: next });
          if (!r.ok) {
            setChecked(!next);
            return toast(r.error);
          }
          toast(next ? `Marked done: ${title}` : `Marked not done: ${title}`);
        });
      }}
    />
  );
}
