"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, Card, CardBody, CardHead, Field, FormGrid, Input, Table, Td, Th, useToast } from "@/components/ui";
import { PushToggle } from "@/features/chat-p2/components/push-toggle";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_HINT } from "@/lib/modules/personal/logic";
import { fmt12 } from "@/lib/format-time";
import type { NotifEvent } from "@/lib/modules/personal/types";
import { saveDesign, saveEmail, saveNotif, saveProfile, saveQuiet } from "../actions";
import { EditCtx, EditToggle, ReadRows, SaveCancel, useCardSave } from "./edit-mode";
import { TwoStep } from "./two-step";

type Notif = { event: NotifEvent; label: string; inApp: boolean; email: boolean; phone: boolean };
type Props = {
  /** "account" = my personal settings; "general" = admin-only agency settings. */
  mode: "account" | "general";
  email?: string;
  name?: string;
  /** The admin requires 2-step sign-in for one of my roles, so I can't turn it off. */
  twoStepRequired?: boolean;
  /** Server-rendered platform-p2 sections; pass only when the user may see them. */
  apiKeys?: ReactNode;
  notifLog?: ReactNode;
  /** Extra admin-only sections, listed under "Admin" in the nav. Pass only when the user may see them. `editable` adds the pencil. */
  adminSections?: { id: string; label: string; node: ReactNode; editable?: boolean }[];
  /** Personal settings; needed in "account" mode. */
  initial?: {
    theme: "system" | "light" | "dark";
    density: "comfortable" | "compact";
    email: "daily" | "urgent" | "off";
    quietFrom: string;
    quietTo: string;
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
const ADMIN: [string, string, string][] = [
  ["roles", "Roles & permissions", "/admin/roles"],
  ["invites", "Invites", "/admin/invites"],
  ["people", "People", "/admin/people"],
  ["audit", "Audit log", "/admin/audit"],
  ["api-docs", "API docs", "/settings/api"],
];

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

/** Settings card. `editable` cards open read-only, with a pencil that switches them to edit mode (see edit-mode.tsx). `flush` drops the body padding so a table or list meets the card edges. */
function Section({ id, domId, title, editable, flush, children }: { id: string; domId?: string; title: string; editable?: boolean; flush?: boolean; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card id={domId ?? `pf-${id}`} data-sec={id} className="scroll-mt-4">
      <CardHead title={title} actions={editable && !editing ? <EditToggle label={title} onClick={() => setEditing(true)} /> : undefined} />
      {flush ? children : <CardBody className="flex min-w-0 flex-col gap-3">{editable ? <EditCtx.Provider value={{ editing, setEditing }}>{children}</EditCtx.Provider> : children}</CardBody>}
    </Card>
  );
}

type Initial = NonNullable<Props["initial"]>;
type Theme = Initial["theme"];
type Density = Initial["density"];
type Mail = Initial["email"];
const THEMES: [Theme, string][] = [["system", "System"], ["light", "Light"], ["dark", "Dark"]];
const DENSITIES: [Density, string][] = [["comfortable", "Comfortable"], ["compact", "Compact"]];
const MAILS: [Mail, string][] = [["daily", "Daily digest"], ["urgent", "Urgent only"], ["off", "Off"]];
const labelOf = <T extends string>(items: [T, string][], v: T) => items.find(([k]) => k === v)?.[1] ?? v;

function applyDesign({ theme, density }: { theme: Theme; density: Density }) {
  const html = document.documentElement;
  if (theme === "system") delete html.dataset.theme;
  else html.dataset.theme = theme;
  if (density === "compact") html.dataset.density = "compact";
  else delete html.dataset.density;
}

function DesignCard({ initial }: { initial: { theme: Theme; density: Density } }) {
  const c = useCardSave(initial);
  if (!c.editing) return <ReadRows rows={[["Theme", labelOf(THEMES, c.saved.theme)], ["Density", labelOf(DENSITIES, c.saved.density)]]} />;
  // Changes show on the page straight away; Cancel puts the saved look back.
  const pick = (next: typeof initial) => {
    c.setDraft(next);
    applyDesign(next);
  };
  return (
    <>
      <Field label="Theme">
        <SegButtons label="Theme" value={c.draft.theme} items={THEMES} onChange={(v) => pick({ ...c.draft, theme: v })} />
      </Field>
      <Field label="Density">
        <SegButtons label="Density" value={c.draft.density} items={DENSITIES} onChange={(v) => pick({ ...c.draft, density: v })} />
      </Field>
      <SaveCancel
        pending={c.pending}
        onSave={() => c.save(() => saveDesign(c.draft), "Design saved")}
        onCancel={() => {
          applyDesign(c.saved);
          c.cancel();
        }}
      />
    </>
  );
}

function EmailCard({ initial }: { initial: Mail }) {
  const c = useCardSave(initial);
  if (!c.editing) return <ReadRows rows={[["Send me email", labelOf(MAILS, c.saved)]]} />;
  return (
    <>
      <Field label="Send me email" hint={EMAIL_HINT[c.draft]}>
        <SegButtons label="Send me email" value={c.draft} items={MAILS} onChange={c.setDraft} />
      </Field>
      <SaveCancel pending={c.pending} onSave={() => c.save(() => saveEmail(c.draft), "Email setting saved")} onCancel={c.cancel} />
    </>
  );
}

function QuietCard({ initial }: { initial: { from: string; to: string } }) {
  const toast = useToast();
  const c = useCardSave(initial);
  const { from, to } = c.draft;
  function save() {
    if (!from !== !to) return toast("Set both times, or clear both to turn quiet hours off.");
    c.save(() => saveQuiet({ from, to }), from ? `Quiet hours set to ${fmt12(from)} to ${fmt12(to)}` : "Quiet hours off");
  }
  return (
    <>
      {c.editing ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From" htmlFor="pf-qfrom">
              <Input id="pf-qfrom" type="time" value={from} onChange={(e) => c.setDraft({ from: e.currentTarget.value, to })} />
            </Field>
            <Field label="To" htmlFor="pf-qto">
              <Input id="pf-qto" type="time" value={to} onChange={(e) => c.setDraft({ from, to: e.currentTarget.value })} />
            </Field>
            <Button disabled={c.pending} onClick={() => c.setDraft({ from: "22:00", to: "08:00" })}>
              {`Use ${fmt12("22:00")} to ${fmt12("08:00")}`}
            </Button>
          </div>
          <SaveCancel pending={c.pending} onSave={save} onCancel={c.cancel} />
        </>
      ) : (
        <ReadRows rows={[["Quiet hours", c.saved.from ? `${fmt12(c.saved.from)} to ${fmt12(c.saved.to)}` : "Off"]]} />
      )}
      <p className="muted m-0">No phone alerts in these hours, except urgent client escalations.</p>
    </>
  );
}

function ProfileCard({ initial }: { initial: string }) {
  const c = useCardSave(initial);
  if (!c.editing) return <ReadRows rows={[["Display name", c.saved]]} />;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        c.save(() => saveProfile({ name: c.draft.trim() }), "Profile saved");
      }}
    >
      <FormGrid>
        <Field label="Display name" htmlFor="pf-name">
          <Input id="pf-name" name="name" minLength={2} maxLength={80} required value={c.draft} onChange={(e) => c.setDraft(e.currentTarget.value)} />
        </Field>
      </FormGrid>
      <SaveCancel pending={c.pending} onCancel={c.cancel} />
    </form>
  );
}

export function SettingsView({ mode, email = "", name = "", twoStepRequired = false, apiKeys, notifLog, adminSections, initial }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const account = mode === "account" && initial;
  const general = mode === "general";
  const [active, setActive] = useState(account ? "design" : "admin");
  const [navOpen, setNavOpen] = useState(true);
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
    root.current?.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  // ---------------------------------------------------------------- notifications
  const [notif, setNotif] = useState(initial?.notif ?? []);
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

  // ---------------------------------------------------------------- security
  const [twoStep, setTwoStep] = useState(false);

  function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if ((f.next ?? "").length < 10) return toast("Use at least 10 characters for the new password.");
    const code = (f.code ?? "").trim();
    if (twoStep && !/^\d{6}$/.test(code)) return toast("Enter the 6-digit code from your authenticator app.");
    start(async () => {
      const sb = createClient();
      const check = await sb.auth.signInWithPassword({ email, password: f.current ?? "" });
      if (check.error) return toast("Your current password isn't right.");
      // Signing in again drops the session to the first step; the app code lifts it back before the change.
      if (twoStep) {
        const factor = (await sb.auth.mfa.listFactors()).data?.totp[0];
        const v = factor ? await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code }) : null;
        if (v?.error) return toast("That code isn't right. Check your app and try again.");
      }
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
      className={`shrink-0 whitespace-nowrap rounded-[var(--radius)] px-3 py-2 leading-tight no-underline hover:bg-surface-2 ${active === id ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2"}`}
    >
      {label}
    </a>
  );

  return (
    <div ref={root} className={`grid items-start gap-4 min-[901px]:gap-8 ${navOpen ? "min-[901px]:grid-cols-[200px_minmax(0,880px)]" : "min-[901px]:grid-cols-[min-content_minmax(0,1fr)]"}`}>
      <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 min-[901px]:sticky min-[901px]:top-4 min-[901px]:mx-0 min-[901px]:flex-col min-[901px]:gap-0.5 min-[901px]:overflow-visible min-[901px]:px-0 min-[901px]:pb-0">
        <button
          type="button"
          className="icon-btn sm shrink-0 self-start"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-label={navOpen ? "Collapse sections" : "Expand sections"}
          title={navOpen ? "Collapse sections" : "Expand sections"}
        >
          {navOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>
        {navOpen && account ? SECTIONS.map(([id, l]) => navLink(id, l)) : null}
        {navOpen && account && notifLog ? navLink("nlog", "Notifications log") : null}
        {navOpen && general ? (
          <>
            {navLink("admin", "Admin pages")}
            {adminSections?.map((s) => navLink(s.id, s.label))}
            {apiKeys ? navLink("api", "API keys") : null}
          </>
        ) : null}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {account ? (
          <>
            <Section id="design" title="Design" editable>
              <DesignCard initial={{ theme: account.theme, density: account.density }} />
            </Section>

            <Section id="notif" title="Notifications" flush>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th className="w-[88px] text-center">In app</Th>
                    <Th className="w-[88px] text-center">Email</Th>
                    <Th className="w-[88px] text-center">Phone</Th>
                  </tr>
                </thead>
                <tbody>
                  {notif.map((r, i) => (
                    <tr key={r.event}>
                      <Td>{r.label}</Td>
                      {(["inApp", "email", "phone"] as const).map((ch) => (
                        <Td key={ch} className="text-center">
                          <input type="checkbox" aria-label={`${r.label}: ${ch === "inApp" ? "in app" : ch}`} checked={r[ch]} onChange={(e) => toggle(i, ch, e.currentTarget.checked)} />
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Section>

            <Section id="email" title="Email" editable>
              <EmailCard initial={account.email} />
            </Section>

            <Section id="quiet" title="Quiet hours" editable>
              <QuietCard initial={{ from: account.quietFrom, to: account.quietTo }} />
            </Section>

            <Section id="profile" title="Profile" editable>
              <ProfileCard initial={name} />
            </Section>

            <Section id="push" domId="push" title="Phone alerts">
              <PushToggle />
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
                  {twoStep ? (
                    <Field label="6-digit code from your authenticator app" htmlFor="pf-code">
                      <Input id="pf-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
                    </Field>
                  ) : null}
                </FormGrid>
                <div className="row">
                  <Button type="submit" disabled={pending}>Change password</Button>
                </div>
              </form>
              <div className="stack mt-3">
                <h4 className="m-0">Sessions</h4>
                <div className="row between">
                  <span>Signed in on this device</span>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={signOutOthers}>Sign out everywhere else</Button>
                </div>
              </div>
              <div className="stack mt-3">
                <h4 className="m-0">2-step sign-in</h4>
                <TwoStep required={twoStepRequired} onChange={setTwoStep} />
              </div>
            </Section>

            {notifLog ? (
              <div data-sec="nlog" className="scroll-mt-4">
                {notifLog}
              </div>
            ) : null}
          </>
        ) : null}

        {general ? (
          <Section id="admin" title="Admin" flush>
            <div className="list">
              {ADMIN.map(([id, label, href]) => (
                <div key={id} className="item between">
                  <span>{label}</span>
                  <Link className="btn sm ghost" href={href}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {general
          ? adminSections?.map((s) => (
              <Section key={s.id} id={s.id} title={s.label} editable={s.editable}>
                {s.node}
              </Section>
            ))
          : null}

        {general && apiKeys ? (
          <div data-sec="api" className="scroll-mt-4">
            {apiKeys}
          </div>
        ) : null}
      </div>
    </div>
  );
}
