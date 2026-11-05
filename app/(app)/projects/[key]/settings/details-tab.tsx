"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog, useToast } from "@/components/ui";
import { deleteProject, updateProjectDetails } from "@/lib/modules/work/space-actions";
import s from "./settings.module.css";

type Props = { projectId: string; name: string; projectKey: string; canManage: boolean };

export function DetailsTab({ projectId, name, projectKey, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  async function save(next: { name: string; key: string }) {
    const r = await updateProjectDetails({ projectId, ...next });
    if (!r.ok) {
      toast(r.error);
      return false;
    }
    toast("Saved");
    if (next.key !== projectKey) router.replace(`/projects/${next.key}/settings`);
    router.refresh();
    return true;
  }

  return (
    <>
      <section className={s.section}>
        <h2>Project details</h2>
        <div className={s.rows}>
          <InlineRow
            label="Project name"
            value={name}
            editable={canManage}
            validate={(v) => (v.length >= 2 && v.length <= 120 ? null : "Use 2 to 120 characters.")}
            onSave={(v) => save({ name: v, key: projectKey })}
          />
          <InlineRow
            label="Task prefix"
            value={projectKey}
            editable={canManage}
            normalize={(v) => v.toUpperCase().replace(/[^A-Z]/g, "")}
            validate={(v) => (/^[A-Z]{2,8}$/.test(v) ? null : "Use 2 to 8 letters.")}
            onSave={(v) => save({ name, key: v })}
          />
        </div>
      </section>

      {canManage ? (
        <>
          <hr className={s.divider} />
          <section className={s.section}>
            <h2>Delete project</h2>
            <p className="muted">After deleting this project you will lose its notes and settings. Its tasks are kept in Tickets without a project.</p>
            <div>
              <button type="button" className={s.dangerLink} onClick={() => setConfirming(true)}>
                <Trash2 /> Delete project
              </button>
            </div>
          </section>
          {confirming ? <DeleteDialog projectId={projectId} name={name} onClose={() => setConfirming(false)} /> : null}
        </>
      ) : null}
    </>
  );
}

function InlineRow({
  label,
  value,
  editable,
  normalize = (v) => v,
  validate,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  normalize?: (v: string) => string;
  validate: (v: string) => string | null;
  onSave: (v: string) => Promise<boolean>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function commit() {
    if (draft === null || pending) return;
    const v = draft.trim();
    if (v === value) return setDraft(null);
    const err = validate(v);
    if (err) return toast(err);
    setPending(true);
    const ok = await onSave(v);
    setPending(false);
    if (ok) setDraft(null);
  }

  return (
    <div className={s.row}>
      <span className={s.label}>{label}</span>
      {draft !== null ? (
        <input
          className={s.inlineInput}
          aria-label={label}
          autoFocus
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(normalize(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
        />
      ) : editable ? (
        <button type="button" className={s.value} title="Click to edit" onClick={() => setDraft(value)}>
          {value}
        </button>
      ) : (
        <span className={s.valueText}>{value}</span>
      )}
    </div>
  );
}

function DeleteDialog({ projectId, name, onClose }: { projectId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const r = await deleteProject({ projectId });
    setPending(false);
    if (!r.ok) return toast(r.error);
    toast("Project deleted");
    router.push("/projects");
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete project"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary-danger" disabled={typed.trim() !== name || pending} onClick={remove}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p>
        Type <b>{name}</b> to confirm.
      </p>
      <input aria-label="Project name" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
    </Dialog>
  );
}
