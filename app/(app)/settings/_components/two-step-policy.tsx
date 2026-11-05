"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, useToast } from "@/components/ui";
import { saveTwoStepPolicy } from "../actions";

/** Admin: pick the staff roles that must use 2-step sign-in. */
export function TwoStepPolicy({ roles, required }: { roles: { key: string; name: string }[]; required: string[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(() => new Set(required));

  function flip(key: string, on: boolean) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="stack">
      <p className="muted m-0">People in these roles must set up an authenticator app before they can use the app. They are asked to at their next page load.</p>
      <div className="grid gap-2 min-[600px]:grid-cols-2" role="group" aria-label="Roles that require 2-step sign-in">
        {roles.map((r) => (
          <Checkbox key={r.key} label={r.name} checked={picked.has(r.key)} onChange={(e) => flip(r.key, e.currentTarget.checked)} />
        ))}
      </div>
      <div className="row">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTwoStepPolicy([...picked]);
              toast(r.ok ? (picked.size ? `2-step required for ${picked.size} role${picked.size === 1 ? "" : "s"}` : "2-step is optional for everyone") : r.error);
            })
          }
        >
          Save policy
        </Button>
      </div>
    </div>
  );
}
