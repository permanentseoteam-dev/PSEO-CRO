"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Maximize, Minus, Plus } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHead, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { searchOrg, type OrgNode } from "@/lib/modules/team/logic";
import { cn } from "@/lib/utils";
import { AvatarDot } from "../../_components/avatar-dot";
import { placePerson } from "../../actions";
import s from "./org-chart.module.css";

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
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const fit = useCallback(() => {
    const view = viewport.current;
    const chart = canvas.current;
    if (!view || !chart) return;
    setZoom(Math.max(0.25, Math.min(1, (view.clientWidth - 16) / chart.offsetWidth, (view.clientHeight - 16) / chart.offsetHeight)));
    view.scrollTo({ left: 0, top: 0 });
  }, []);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [fit]);

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
      <li key={p.id} className={s.branch}>
        <div
          ref={p.id === firstId ? firstHit : undefined}
          className={cn(s.person, hit && s.hit)}
        >
          <div className={s.personInfo}>
            <AvatarDot name={p.name} size={40} presence={p.presence} />
            <div className="min-w-0 flex-1">
              <b>{p.name}</b>
              <div className="small muted">{p.title || "Title not set"}</div>
          </div>
          </div>
          <div className={s.personFoot}>
            <span className="small muted">{p.department || "No department"}</span>
            {n.children.length ? (
              <button
                type="button"
                className={s.teamToggle}
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
                <span className="small">{n.teamSize} in team</span>
                <ChevronDown className={cn("size-4 transition-transform", isClosed && "-rotate-90")} />
              </button>
            ) : <span className="small muted">Individual</span>}
          </div>
        </div>
        {n.children.length && !isClosed ? (
          <ul className={s.children}>{n.children.map(node)}</ul>
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

      <div className={s.layout}>
        <Card>
          <CardHead title="Reporting structure" actions={roots.length ? (
            <div className={s.controls}>
              <button type="button" className="icon-btn sm" aria-label="Zoom out" disabled={zoom <= 0.25} onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}><Minus /></button>
              <output aria-label="Chart zoom" className="small muted">{Math.round(zoom * 100)}%</output>
              <button type="button" className="icon-btn sm" aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}><Plus /></button>
              <Button size="sm" variant="ghost" onClick={fit}><Maximize className="size-4" /> Fit</Button>
            </div>
          ) : undefined} />
          {roots.length ? <>
            <p className={s.hint} id="org-pan-hint">Drag the canvas or scroll to explore. Use arrow keys when the chart is focused.</p>
            <div
              ref={viewport}
              className={s.viewport}
              role="region"
              aria-label="Organization reporting chart"
              aria-describedby="org-pan-hint"
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button !== 0 || e.pointerType === "touch" || (e.target as HTMLElement).closest("button")) return;
                const view = e.currentTarget;
                drag.current = { x: e.clientX, y: e.clientY, left: view.scrollLeft, top: view.scrollTop };
                view.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
                e.currentTarget.scrollTop = drag.current.top - (e.clientY - drag.current.y);
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onLostPointerCapture={() => { drag.current = null; }}
            >
              <div ref={canvas} className={s.canvas} style={{ zoom }}>
                <ul className={s.roots}>{roots.map(node)}</ul>
              </div>
            </div>
          </> : <CardBody><p className="muted">No reporting lines yet.</p></CardBody>}
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
