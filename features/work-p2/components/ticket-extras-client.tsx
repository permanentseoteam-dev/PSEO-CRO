"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Avatar, Avatars, Button, Card, CardBody, CardHead, Checkbox, Dialog, Field, IconButton, Input, Select, StatusDot, Textarea, TicketStatusDot, TICKET_STATUS, type TicketStatus } from "@/components/ui";
import { addDependency, removeDependency, saveClientCard, saveScopeFlag, setTicketPeople } from "../actions";
import { openCount, SCOPE_LABEL } from "../logic";
import type { ClientCard, Dependency, ScopeFlag, ScopeStatus } from "../types";
import { useRun } from "./shared";

const statusOf = (s: string) => (s in TICKET_STATUS ? <TicketStatusDot status={s as TicketStatus} /> : <StatusDot>{s}</StatusDot>);

// ---------------------------------------------------------------- dependencies
export function DependenciesCard({ ticketId, blockedBy, blocks }: { ticketId: string; blockedBy: Dependency[]; blocks: Dependency[] }) {
  const { pending, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState<"blocked_by" | "blocks">("blocked_by");
  const [key, setKey] = useState("");
  const waiting = openCount(blockedBy.map((d) => d.ticket));

  const line = (label: string, d: Dependency) => (
    <div key={d.id} className="row between">
      <span>
        {label} <Link href={`/t/${d.ticket.key}`}>{d.ticket.key}</Link> <span className="muted">{d.ticket.title}</span>
      </span>
      <span className="row" style={{ flexWrap: "nowrap" }}>
        {statusOf(d.ticket.status)}
        <IconButton label={`Remove link to ${d.ticket.key}`} size="sm" disabled={pending} onClick={() => run(() => removeDependency(d.id), "Link removed")}>
          <X size={14} />
        </IconButton>
      </span>
    </div>
  );

  return (
    <Card>
      <CardHead
        title="Dependencies"
        actions={
          adding ? null : (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              Add
            </Button>
          )
        }
      />
      <CardBody className="stack">
        {waiting ? <StatusDot tone="danger">Waiting on {waiting === 1 ? "1 ticket" : `${waiting} tickets`}</StatusDot> : null}
        {blockedBy.map((d) => line("Blocked by", d))}
        {blocks.map((d) => line("Blocks", d))}
        {!blockedBy.length && !blocks.length && !adding ? <p className="muted">No dependencies.</p> : null}
        {adding ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addDependency({ ticketId, key, direction }), "Link added", () => {
                setKey("");
                setAdding(false);
              });
            }}
          >
            <Select aria-label="Link type" value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="blocked_by">Blocked by</option>
              <option value="blocks">Blocks</option>
            </Select>
            <Input aria-label="Ticket key" placeholder="CPD-139" value={key} onChange={(e) => setKey(e.target.value)} required style={{ flex: "1 1 120px", minWidth: 0 }} />
            <Button size="sm" variant="primary" type="submit" disabled={pending}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- co-assignees and watchers
export function PeoplePicker({
  ticketId,
  kind,
  people,
  selected,
}: {
  ticketId: string;
  kind: "co" | "watch";
  people: { id: string; name: string }[];
  selected: string[];
}) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>(selected);
  const name = new Map(people.map((p) => [p.id, p.name]));
  const noun = kind === "co" ? "co-assignees" : "watchers";
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const save = (ids: string[], done: string) => run(() => setTicketPeople({ ticketId, kind, memberIds: ids }), done, () => setOpen(false));

  return (
    <span className="row">
      {selected.length ? (
        <Avatars>
          {selected.map((id) => (
            <Avatar key={id} name={name.get(id) ?? "?"} size={22} />
          ))}
        </Avatars>
      ) : (
        <span className="muted">None</span>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setPicked(selected);
          setQ("");
          setOpen(true);
        }}
      >
        <Plus size={14} /> {selected.length ? "Edit" : "Add"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={kind === "co" ? "Co-assignees" : "Watchers"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending} onClick={() => save(picked, `Saved ${noun}`)}>
              Save {noun}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Find a person" htmlFor={`pp-${kind}`}>
            <Input id={`pp-${kind}`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name" />
          </Field>
          <div className="stack" style={{ maxHeight: 320, overflowY: "auto" }}>
            {shown.map((p) => (
              <Checkbox
                key={p.id}
                checked={picked.includes(p.id)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))}
                label={
                  <span className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                    <Avatar name={p.name} size={22} /> {p.name}
                  </span>
                }
              />
            ))}
            {!shown.length ? <p className="muted">No one matches.</p> : null}
          </div>
        </div>
      </Dialog>
    </span>
  );
}

// ---------------------------------------------------------------- client card
export function ClientCardForm({
  ticketId,
  clientId,
  card,
  files,
}: {
  ticketId: string;
  clientId: string;
  card: ClientCard;
  files: { id: string; name: string }[];
}) {
  const { pending, run } = useRun();
  const [v, setV] = useState(card);
  const set = (patch: Partial<ClientCard>) => setV((cur) => ({ ...cur, ...patch }));

  return (
    <Card>
      <CardHead title="Client" />
      <CardBody>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveClientCard({
                  ticketId,
                  clientId,
                  showInPortal: v.show_in_portal,
                  clientTitle: v.client_title,
                  clientDetails: v.client_details,
                  needsApproval: v.needs_approval,
                  sharedFileIds: v.shared_file_ids,
                }),
              "Client card saved",
            );
          }}
        >
          <Checkbox label="Show in client portal" checked={v.show_in_portal} onChange={(e) => set({ show_in_portal: e.target.checked })} />
          <Field label="Client-facing title" htmlFor="cc-title">
            <Input id="cc-title" value={v.client_title} maxLength={200} onChange={(e) => set({ client_title: e.target.value })} />
          </Field>
          <Field label="Details for the client" htmlFor="cc-details">
            <Textarea
              id="cc-details"
              rows={2}
              maxLength={4000}
              value={v.client_details}
              placeholder="Plain words: what this is and why it matters to them"
              onChange={(e) => set({ client_details: e.target.value })}
            />
          </Field>
          {files.length ? (
            <div className="stack small">
              {files.map((f) => (
                <Checkbox
                  key={f.id}
                  label={`Share ${f.name}`}
                  checked={v.shared_file_ids.includes(f.id)}
                  onChange={(e) => set({ shared_file_ids: e.target.checked ? [...v.shared_file_ids, f.id] : v.shared_file_ids.filter((x) => x !== f.id) })}
                />
              ))}
            </div>
          ) : null}
          <Checkbox label="Needs client approval" checked={v.needs_approval} onChange={(e) => set({ needs_approval: e.target.checked })} />
          <div>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Save client card
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- scope
export function ScopeCard({
  ticketId,
  clientId,
  suggestion,
  flag,
  canDecide,
}: {
  ticketId: string;
  clientId: string;
  suggestion: { status: ScopeStatus; term: string | null } | null;
  flag: ScopeFlag | null;
  canDecide: boolean;
}) {
  const { pending, run } = useRun();
  const [reason, setReason] = useState(flag?.reason ?? "");
  const decide = (status: ScopeStatus) =>
    run(() => saveScopeFlag({ ticketId, clientId, status, matchedTerm: suggestion?.term ?? null, reason }), `Marked ${SCOPE_LABEL[status].label.toLowerCase()}`);
  const current = flag ? SCOPE_LABEL[flag.status] : null;

  return (
    <Card>
      <CardHead title="Scope" />
      <CardBody className="stack">
        {current ? (
          <span>
            <StatusDot tone={current.tone}>{current.label}</StatusDot>
            {flag?.flagged_by_name ? <span className="muted small"> by {flag.flagged_by_name}</span> : null}
          </span>
        ) : null}
        {suggestion === null ? (
          <p className="muted small">No scope terms on this client yet.</p>
        ) : suggestion.status === "unsure" ? (
          <p className="muted small">Nothing in the client&apos;s terms matches this ticket.</p>
        ) : (
          <p className="small">
            {suggestion.status === "out_of_scope" ? "Looks out of scope" : "Looks in scope"}: matches &ldquo;{suggestion.term}&rdquo;
          </p>
        )}
        {flag?.reason ? <p className="small">{flag.reason}</p> : null}
        {canDecide ? (
          <>
            <Textarea aria-label="Scope note" rows={2} value={reason} placeholder="Note, e.g. agreed as extra work" onChange={(e) => setReason(e.target.value)} />
            <div className="row">
              <Button size="sm" disabled={pending} onClick={() => decide("in_scope")}>
                In scope
              </Button>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => decide("out_of_scope")}>
                Out of scope
              </Button>
            </div>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
