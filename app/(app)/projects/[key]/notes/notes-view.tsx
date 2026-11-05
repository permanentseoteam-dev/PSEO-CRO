"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, IconButton, useToast } from "@/components/ui";
import { createNote, deleteNote, updateNote } from "@/lib/modules/work/space-actions";
import type { ProjectNote } from "@/lib/modules/work/space-types";
import { cn } from "@/lib/utils";
import s from "./notes.module.css";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function NotesView({ projectId, notes, selected }: { projectId: string; notes: ProjectNote[]; selected: ProjectNote | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  async function add() {
    setCreating(true);
    const r = await createNote({ projectId, title: "Untitled note" });
    setCreating(false);
    if (!r.ok) return toast(r.error);
    router.push(`${pathname}?note=${r.id}`);
    router.refresh();
  }

  const newBtn = (
    <Button variant="primary" onClick={add} disabled={creating}>
      <Plus /> New note
    </Button>
  );

  if (!notes.length) {
    return (
      <div className="card">
        <EmptyState icon={<FileText />} title="No notes yet" action={newBtn}>
          Keep meeting notes, briefs and decisions for this project here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.list}>
        <div className={s.listHead}>{newBtn}</div>
        {notes.map((n) => (
          <Link key={n.id} href={`${pathname}?note=${n.id}`} className={cn(s.row, n.id === selected?.id && s.on)} aria-current={n.id === selected?.id ? "page" : undefined}>
            <span className={s.rowTitle}>{n.title}</span>
            <span className={s.rowTime} suppressHydrationWarning>
              {when(n.updatedAt)}
            </span>
          </Link>
        ))}
      </div>
      {selected ? <NoteEditor key={selected.id} note={selected} /> : null}
    </div>
  );
}

function NoteEditor({ note }: { note: ProjectNote }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const saved = useRef({ title: note.title, body: note.body });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSave = useRef<(() => void) | null>(null);

  async function save(t: string, b: string) {
    clearTimeout(timer.current);
    pendingSave.current = null;
    const next = { title: t.trim() || "Untitled note", body: b };
    if (next.title === saved.current.title && next.body === saved.current.body) return;
    saved.current = next;
    const r = await updateNote({ id: note.id, ...next });
    if (!r.ok) return toast(r.error);
    router.refresh();
  }

  function schedule(t: string, b: string) {
    clearTimeout(timer.current);
    pendingSave.current = () => save(t, b);
    timer.current = setTimeout(() => save(t, b), 800);
  }

  // Switching notes unmounts the editor: save what's still waiting on the debounce.
  useEffect(() => () => pendingSave.current?.(), []);

  async function remove() {
    if (!confirm(`Delete "${saved.current.title}"?`)) return;
    clearTimeout(timer.current);
    pendingSave.current = null;
    const r = await deleteNote({ id: note.id });
    if (!r.ok) return toast(r.error);
    toast("Note deleted");
    router.replace(pathname);
    router.refresh();
  }

  return (
    <div className={s.editor}>
      <div className={s.editorHead}>
        <input
          className={s.title}
          aria-label="Note title"
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule(e.target.value, body);
          }}
          onBlur={() => save(title, body)}
        />
        <IconButton label="Delete note" onClick={remove}>
          <Trash2 />
        </IconButton>
      </div>
      <textarea
        className={s.body}
        aria-label="Note"
        placeholder="Write something…"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          schedule(title, e.target.value);
        }}
        onBlur={() => save(title, body)}
      />
    </div>
  );
}
