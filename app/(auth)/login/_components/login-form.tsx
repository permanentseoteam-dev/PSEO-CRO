"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Field, Input, Seg } from "@/components/ui";
import { sendLoginCode, signInWithPassword, verifyLoginCode } from "../../actions";

type Method = "password" | "code";

export function LoginForm({ next, initialEmail, initialError }: { next?: string; initialEmail: string; initialError?: string }) {
  const [step, setStep] = useState<"email" | "auth">("email");
  const [email, setEmail] = useState(initialEmail);
  const [method, setMethod] = useState<Method>("password");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) => {
    setError(undefined);
    setInfo(undefined);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onOk?.();
    });
  };

  const sendCode = () =>
    run(
      () => sendLoginCode({ email }),
      () => {
        setCodeSent(true);
        setInfo(`We sent a 6-digit code to ${email}.`);
      },
    );

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>Sign in</h1>
        <p className="muted">{step === "email" ? "Use your work email." : email}</p>
      </div>

      {step === "email" ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            setStep("auth");
          }}
        >
          <Field label="Work email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <div className="grid gap-4">
          <div className="row between">
            <Seg
              label="Sign-in method"
              value={method}
              onChange={(v) => {
                setMethod(v as Method);
                setError(undefined);
                setInfo(undefined);
              }}
              items={[
                { value: "password", label: "Password" },
                { value: "code", label: "Email code" },
              ]}
            />
            <Button variant="ghost" size="sm" onClick={() => { setStep("email"); setCodeSent(false); setError(undefined); setInfo(undefined); }}>
              Change email
            </Button>
          </div>

          {method === "password" ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const password = String(new FormData(e.currentTarget).get("password") ?? "");
                run(() => signInWithPassword({ email, password, next }));
              }}
            >
              {/* Hidden username keeps password managers happy on the second step. */}
              <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
              <div className="field">
                <div className="row between">
                  <label htmlFor="login-password">Password</label>
                  <Link href={`/reset?email=${encodeURIComponent(email)}`} className="small">
                    Forgot password?
                  </Link>
                </div>
                <Input id="login-password" name="password" type="password" autoComplete="current-password" required autoFocus />
              </div>
              <Button type="submit" variant="primary" className="w-full" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : !codeSent ? (
            <div className="grid gap-4">
              <p className="muted">We&apos;ll email you a 6-digit code. It works for a few minutes.</p>
              <Button variant="primary" className="w-full" disabled={pending} onClick={sendCode}>
                {pending ? "Sending…" : "Email me a code"}
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code") ?? "");
                run(() => verifyLoginCode({ email, code, next }));
              }}
            >
              <div className="field">
                <div className="row between">
                  <label htmlFor="login-code">6-digit code</label>
                  <button type="button" className="small border-0 bg-transparent p-0 text-accent-ink" onClick={sendCode} disabled={pending}>
                    Send a new code
                  </button>
                </div>
                <Input
                  id="login-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" variant="primary" className="w-full" disabled={pending}>
                {pending ? "Checking…" : "Sign in"}
              </Button>
            </form>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : info ? (
        <p role="status" className="muted">
          {info}
        </p>
      ) : null}
    </div>
  );
}
