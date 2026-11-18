"use client";

import { Checkbox } from "@/components/ui";
import { saveTwoStepPolicy } from "../actions";
import { ReadRows, SaveCancel, useCardSave } from "./edit-mode";

/** Admin: pick the staff roles that must use 2-step sign-in. */
export function TwoStepPolicy({ roles, required }: { roles: { key: string; name: string }[]; required: string[] }) {
  const c = useCardSave(required);
  const picked = new Set(c.draft);

  function flip(key: string, on: boolean) {
    c.setDraft(on ? [...c.draft, key] : c.draft.filter((k) => k !== key));
  }

  const names = roles.filter((r) => c.saved.includes(r.key)).map((r) => r.name);
  return (
    <div className="stack">
      <p className="muted m-0">People in these roles must set up an authenticator app before they can use the app. They are asked to at their next page load.</p>
      {c.editing ? (
        <>
          <div className="grid gap-2 min-[600px]:grid-cols-2" role="group" aria-label="Roles that require 2-step sign-in">
            {roles.map((r) => (
              <Checkbox key={r.key} label={r.name} checked={picked.has(r.key)} onChange={(e) => flip(r.key, e.currentTarget.checked)} />
            ))}
          </div>
          <SaveCancel
            pending={c.pending}
            onSave={() =>
              c.save(
                () => saveTwoStepPolicy(c.draft),
                c.draft.length ? `2-step required for ${c.draft.length} role${c.draft.length === 1 ? "" : "s"}` : "2-step is optional for everyone",
              )
            }
            onCancel={c.cancel}
          />
        </>
      ) : (
        <ReadRows rows={[["Required for", names.length ? names.join(", ") : "No roles, optional for everyone"]]} />
      )}
    </div>
  );
}
