"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { setNewPassword } from "../../../actions";

export function NewPasswordForm({ email }: { email: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(undefined);
        start(async () => {
          const res = await setNewPassword({ password: fd.get("password"), confirm: fd.get("confirm") });
          if (!res.ok) setError(res.error);
        });
      }}
    >
      <div className="grid gap-1">
        <h1>Set a new password</h1>
        <p className="muted">{email}</p>
      </div>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="New password" htmlFor="np-password" hint="At least 8 characters.">
        <Input id="np-password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </Field>
      <Field label="Type it again" htmlFor="np-confirm">
        <Input id="np-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
