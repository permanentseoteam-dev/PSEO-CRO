"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { acceptInvite } from "../../../actions";

export function AcceptForm({ token, email, defaultName }: { token: string; email: string; defaultName: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(undefined);
        start(async () => {
          const res = await acceptInvite({ token, name: fd.get("name"), password: fd.get("password") });
          if (!res.ok) setError(res.error);
        });
      }}
    >
      <Field label="Work email" htmlFor="inv-email">
        <Input id="inv-email" name="username" type="email" autoComplete="username" value={email} readOnly />
      </Field>
      <Field label="Your name" htmlFor="inv-name">
        <Input id="inv-name" name="name" autoComplete="name" defaultValue={defaultName} required minLength={2} autoFocus={!defaultName} />
      </Field>
      <Field label="Password" htmlFor="inv-password" hint="At least 8 characters.">
        <Input id="inv-password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus={Boolean(defaultName)} />
      </Field>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Setting up…" : "Create account"}
      </Button>
    </form>
  );
}
