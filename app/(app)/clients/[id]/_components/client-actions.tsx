"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Seg, useToast } from "@/components/ui";
import { LOG_KINDS, SEVERITY, TEAM_ROLES } from "@/lib/modules/clients/logic";
import type { Contact, Person } from "@/lib/modules/clients/types";
import {
  closeEscalation,
  deleteContact,
  logEntry,
  raiseEscalation,
  recalcHealth,
  removeTeamMember,
  saveBranding,
  saveContact,
  saveMeetingNotes,
  setPortalLogin,
  setTeamMember,
} from "../../actions";

type Res = { ok: true; warning?: string } | { ok: false; error: string };

/** Runs a server action with a pending state and a toast. */
function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, done: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error);
      toast(r.warning ? `${done}. ${r.warning}` : done);
      after?.();
    });
  return { pending, run };
}

const form = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  return { str: (k: string) => String(fd.get(k) ?? ""), on: (k: string) => fd.get(k) === "on" };
};

/** Button that opens a dialog holding one form. */
function FormDialog({
  label,
  title,
  submit,
  variant = "default",
  size,
  id,
  pending,
  open,
  setOpen,
  onSubmit,
  children,
}: {
  label: ReactNode;
  title: string;
  submit: string;
  variant?: "primary" | "default" | "ghost" | "danger";
  size?: "sm";
  id: string;
  pending: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={id} disabled={pending}>
              {submit}
            </Button>
          </>
        }
      >
        <form id={id} onSubmit={onSubmit}>
          {children}
        </form>
      </Dialog>
    </>
  );
}

const today = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- escalate
export function EscalateButton({ clientId, people, size, variant }: { clientId: string; people: Person[]; size?: "sm"; variant?: "default" | "danger" }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <FormDialog
      label={size ? "Raise escalation" : "Escalate"}
      title="Raise escalation"
      submit="Raise escalation"
      id="esc-form"
      size={size}
      variant={variant}
      pending={pending}
      open={open}
      setOpen={setOpen}
      onSubmit={(e) => {
        const f = form(e);
        run(
          () =>
            raiseEscalation({
              client_id: clientId,
              title: f.str("title"),
              severity: f.str("severity"),
              owner_id: f.str("owner_id"),
              details: f.str("details"),
              create_ticket: f.on("create_ticket"),
              ask_rating: f.on("ask_rating"),
            }),
          "Escalation raised",
          () => setOpen(false),
        );
      }}
    >
      <FormGrid>
        <Field label="What went wrong" htmlFor="esc-title" full>
          <input id="esc-title" name="title" required maxLength={200} placeholder="One line the whole team will understand" />
        </Field>
        <Field label="Severity" htmlFor="esc-sev">
          <select id="esc-sev" name="severity" defaultValue="high">
            {Object.entries(SEVERITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} · {v.hours}h window
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner" htmlFor="esc-owner">
          <select id="esc-owner" name="owner_id">
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Details" htmlFor="esc-details" full>
          <textarea id="esc-details" name="details" rows={3} />
        </Field>
        <div className="field full">
          <Checkbox name="create_ticket" label="Create an urgent ticket" defaultChecked />
          <Checkbox name="ask_rating" label="Ask the client to rate the fix when closed" defaultChecked />
        </div>
      </FormGrid>
    </FormDialog>
  );
}

export function CloseEscalationButton({ id, clientId }: { id: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <FormDialog
      label="Close"
      title="Close escalation"
      submit="Close escalation"
      id={`close-${id}`}
      size="sm"
      pending={pending}
      open={open}
      setOpen={setOpen}
      onSubmit={(e) => {
        const f = form(e);
        run(() => closeEscalation({ id, client_id: clientId, client_rating: f.str("rating") }), "Escalation closed", () => setOpen(false));
      }}
    >
      <Field label="Client rating (1 to 5)" htmlFor={`rate-${id}`}>
        <select id={`rate-${id}`} name="rating" defaultValue="">
          <option value="">Not rated yet</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------- log a call or chat
export function LogButton({ clientId, contacts, label = "Log a call or chat", size }: { clientId: string; contacts: Contact[]; label?: string; size?: "sm" }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <FormDialog
      label={label}
      title="Log a call or chat"
      submit="Save to log"
      id="log-form"
      size={size}
      pending={pending}
      open={open}
      setOpen={setOpen}
      onSubmit={(e) => {
        const f = form(e);
        run(
          () => logEntry({ client_id: clientId, kind: f.str("kind"), happened_on: f.str("date"), with_name: f.str("with"), mood: f.str("mood"), body: f.str("body") }),
          "Saved to the log",
          () => setOpen(false),
        );
      }}
    >
      <FormGrid>
        <Field label="Kind" htmlFor="log-kind">
          <select id="log-kind" name="kind" defaultValue="whatsapp">
            {Object.entries(LOG_KINDS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="With" htmlFor="log-with">
          <select id="log-with" name="with">
            <option value="">Not set</option>
            {contacts.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor="log-date">
          <input id="log-date" name="date" type="date" required defaultValue={today()} />
        </Field>
        <Field label="Mood" htmlFor="log-mood">
          <select id="log-mood" name="mood" defaultValue="neutral">
            <option value="happy">Happy</option>
            <option value="neutral">Neutral</option>
            <option value="unhappy">Unhappy</option>
          </select>
        </Field>
        <Field label="Notes" htmlFor="log-body" full>
          <textarea id="log-body" name="body" rows={3} required maxLength={4000} />
        </Field>
      </FormGrid>
    </FormDialog>
  );
}

/** Inline quick log on the Meetings & notes tab. */
export function QuickLog({ clientId }: { clientId: string }) {
  const [kind, setKind] = useState("call");
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="stack">
      <Seg
        label="Kind"
        value={kind}
        onChange={setKind}
        items={[
          { value: "call", label: "Call" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "note", label: "Note" },
        ]}
      />
      <textarea rows={2} placeholder="What was said, in a line or two" aria-label="Quick log text" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row">
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !body.trim()}
          onClick={() => run(() => logEntry({ client_id: clientId, kind, happened_on: today(), with_name: "", mood: "", body }), "Saved to the log", () => setBody(""))}
        >
          Save to log
        </Button>
      </div>
    </div>
  );
}

export function NotesButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <FormDialog
      label="Log notes"
      title="Log meeting notes"
      submit="Save notes"
      id="notes-form"
      size="sm"
      pending={pending}
      open={open}
      setOpen={setOpen}
      onSubmit={(e) => {
        const f = form(e);
        run(
          () =>
            saveMeetingNotes({
              client_id: clientId,
              title: f.str("title"),
              happened_on: f.str("date"),
              decisions: f.str("decisions"),
              concerns: f.str("concerns"),
              action_items: f.str("actions"),
            }),
          "Notes saved",
          () => setOpen(false),
        );
      }}
    >
      <FormGrid>
        <Field label="Meeting" htmlFor="n-title">
          <input id="n-title" name="title" required maxLength={200} placeholder="Monthly call" />
        </Field>
        <Field label="Date" htmlFor="n-date">
          <input id="n-date" name="date" type="date" required defaultValue={today()} />
        </Field>
        <Field label="Decisions" htmlFor="n-dec" full>
          <textarea id="n-dec" name="decisions" rows={2} />
        </Field>
        <Field label="Concerns" htmlFor="n-con" full>
          <textarea id="n-con" name="concerns" rows={2} />
        </Field>
        <Field label="Action items (one per line)" htmlFor="n-act" full>
          <textarea id="n-act" name="actions" rows={3} />
        </Field>
      </FormGrid>
    </FormDialog>
  );
}

// ---------------------------------------------------------------- contacts
export function ContactButton({ clientId, contact }: { clientId: string; contact?: Contact }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const id = contact ? `ct-${contact.id}` : "ct-new";
  return (
    <FormDialog
      label={contact ? "Edit" : "Add contact"}
      title={contact ? "Edit contact" : "Add contact"}
      submit={contact ? "Save contact" : "Add contact"}
      variant={contact ? "ghost" : "primary"}
      size="sm"
      id={id}
      pending={pending}
      open={open}
      setOpen={setOpen}
      onSubmit={(e) => {
        const f = form(e);
        run(
          () =>
            saveContact({
              id: contact?.id ?? "",
              client_id: clientId,
              name: f.str("name"),
              role: f.str("role"),
              email: f.str("email"),
              phone: f.str("phone"),
              is_main: f.on("is_main"),
              gets_reports: f.on("gets_reports"),
            }),
          "Contact saved",
          () => setOpen(false),
        );
      }}
    >
      <FormGrid>
        <Field label="Name" htmlFor={`${id}-n`}>
          <input id={`${id}-n`} name="name" required maxLength={120} defaultValue={contact?.name} />
        </Field>
        <Field label="Role" htmlFor={`${id}-r`}>
          <input id={`${id}-r`} name="role" defaultValue={contact?.role ?? ""} />
        </Field>
        <Field label="Email" htmlFor={`${id}-e`}>
          <input id={`${id}-e`} name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor={`${id}-p`}>
          <input id={`${id}-p`} name="phone" defaultValue={contact?.phone ?? ""} />
        </Field>
        <div className="field full">
          <Checkbox name="is_main" label="Main contact" defaultChecked={contact?.is_main} />
          <Checkbox name="gets_reports" label="Gets monthly reports" defaultChecked={contact?.gets_reports} />
        </div>
      </FormGrid>
      {contact ? (
        <div className="row" style={{ marginTop: 12 }}>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => run(() => deleteContact({ id: contact.id, client_id: clientId }), "Contact removed", () => setOpen(false))}
          >
            Remove contact
          </Button>
        </div>
      ) : null}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- our team
export function TeamEditor({ clientId, people, team }: { clientId: string; people: Person[]; team: { member_id: string; name: string; role: string }[] }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const free = people.filter((p) => !team.some((t) => t.member_id === p.id));
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Edit team
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit team" footer={<Button onClick={() => setOpen(false)}>Done</Button>}>
        <div className="list">
          {team.map((t) => (
            <div className="item between" key={t.member_id}>
              <strong>{t.name}</strong>
              <div className="row">
                <select
                  aria-label={`Role for ${t.name}`}
                  defaultValue={t.role}
                  disabled={pending}
                  onChange={(e) => run(() => setTeamMember({ client_id: clientId, member_id: t.member_id, role: e.target.value }), "Role saved")}
                >
                  {Object.entries(TEAM_ROLES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeTeamMember({ client_id: clientId, member_id: t.member_id }), `${t.name} removed`)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        <form
          className="row"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            const f = form(e);
            const target = e.currentTarget;
            run(() => setTeamMember({ client_id: clientId, member_id: f.str("member_id"), role: f.str("role") }), "Added to the team", () => target.reset());
          }}
        >
          <select name="member_id" aria-label="Person" required defaultValue="">
            <option value="" disabled>
              Add a person
            </option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="role" aria-label="Role" defaultValue="delivery">
            {Object.entries(TEAM_ROLES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            Add
          </Button>
        </form>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- health
export function RecalcButton({ clientId }: { clientId: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => recalcHealth({ client_id: clientId }), "Health recalculated")}>
      Recalculate
    </Button>
  );
}

// ---------------------------------------------------------------- client portal
export function BrandingForm({ clientId, color, welcome, logo }: { clientId: string; color: string | null; welcome: string | null; logo: string | null }) {
  const { pending, run } = useRun();
  return (
    <form
      onSubmit={(e) => {
        const f = form(e);
        run(() => saveBranding({ client_id: clientId, portal_color: f.str("color"), portal_welcome: f.str("welcome"), portal_logo_url: f.str("logo") }), "Branding saved");
      }}
    >
      <FormGrid>
        <Field label="Logo address" htmlFor="b-logo">
          <input id="b-logo" name="logo" type="url" placeholder="https://…/logo.png" defaultValue={logo ?? ""} />
        </Field>
        <Field label="Brand colour" htmlFor="b-color">
          <input id="b-color" name="color" type="color" defaultValue={color ?? "#0f766e"} />
        </Field>
        <Field label="Portal welcome line" htmlFor="b-welcome" full>
          <input id="b-welcome" name="welcome" maxLength={200} defaultValue={welcome ?? ""} />
        </Field>
      </FormGrid>
      <div className="row" style={{ marginTop: 12 }}>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          Save branding
        </Button>
      </div>
    </form>
  );
}

export function LoginRole({ clientId, memberId, role, name }: { clientId: string; memberId: string; role: string | null; name: string }) {
  const { pending, run } = useRun();
  return (
    <div className="row">
      <select
        aria-label={`Role for ${name}`}
        defaultValue={role ?? "client_viewer"}
        disabled={pending}
        onChange={(e) => run(() => setPortalLogin({ client_id: clientId, member_id: memberId, role: e.target.value }), "Role saved")}
      >
        <option value="client_owner">Owner</option>
        <option value="client_viewer">Viewer</option>
      </select>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPortalLogin({ client_id: clientId, member_id: memberId, role: "remove" }), "Access removed")}>
        Remove
      </Button>
    </div>
  );
}
