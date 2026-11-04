"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { markUpdatesRead } from "../actions";

/** Opens the shell's New ticket dialog (same as the top bar button or the C key). */
export function NewTicketButton() {
  const router = useRouter();
  const open = () => {
    const btn = document.querySelector<HTMLButtonElement>("button.new-ticket");
    if (btn) btn.click();
    else router.push("/tickets");
  };
  return (
    <Button variant="primary" onClick={open}>
      New ticket
    </Button>
  );
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await markUpdatesRead();
          toast(res.ok ? "All updates marked as read" : res.error);
          if (res.ok) router.refresh();
        })
      }
    >
      Mark all read
    </Button>
  );
}

export function DeptSelect({ value, options }: { value: string; options: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Department"
      className="w-auto"
      value={value}
      onChange={(e) => router.push(`/home?dept=${e.target.value}`, { scroll: false })}
    >
      {options.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
