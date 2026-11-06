"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, IconButton, useToast } from "@/components/ui";
import type { StatusKey, TaskType, WorkConfig } from "@/lib/modules/work/space-types";
import { STATUS_KEYS as STATUS_ORDER } from "@/lib/modules/work/space-logic";
import s from "./config-editor.module.css";

type Result = { ok: true } | { ok: false; error: string };
type Kind = "statuses" | "eventTypes";

/** The three config sections (statuses, task types, event types), each with an edit dialog when `editable`. */
export function ConfigSections({
  config,
  editable,
  onSave,
}: {
  config: WorkConfig;
  editable: boolean;
  onSave: (config: WorkConfig) => Promise<Result>;
}) {
  const [open, setOpen] = useState<Kind | null>(null);

  return (
    <div className={s.sections}>
      <Section title="Task statuses" button="Edit statuses" editable={editable} onEdit={() => setOpen("statuses")}>
        {STATUS_ORDER.map((k, i) => (
          <span key={k} className={s.flow}>
            {i > 0 ? <ArrowRight className={s.arrow} aria-hidden /> : null}
            <span className={s.chip}>
              <span aria-hidden>{config.statuses[k].emoji}</span>
              {config.statuses[k].label}
            </span>
          </span>
        ))}
      </Section>
      <Section title="Task types" button="Fixed RACI types" editable={false} onEdit={() => {}}>
        <TypeChips types={config.taskTypes} />
      </Section>
      <Section title="Event types" button="Edit types" editable={editable} onEdit={() => setOpen("eventTypes")}>
        <TypeChips types={config.eventTypes} />
      </Section>

      {open === "statuses" ? (
        <StatusesDialog config={config} onClose={() => setOpen(null)} onSave={onSave} />
      ) : open ? (
        <TypesDialog kind={open} config={config} onClose={() => setOpen(null)} onSave={onSave} />
      ) : null}
    </div>
  );
}

function Section({ title, button, editable, onEdit, children }: { title: string; button: string; editable: boolean; onEdit: () => void; children: ReactNode }) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h3>{title}</h3>
        <button type="button" className={s.editBtn} disabled={!editable} onClick={onEdit}>
          {button}
        </button>
      </div>
      <div className={s.chips}>{children}</div>
    </section>
  );
}

function TypeChips({ types }: { types: TaskType[] }) {
  if (!types.length) return <span className="muted">None yet</span>;
  return (
    <>
      {types.map((t) => (
        <span key={t.id} className={s.chip}>
          <span className={s.swatch} style={{ background: t.color }} aria-hidden />
          {t.name}
        </span>
      ))}
    </>
  );
}

function useSave(onSave: (c: WorkConfig) => Promise<Result>, onClose: () => void) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  async function save(c: WorkConfig) {
    setPending(true);
    const r = await onSave(c);
    setPending(false);
    if (!r.ok) return toast(r.error);
    toast("Saved");
    onClose();
  }
  return { pending, save };
}

function StatusesDialog({ config, onClose, onSave }: { config: WorkConfig; onClose: () => void; onSave: (c: WorkConfig) => Promise<Result> }) {
  const [statuses, setStatuses] = useState(config.statuses);
  const { pending, save } = useSave(onSave, onClose);
  const valid = STATUS_ORDER.every((k) => statuses[k].label.trim() && statuses[k].emoji.trim());
  const set = (k: StatusKey, patch: Partial<{ label: string; emoji: string }>) => setStatuses((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit statuses"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || pending} onClick={() => save({ ...config, statuses })}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {STATUS_ORDER.map((k) => (
        <div key={k} className={s.editRow}>
          <input className={s.emoji} aria-label="Emoji" value={statuses[k].emoji} maxLength={16} onChange={(e) => set(k, { emoji: e.target.value })} />
          <input aria-label="Status name" value={statuses[k].label} maxLength={40} onChange={(e) => set(k, { label: e.target.value })} />
        </div>
      ))}
    </Dialog>
  );
}

function TypesDialog({ kind, config, onClose, onSave }: { kind: "taskTypes" | "eventTypes"; config: WorkConfig; onClose: () => void; onSave: (c: WorkConfig) => Promise<Result> }) {
  const [types, setTypes] = useState(config[kind]);
  const { pending, save } = useSave(onSave, onClose);
  const valid = types.every((t) => t.name.trim());
  const set = (id: string, patch: Partial<TaskType>) => setTypes((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === "taskTypes" ? "Edit task types" : "Edit event types"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || pending} onClick={() => save({ ...config, [kind]: types.map((t) => ({ ...t, name: t.name.trim() })) })}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {types.map((t) => (
        <div key={t.id} className={s.editRow}>
          <input type="color" className={s.color} aria-label="Colour" value={t.color} onChange={(e) => set(t.id, { color: e.target.value })} />
          <input aria-label="Type name" value={t.name} maxLength={40} onChange={(e) => set(t.id, { name: e.target.value })} />
          <IconButton label="Remove" size="sm" onClick={() => setTypes((p) => p.filter((x) => x.id !== t.id))}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" onClick={() => setTypes((p) => [...p, { id: crypto.randomUUID(), name: "", color: "#60a5fa" }])}>
          <Plus /> Add type
        </Button>
      </div>
    </Dialog>
  );
}
