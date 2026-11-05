"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, StatusDot } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Enroll = { factorId: string; qr: string; secret: string };
type Mode = "checking" | "off" | "setup" | "on" | "turning-off";

const CODE = /^\d{6}$/;
const codeError = "Enter the 6-digit code from your authenticator app.";
const wrongCode = (m: string) => (/invalid|expired/i.test(m) ? "That code isn't right. Check your app and try again." : m);

/**
 * 2-step sign-in with an authenticator app (Supabase Auth TOTP).
 * `required`: the admin requires it for this person's role, so it can't be turned off.
 * `onEnabled`: called after a successful setup (the sign-in setup page uses it to continue).
 * `onChange`: told whether 2-step is on, after loading and after each change.
 */
export function TwoStep({ required = false, onEnabled, onChange }: { required?: boolean; onEnabled?: () => void; onChange?: (on: boolean) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [factorId, setFactorId] = useState<string>();
  const [enroll, setEnroll] = useState<Enroll>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const f = data?.totp[0];
        setFactorId(f?.id);
        setMode(f ? "on" : "off");
        onChange?.(!!f);
      })
      .catch(() => setMode("off"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  function begin() {
    setError(undefined);
    start(async () => {
      const mfa = createClient().auth.mfa;
      // Clear half-finished setups so the new one gets a fresh secret.
      const { data: list } = await mfa.listFactors();
      for (const f of list?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await mfa.unenroll({ factorId: f.id });
      const { data, error: err } = await mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app", issuer: "Permanent SEO" });
      if (err || !data) return setError(err?.message ?? "Couldn't start setup. Try again.");
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setMode("setup");
    });
  }

  function confirm(code: string) {
    if (!CODE.test(code)) return setError(codeError);
    if (!enroll) return;
    setError(undefined);
    start(async () => {
      const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code });
      if (err) return setError(wrongCode(err.message));
      setFactorId(enroll.factorId);
      setEnroll(undefined);
      setMode("on");
      onChange?.(true);
      if (onEnabled) onEnabled();
      else router.refresh();
    });
  }

  function cancelSetup() {
    const id = enroll?.factorId;
    setEnroll(undefined);
    setError(undefined);
    setMode("off");
    if (id) start(async () => void (await createClient().auth.mfa.unenroll({ factorId: id })));
  }

  function turnOff(code: string) {
    if (!CODE.test(code)) return setError(codeError);
    if (!factorId) return;
    setError(undefined);
    start(async () => {
      const mfa = createClient().auth.mfa;
      const v = await mfa.challengeAndVerify({ factorId, code });
      if (v.error) return setError(wrongCode(v.error.message));
      const { error: err } = await mfa.unenroll({ factorId });
      if (err) return setError(err.message);
      setFactorId(undefined);
      setMode("off");
      onChange?.(false);
      router.refresh();
    });
  }

  const codeForm = (id: string, label: string, submit: string, onCode: (c: string) => void, onCancel: () => void) => (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onCode(String(new FormData(e.currentTarget).get("code") ?? "").trim());
      }}
    >
      <Field label={label} htmlFor={id}>
        <Input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="max-w-[180px]" />
      </Field>
      <div className="row">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Checking…" : submit}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="stack">
      {mode === "checking" ? (
        <span className="muted">Checking…</span>
      ) : mode === "off" ? (
        <div className="row between">
          <StatusDot tone="warn">Off</StatusDot>
          <Button variant="primary" disabled={pending} onClick={begin}>
            {pending ? "Starting…" : "Turn on 2-step sign-in"}
          </Button>
        </div>
      ) : mode === "setup" && enroll ? (
        <div className="stack">
          <p className="m-0">Scan this code with an authenticator app such as Google Authenticator, 1Password or Authy.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-[var(--radius-ctl)] border border-line bg-surface p-2" />
          <Field label="Can't scan? Enter this key in the app" htmlFor="mfa-secret">
            <Input id="mfa-secret" readOnly value={enroll.secret} onFocus={(e) => e.currentTarget.select()} className="font-mono" />
          </Field>
          {codeForm("mfa-setup-code", "6-digit code from the app", "Turn on", confirm, cancelSetup)}
        </div>
      ) : mode === "on" ? (
        <div className="row between">
          <StatusDot tone="ok">On with authenticator app</StatusDot>
          {required ? (
            <span className="muted small">Required for your role</span>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => (setError(undefined), setMode("turning-off"))}>
              Turn off
            </Button>
          )}
        </div>
      ) : mode === "turning-off" ? (
        <div className="stack">
          <StatusDot tone="ok">On with authenticator app</StatusDot>
          {codeForm("mfa-off-code", "Enter a current code to turn 2-step off", "Turn off", turnOff, () => (setError(undefined), setMode("on")))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
