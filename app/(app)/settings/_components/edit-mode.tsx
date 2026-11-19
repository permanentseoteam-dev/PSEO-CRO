"use client";

import { Pencil } from "lucide-react";
import { createContext, Fragment, useContext, useState, useTransition, type ReactNode } from "react";
import { Button, IconButton, useToast } from "@/components/ui";

type Edit = { editing: boolean; setEditing: (on: boolean) => void };

/** Read or edit state of the settings card around a form. Set by an editable `Section`. */
export const EditCtx = createContext<Edit>({ editing: true, setEditing: () => {} });
export const useEditing = () => useContext(EditCtx);

/** Pencil button for a card header. */
export function EditToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton size="sm" label={`Edit ${label}`} onClick={onClick}>
      <Pencil size={14} />
    </IconButton>
  );
}

/** Saved values shown as compact label/value rows. */
export function ReadRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 min-[480px]:grid-cols-[160px_minmax(0,1fr)] min-[480px]:gap-y-2">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-ink-3">{k}</dt>
          <dd className="m-0 mb-2 min-w-0 break-words last:mb-0 min-[480px]:mb-0">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Save and Cancel for a card in edit mode. Save is a submit button when `onSave` is left out. */
export function SaveCancel({ pending, disabled, onSave, onCancel }: { pending: boolean; disabled?: boolean; onSave?: () => void; onCancel: () => void }) {
  return (
    <div className="row pt-1">
      <Button variant="primary" type={onSave ? "button" : "submit"} disabled={pending || disabled} onClick={onSave}>
        Save
      </Button>
      <Button variant="ghost" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * Saved and draft values for an editable card. `save` runs the action and, on success, keeps the
 * draft as the saved value and returns to read mode. `cancel` drops the draft.
 */
export function useCardSave<T>(initial: T) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const { editing, setEditing } = useEditing();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  function save(run: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) {
    const next = draft;
    start(async () => {
      const r = await run();
      toast(r.ok ? msg : r.error);
      if (r.ok) {
        setSaved(next);
        setEditing(false);
      }
    });
  }
  function cancel() {
    setDraft(saved);
    setEditing(false);
  }
  return { pending, editing, saved, setSaved, draft, setDraft, save, cancel };
}
