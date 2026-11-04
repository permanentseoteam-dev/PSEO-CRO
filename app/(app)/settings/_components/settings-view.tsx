"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, Card, CardBody, CardHead, Field, FormGrid, Input, PhaseTwo, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_HINT } from "@/lib/modules/personal/logic";
import type { NotifEvent } from "@/lib/modules/personal/types";
import { saveDesign, saveEmail, saveNotif, saveProfile, saveQuiet } from "../actions";

type Notif = { event: NotifEvent; label: string; inApp: boolean; email: boolean; phone: boolean };
type Props = {
  email: string;
  name: string;
  isStaff: boolean;
  isAdmin: boolean;
  initial: {
    theme: "system" | "light" | "dark";
    density: "comfortable" | "compact";
    email: "daily" | "urgent" | "off";
    quietFrom: string;
    quietTo: string;
    slackUserId: string;
    notif: Notif[];
  };
};

const SECTIONS: [string, string][] = [
  ["design", "Design"],
  ["notif", "Notifications"],
  ["email", "Email"],
  ["quiet", "Quiet hours"],
  ["profile", "Profile"],
  ["push", "Phone alerts"],
  ["security", "Sign-in & security"],
];
const ADMIN: [string, string, string | null][] = [
  ["roles", "Roles & permissions", "/admin/roles"],
  ["invites", "Invites", "/admin/invites"],
  ["people", "People", "/admin/people"],
  ["audit", "Audit log", "/admin/audit"],
  ["portal", "Client portal design", null],
  ["api", "API keys", null],
];

const noSubscribe = () => () => {};

/** Segmented control with buttons (local, not URL-driven). */
function SegButtons<T extends string>({ label, items, value, onChange }: { label: string; items: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([v, l]) => (
        <button key={v} type="button" className={v === value ? "on" : undefined} aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Section({ id, title, actions, children }: { id: string; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card id={`pf-${id}`} data-sec={id} className="scroll-mt-4">
      <CardHead title={title} actions={actions} />
      <CardBody className="stack">{children}</CardBody>
    </Card>
  );
}

export function SettingsView({ email, name, isStaff, isAdmin, initial }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [active, setActive] = useState("design");
  const root = useRef<HTMLDivElement>(null);

  // scroll-spy
  useEffect(() => {
    const secs = root.current?.querySelectorAll<HTMLElement>("[data-sec]");
    if (!secs?.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive((vis[0].target as HTMLElement).dataset.sec!);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(`pf-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  // ---------------------------------------------------------------- design
  const [theme, setTheme] = useState(initial.theme);
  const [density, setDensity] = useState(initial.density);
  function design(next: { theme: typeof theme; density: typeof density }, msg: string) {
    const html = document.documentElement;
    if (next.theme === "system") delete html.dataset.theme;
    else html.dataset.theme = next.theme;
    if (next.density === "compact") html.dataset.density = "compact";
    else delete html.dataset.density;
    setTheme(next.theme);
    setDensity(next.density);
    start(async () => {
      const r = await saveDesign(next);
      toast(r.ok ? msg : r.error);
    });
  }

  // ---------------------------------------------------------------- notifications, email, quiet hours
  const [notif, setNotif] = useState(initial.notif);
  function toggle(i: number, ch: "inApp" | "email" | "phone", on: boolean) {
    const row = { ...notif[i], [ch]: on };
    setNotif((cur) => cur.map((r, j) => (j === i ? row : r)));
    start(async () => {
      const r = await saveNotif({ event: row.event, inApp: row.inApp, email: row.email, phone: row.phone });
      if (!r.ok) {
        setNotif((cur) => cur.map((x, j) => (j === i ? notif[i] : x)));
        toast(r.error);
      }
    });
  }

  const [mail, setMail] = useState(initial.email);
  const [qFrom, setQFrom] = useState(initial.quietFrom);
  const [qTo, setQTo] = useState(initial.quietTo);
  function quiet(from: string, to: string) {
    setQFrom(from);
    setQTo(to);
    start(async () => {
      const r = await saveQuiet({ from, to });
      toast(r.ok ? (from ? `Quiet hours set to ${from} to ${to}` : "Quiet hours off") : r.error);
    });
  }

  // ---------------------------------------------------------------- profile
  function profile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await saveProfile({ name: f.name, slackUserId: f.slackUserId ?? "" });
      toast(r.ok ? "Profile saved" : r.error);
    });
  }

  // ---------------------------------------------------------------- phone alerts (browser permission)
  type PushState = "unsupported" | "default" | "granted" | "denied";
  const browserPush = useSyncExternalStore<PushState>(
    noSubscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "default",
  );
  const [asked, setPush] = useState<PushState | null>(null);
  const push = asked ?? browserPush;
  async function enablePush() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPush(p);
    toast(p === "granted" ? "Push alerts on" : "Your browser blocked alerts. Allow them in the site settings.");
  }

  // ---------------------------------------------------------------- security
  const [twoStep, setTwoStep] = useState<boolean | null>(null);
  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => setTwoStep(!!data?.totp?.some((f) => f.status === "verified")))
      .catch(() => setTwoStep(false));
  }, []);

  function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if ((f.next ?? "").length < 10) return toast("Use at least 10 characters for the new password.");
    start(async () => {
      const sb = createClient();
      const check = await sb.auth.signInWithPassword({ email, password: f.current ?? "" });
      if (check.error) return toast("Your current password isn't right.");
      const { error } = await sb.auth.updateUser({ password: f.next });
      if (error) return toast(error.message);
      form.reset();
      toast("Password changed");
    });
  }

  function signOutOthers() {
    start(async () => {
      const { error } = await createClient().auth.signOut({ scope: "others" });
      toast(error ? error.message : "Signed out everywhere else");
    });
  }

  const navLink = (id: string, label: ReactNode) => (
    <a
      key={id}
      href={`#pf-${id}`}
      onClick={(e) => {
        e.preventDefault();
        go(id);
      }}
      className={`whitespace-nowrap rounded-[var(--radius)] px-2.5 py-[7px] no-underline hover:bg-surface-2 ${active === id ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2"}`}
    >
      {label}
    </a>
  );

  return (
    <div ref={root} className="grid items-start gap-6 min-[901px]:grid-cols-[200px_1fr]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto min-[901px]:sticky min-[901px]:top-3 min-[901px]:flex-col min-[901px]:gap-0.5">
        {SECTIONS.map(([id, l]) => navLink(id, l))}
        {isAdmin ? (
          <>
            <h4 className="mx-2.5 mb-1 mt-3.5 text-[13px] font-semibold text-ink-3 max-[900px]:hidden">Admin</h4>
            {navLink("admin", "Admin pages")}
          </>
        ) : null}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        <Section id="design" title="Design">
          <Field label="Theme">
            <SegButtons label="Theme" value={theme} items={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => design({ theme: v, density }, `Theme set to ${v}`)} />
          </Field>
          <Field label="Density">
            <SegButtons label="Density" value={density} items={[["comfortable", "Comfortable"], ["compact", "Compact"]]} onChange={(v) => design({ theme, density: v }, `Density set to ${v}`)} />
          </Field>
        </Section>

        <Section id="notif" title="Notifications">
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>In app</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
              </tr>
            </thead>
            <tbody>
              {notif.map((r, i) => (
                <tr key={r.event}>
                  <Td>{r.label}</Td>
                  {(["inApp", "email", "phone"] as const).map((ch) => (
                    <Td key={ch}>
                      <input type="checkbox" aria-label={`${r.label}: ${ch === "inApp" ? "in app" : ch}`} checked={r[ch]} onChange={(e) => toggle(i, ch, e.currentTarget.checked)} />
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section id="email" title="Email">
          <Field label="Send me email" hint={EMAIL_HINT[mail]}>
            <SegButtons
              label="Send me email"
              value={mail}
              items={[["daily", "Daily digest"], ["urgent", "Urgent only"], ["off", "Off"]]}
              onChange={(v) => {
                setMail(v);
                start(async () => {
                  const r = await saveEmail(v);
                  if (!r.ok) toast(r.error);
                });
              }}
            />
          </Field>
        </Section>

        <Section id="quiet" title="Quiet hours">
          <div className="row items-end">
            <Field label="From" htmlFor="pf-qfrom">
              <Input id="pf-qfrom" type="time" value={qFrom} onChange={(e) => setQFrom(e.currentTarget.value)} onBlur={() => (qFrom && qTo) || (!qFrom && !qTo) ? quiet(qFrom, qTo) : undefined} />
            </Field>
            <Field label="To" htmlFor="pf-qto">
              <Input id="pf-qto" type="time" value={qTo} onChange={(e) => setQTo(e.currentTarget.value)} onBlur={() => (qFrom && qTo) || (!qFrom && !qTo) ? quiet(qFrom, qTo) : undefined} />
            </Field>
            <Button disabled={pending} onClick={() => quiet("22:00", "08:00")}>Use 22:00 to 08:00</Button>
          </div>
          <p className="muted m-0">No phone alerts in these hours, except urgent client escalations.</p>
        </Section>

        <Section id="profile" title="Profile">
          <form onSubmit={profile} className="stack">
            <FormGrid>
              {isStaff ? (
                <Field label="Slack user ID" htmlFor="pf-slack">
                  <Input id="pf-slack" name="slackUserId" maxLength={30} defaultValue={initial.slackUserId} placeholder="U04QJ7K2M1P" />
                </Field>
              ) : null}
              <Field label="Display name" htmlFor="pf-name">
                <Input id="pf-name" name="name" minLength={2} maxLength={80} required defaultValue={name} />
              </Field>
            </FormGrid>
            <div className="row">
              <Button variant="primary" type="submit" disabled={pending}>Save profile</Button>
            </div>
          </form>
        </Section>

        <Section id="push" title="Phone alerts">
          <div className="row between">
            {push === "granted" ? (
              <StatusDot tone="ok">On for this browser</StatusDot>
            ) : push === "denied" ? (
              <StatusDot tone="danger">Blocked in this browser</StatusDot>
            ) : push === "unsupported" ? (
              <StatusDot tone="muted">This browser can&apos;t show alerts</StatusDot>
            ) : (
              <StatusDot tone="muted">Not on for this browser</StatusDot>
            )}
            <Button variant="primary" disabled={push !== "default"} onClick={enablePush}>
              {push === "granted" ? "Push is on" : "Enable push"}
            </Button>
          </div>
        </Section>

        <Section id="security" title="Sign-in & security">
          <form onSubmit={password} className="stack">
            <FormGrid>
              <Field label="Current password" htmlFor="pf-cur">
                <Input id="pf-cur" name="current" type="password" autoComplete="current-password" required />
              </Field>
              <Field label="New password" htmlFor="pf-new" hint="At least 10 characters">
                <Input id="pf-new" name="next" type="password" autoComplete="new-password" minLength={10} required />
              </Field>
            </FormGrid>
            <div className="row">
              <Button type="submit" disabled={pending}>Change password</Button>
            </div>
          </form>
          <h4 className="mt-3">Sessions</h4>
          <div className="row between">
            <span>Signed in on this device</span>
            <Button size="sm" variant="ghost" disabled={pending} onClick={signOutOthers}>Sign out everywhere else</Button>
          </div>
          <h4 className="mt-3">2-step sign-in</h4>
          <div className="row between">
            {twoStep === null ? (
              <span className="muted">Checking…</span>
            ) : twoStep ? (
              <StatusDot tone="ok">On with authenticator app</StatusDot>
            ) : (
              <StatusDot tone="warn">Off</StatusDot>
            )}
            <Button disabled>
              Turn on 2-step<PhaseTwo />
            </Button>
          </div>
        </Section>

        {isAdmin ? (
          <Section id="admin" title="Admin">
            <div className="list">
              {ADMIN.map(([id, label, href]) => (
                <div key={id} className="item between">
                  <span>
                    {label}
                    {href ? null : <PhaseTwo />}
                  </span>
                  {href ? (
                    <Link className="btn sm ghost" href={href}>
                      Open
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
