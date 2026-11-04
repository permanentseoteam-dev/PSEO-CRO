"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink, Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../../actions";

export function ResetForm({ initialEmail, initialError }: { initialEmail: string; initialError?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState(initialError);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="grid gap-5">
        <div className="grid gap-1">
          <h1>Check your email</h1>
          <p className="muted">If {email} has an account, we sent a link to set a new password.</p>
        </div>
        <ButtonLink href="/login" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await requestPasswordReset({ email });
          if (res.ok) setSent(true);
          else setError(res.error);
        });
      }}
    >
      <div className="grid gap-1">
        <h1>Reset your password</h1>
        <p className="muted">We&apos;ll email you a link to set a new one.</p>
      </div>
      <Field label="Work email" htmlFor="reset-email">
        <Input id="reset-email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
