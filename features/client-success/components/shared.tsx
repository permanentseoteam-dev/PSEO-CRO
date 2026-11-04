"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, Dialog, useToast } from "@/components/ui";
import type { Result } from "../types";

/** Runs a server action, toasts the result, and calls onOk when it worked. */
export function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, okMessage: string, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(okMessage);
        onOk?.();
      } else toast(r.error);
    });
  return { pending, run };
}

/** Reads a form into a plain object of trimmed strings; checkboxes become booleans. */
export function formValues(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const form = e.currentTarget;
  const out: Record<string, string | boolean> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name) continue;
    out[el.name] = el.type === "checkbox" ? el.checked : String(el.value).trim();
  }
  return out as Record<string, string> & Record<string, boolean>;
}

export const numOrNull = (v: string) => (v === "" || v == null ? null : Number(v));
export const strOrNull = (v: string) => (v ? v : null);

/** A button that opens a dialog holding one form. The submit button sits in the dialog footer. */
export function FormDialog({
  id,
  title,
  trigger,
  submitLabel,
  pending,
  onSubmit,
  open,
  setOpen,
  danger,
  children,
}: {
  id: string;
  title: string;
  trigger?: (open: () => void) => ReactNode;
  submitLabel: string;
  pending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  open?: boolean;
  setOpen?: (v: boolean) => void;
  danger?: boolean;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(false);
  const isOpen = open ?? own;
  const set = setOpen ?? setOwn;
  return (
    <>
      {trigger?.(() => set(true))}
      <Dialog
        open={isOpen}
        onClose={() => set(false)}
        title={title}
        footer={
          <>
            <Button onClick={() => set(false)}>Cancel</Button>
            <Button type="submit" form={id} variant={danger ? "primary-danger" : "primary"} disabled={pending}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <form id={id} onSubmit={onSubmit}>
          {children}
        </form>
      </Dialog>
    </>
  );
}
