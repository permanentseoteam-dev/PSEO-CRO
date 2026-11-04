"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHead, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { searchOrg, type OrgNode } from "@/lib/modules/team/logic";
import { cn } from "@/lib/utils";
import { AvatarDot } from "../../_components/avatar-dot";
import { placePerson } from "../../actions";

type Unplaced = { id: string; name: string; title: string | null; reason: string };
type Option = { id: string; name: string };

function allParents(nodes: OrgNode[], out = new Set<string>()) {
  for (const n of nodes) {
    if (n.children.length) {
      out.add(n.person.id);
      allParents(n.children, out);
    }
  }
  return out;
}

export function OrgChart({ roots, unplaced, people, canPlace }: { roots: OrgNode[]; unplaced: Unplaced[]; people: Option[]; canPlace: boolean }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [placing, setPlacing] = useState<Unplaced | null>(null);
  const { hits, open } = useMemo(() => searchOrg(roots, q), [roots, q]);
  const firstHit = useRef<HTMLDivElement>(null);

  const firstId = hits.values().next().value;

  useEffect(() => {
    firstHit.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [firstId]);

  const node = (n: OrgNode) => {
    const p = n.person;
    // Search opens the branches that lead to a match.
    const isClosed = closed.has(p.id) && !open.has(p.id) && n.children.length > 0;
    const hit = hits.has(p.id);
    return (
      <li key={p.id} className="my-1.5">
        <div
          ref={p.id === firstId ? firstHit : undefined}
          className={cn(
            "flex max-w-[460px] items-center gap-2.5 rounded-[var(--radius)] border bg-surface px-2.5 py-2",
            hit ? "border-accent bg-accent-soft" : "border-line",
          )}
        >
          {n.children.length ? (
            <button
              type="button"
              className="icon-btn"
              aria-expanded={!isClosed}
              aria-label={`${isClosed ? "Open" : "Fold"} ${p.name}'s team`}
              onClick={() =>
                setClosed((c) => {
                  const next = new Set(c);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })
              }
            >
              <ChevronDown className={cn("transition-transform", isClosed && "-rotate-90")} />
            </button>
          ) : (
            <span className="w-7 flex-none" />
          )}
          <AvatarDot name={p.name} size={36} presence={p.presence} />
          <div className="min-w-0 flex-1">
            <b>{p.name}</b>
            <div className="small muted">{[p.title, p.department].filter(Boolean).join(" · ")}</div>
          </div>
          {n.teamSize ? <span className="small muted whitespace-nowrap">{n.teamSize} in team</span> : null}
        </div>
        {n.children.length && !isClosed ? (
          <ul className="ml-[22px] list-none border-l border-line p-0 pl-3.5">{n.children.map(node)}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <div className="toolbar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone" aria-label="Find someone" />
        <span className="small muted" aria-live="polite">
          {q.trim() ? (hits.size ? `${hits.size} found` : "No one found") : ""}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setClosed(new Set())}>
          Expand all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setClosed(allParents(roots))}>
          Collapse all
        </Button>
      </div>

      <div className="grid items-start gap-5 min-[901px]:grid-cols-[1fr_300px]">
        <Card>
          <CardBody className="overflow-x-auto">
            {roots.length ? <ul className="m-0 list-none p-0">{roots.map(node)}</ul> : <p className="muted">No reporting lines yet.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Not placed yet" actions={<b>{unplaced.length}</b>} />
          {unplaced.length ? (
            <div className="list">
              {unplaced.map((u) => (
                <div key={u.id} className="item between">
                  <div className="row min-w-0">
                    <Avatar name={u.name} size={32} />
                    <div className="min-w-0">
                      <b>{u.name}</b>
                      <div className="small muted">{[u.title, u.reason].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                  {canPlace ? (
                    <Button size="sm" onClick={() => setPlacing(u)}>
                      Place
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <CardBody>
              <p className="muted">Everyone has a place.</p>
            </CardBody>
          )}
        </Card>
      </div>

      {canPlace ? <PlaceDialog key={placing?.id ?? "none"} person={placing} unplaced={unplaced} people={people} onClose={() => setPlacing(null)} /> : null}
    </>
  );
}

function PlaceDialog({ person, unplaced, people, onClose }: { person: Unplaced | null; unplaced: Unplaced[]; people: Option[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [memberId, setMemberId] = useState(person?.id ?? "");
  const [managerId, setManagerId] = useState("");
  const [title, setTitle] = useState(person?.title ?? "");

  const submit = () =>
    start(async () => {
      const res = await placePerson({ memberId, managerId, title });
      if (!res.ok) return toast(res.error);
      toast("Placed in the org chart");
      onClose();
      router.refresh();
    });

  return (
    <Dialog
      open={!!person}
      onClose={onClose}
      title="Place in the org chart"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending || !memberId || !managerId || !title.trim()} onClick={submit}>
            Place person
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Person" htmlFor="pl-person">
          <Select id="pl-person" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {unplaced.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to" htmlFor="pl-mgr">
          <Select id="pl-mgr" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Choose a person</option>
            {people
              .filter((p) => p.id !== memberId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="pl-title" full>
          <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}
