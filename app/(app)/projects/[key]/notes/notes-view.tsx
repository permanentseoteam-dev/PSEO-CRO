"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button, IconButton, useToast } from "@/components/ui";
import { createNote, deleteNote, updateNote } from "@/lib/modules/work/space-actions";
import type { ProjectNote } from "@/lib/modules/work/space-types";
import { cn } from "@/lib/utils";
import { notePreview } from "./note-content";
import { RichNoteEditor } from "./rich-note-editor";
import s from "./notes.module.css";

function when(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type Draft = { title: string; body: string };

export function NotesView({ projectId, notes, selected }: { projectId: string; notes: ProjectNote[]; selected: ProjectNote | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const saveBeforeLeave = useRef<(() => Promise<boolean>) | null>(null);
  async function add() {
    setCreating(true);
    try {
      if (saveBeforeLeave.current && !(await saveBeforeLeave.current())) return;
      const r = await createNote({ projectId, title: "New note" });
      if (!r.ok) return toast(r.error);
      router.push(pathname + "?note=" + r.id);
      router.refresh();
    } catch { toast("Could not create the note. Please try again."); }
    finally { setCreating(false); }
  }
  return (
    <section className={s.workspace} aria-label="Project notes">
      <header className={s.header}><Button variant="primary" onClick={add} disabled={creating}><Plus /> {creating ? "Adding…" : "Add new"}</Button></header>
      <div className={s.wrap}>
        <nav className={s.list} aria-label="Notes">
          {notes.map((n) => (
            <Link key={n.id} href={pathname + "?note=" + n.id} onClick={async (event) => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              if (!saveBeforeLeave.current || await saveBeforeLeave.current()) router.push(pathname + "?note=" + n.id);
            }} className={cn(s.row, n.id === selected?.id && s.on)} aria-current={n.id === selected?.id ? "page" : undefined}>
              <span className={s.rowTitle}>{n.title}</span>
              <span className={s.rowPreview}>{notePreview(n.body) || "No text yet"}</span>
              <span className={s.rowTime} suppressHydrationWarning>{when(n.updatedAt)}</span>
            </Link>
          ))}
          {!notes.length ? <p className={s.noNotes}>No notes yet. Add your first note.</p> : null}
        </nav>
        {selected ? <NoteEditor key={selected.id} note={selected} saveRef={saveBeforeLeave} /> : <div className={s.empty}><FileText /><h2>Your project notes</h2><p>Add a note to keep your ideas, meeting notes and decisions together.</p></div>}
      </div>
    </section>
  );
}

function NoteEditor({ note, saveRef }: { note: ProjectNote; saveRef: RefObject<(() => Promise<boolean>) | null> }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [title, setTitle] = useState(note.title === "New note" || note.title === "Untitled note" ? "" : note.title);
  const [status, setStatus] = useState<"saved" | "waiting" | "saving" | "error">("saved");
  const [edited, setEdited] = useState(note.updatedAt);
  const [deleting, setDeleting] = useState(false);
  const draft = useRef<Draft>({ title: note.title, body: note.body });
  const saved = useRef<Draft>({ title: note.title, body: note.body });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const removed = useRef(false);
  const dirty = () => draft.current.title !== saved.current.title || draft.current.body !== saved.current.body;

  // Serialize writes so an older response cannot overwrite a newer edit.
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current;
    if (removed.current || !dirty()) return true;
    const task = async () => {
      while (dirty() && !removed.current) {
        const next = { ...draft.current };
        if (mounted.current) setStatus("saving");
        try {
          const r = await updateNote({ id: note.id, ...next });
          if (!r.ok) throw new Error(r.error);
          saved.current = next;
          if (mounted.current) setEdited(new Date().toISOString());
        } catch (error) {
          if (mounted.current) setStatus("error");
          toast(error instanceof Error ? error.message : "Could not save this note. Retry to save your changes.");
          return false;
        }
      }
      if (mounted.current) setStatus("saved");
      router.refresh();
      return true;
    };
    inFlight.current = task();
    try { return await inFlight.current; }
    finally { inFlight.current = null; }
  }, [note.id, router, toast]);

  function schedule(next: Draft) {
    draft.current = next;
    setStatus("waiting");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }
  useEffect(() => {
    mounted.current = true;
    saveRef.current = flush;
    const leave = (e: BeforeUnloadEvent) => { if (dirty() && !removed.current) e.preventDefault(); };
    window.addEventListener("beforeunload", leave);
    return () => {
      mounted.current = false;
      if (saveRef.current === flush) saveRef.current = null;
      window.removeEventListener("beforeunload", leave);
      clearTimeout(timer.current);
      if (!removed.current && dirty()) void flush();
    };
  }, [flush, saveRef]);

  async function remove() {
    if (!confirm('Delete "' + draft.current.title + '"?')) return;
    setDeleting(true);
    removed.current = true;
    clearTimeout(timer.current);
    await inFlight.current;
    try {
      const r = await deleteNote({ id: note.id });
      if (!r.ok) throw new Error(r.error);
      toast("Note deleted");
      router.replace(pathname);
      router.refresh();
    } catch (error) {
      removed.current = false;
      setDeleting(false);
      setStatus(dirty() ? "error" : "saved");
      toast(error instanceof Error ? error.message : "Could not delete this note.");
    }
  }
  return (
    <div className={s.editor} aria-busy={deleting}>
      <RichNoteEditor initialBody={note.body} disabled={deleting}
        onChange={(body) => schedule({ ...draft.current, body })} onBlur={() => void flush()}
        status={<span className={s.saveStatus} aria-live="polite">{status === "error" ? <button type="button" onClick={() => void flush()}>Not saved · Retry</button> : status === "saving" ? "Saving…" : status === "waiting" ? "Unsaved changes" : <span suppressHydrationWarning>Last edited: {when(edited)}</span>}</span>}
        title={<div className={s.titleRow}><input className={s.title} aria-label="Note title" placeholder="Title" value={title} maxLength={200} disabled={deleting}
          onChange={(e) => { setTitle(e.target.value); schedule({ ...draft.current, title: e.target.value.trim() || "New note" }); }} onBlur={() => void flush()} />
          <IconButton label="Delete note" onClick={remove} disabled={deleting}><Trash2 /></IconButton></div>}
      />
    </div>
  );
}
