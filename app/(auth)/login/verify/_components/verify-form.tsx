"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { verifyTwoStep } from "../../../actions";

export function VerifyForm({ next, email }: { next?: string; email: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>2-step sign-in</h1>
        <p className="muted">{email}</p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const code = String(new FormData(e.currentTarget).get("code") ?? "");
          setError(undefined);
          start(async () => {
            const res = await verifyTwoStep({ code, next });
            if (!res.ok) setError(res.error);
          });
        }}
      >
        <Field label="Enter the 6-digit code from your authenticator app" htmlFor="mfa-code">
          <Input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="ghost" size="sm">
          Use a different account
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
