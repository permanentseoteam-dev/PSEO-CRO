"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { AtSign, Mic, Paperclip, X } from "lucide-react";
import { Avatar, Button, IconButton, PhaseTwo, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fileProblem, formatSize, mentionMatches, mentionQuery, MAX_FILES } from "@/lib/modules/chat/logic";
import type { Person } from "@/lib/modules/chat/types";
import s from "./chat.module.css";

export type ComposerHandle = { addFiles: (files: FileList | File[]) => void; focus: () => void };

type Props = {
  ref?: Ref<ComposerHandle>;
  /** localStorage key for the draft; null = no draft. */
  draftKey: string | null;
  placeholder: string;
  label: string;
  people: Person[];
  onSend: (body: string, files: File[]) => void;
  onTyping?: () => void;
  /** Left side of the bar (thread composer: "Also send to" checkbox). Default: attach, mention, voice. */
  bar?: ReactNode;
  submitLabel?: string;
  className?: string;
};

const draftOf = (key: string | null) => (key && typeof window !== "undefined" ? localStorage.getItem("chat-draft:" + key) ?? "" : "");

export function Composer({ ref, draftKey, placeholder, label, people, onSend, onTyping, bar, submitLabel = "Send", className }: Props) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pop, setPop] = useState<{ start: number; q: string; idx: number } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load the saved draft after mount and whenever the conversation changes (localStorage is browser-only).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(draftOf(draftKey));
    setFiles([]);
    setPop(null);
  }, [draftKey]);

  useEffect(() => {
    const t = ta.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 180) + "px";
  }, [text]);

  function addFiles(list: FileList | File[]) {
    const incoming = [...list];
    const problems = incoming.map(fileProblem).filter(Boolean);
    const ok = incoming.filter((f) => !fileProblem(f));
    setFiles((cur) => {
      const next = [...cur, ...ok];
      if (next.length > MAX_FILES) toast(`Up to ${MAX_FILES} files at a time.`);
      return next.slice(0, MAX_FILES);
    });
    if (problems.length) toast(problems[0]!);
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => ta.current?.focus() }));

  function save(v: string) {
    setText(v);
    if (draftKey) {
      if (v.trim()) localStorage.setItem("chat-draft:" + draftKey, v);
      else localStorage.removeItem("chat-draft:" + draftKey);
    }
  }

  const matches = pop ? mentionMatches(people, pop.q) : [];

  function updatePop(v: string, caret: number) {
    const q = mentionQuery(v, caret);
    setPop(q ? { ...q, idx: 0 } : null);
  }

  function pick(p: Person) {
    if (!pop) return;
    const caret = ta.current?.selectionStart ?? text.length;
    const v = text.slice(0, pop.start) + "@" + p.name + " " + text.slice(caret);
    save(v);
    setPop(null);
    const pos = pop.start + p.name.length + 2;
    requestAnimationFrame(() => {
      ta.current?.focus();
      ta.current?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const body = text.trim();
    if (!body && !files.length) return;
    onSend(body, files);
    save("");
    setFiles([]);
    setPop(null);
  }

  return (
    <div
      className={cn(s.comp, className)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      {pop && matches.length ? (
        <div className={s.mpop} role="listbox" aria-label="Mention someone">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === pop.idx}
              className={cn(i === pop.idx && s.on)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
            >
              <Avatar name={p.name} size={22} />
              <span>
                <b>{p.name}</b> <span className="small muted">{p.title ?? (p.kind === "client" ? "Client" : "")}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ta}
        rows={1}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          save(e.target.value);
          updatePop(e.target.value, e.target.selectionStart);
          onTyping?.();
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            addFiles(e.clipboardData.files);
          }
        }}
        onKeyDown={(e) => {
          if (pop && matches.length) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const d = e.key === "ArrowDown" ? 1 : -1;
              setPop({ ...pop, idx: (pop.idx + d + matches.length) % matches.length });
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[pop.idx]);
              return;
            }
            if (e.key === "Escape") {
              setPop(null);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {files.length ? (
        <div className={s.chips}>
          {files.map((f, i) => (
            <span key={i}>
              {f.name} <span className="muted">{formatSize(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className={s.compBar}>
        {bar ?? (
          <div className="row">
            <IconButton label="Attach files" onClick={() => fileInput.current?.click()}>
              <Paperclip size={16} />
            </IconButton>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <IconButton
              label="Mention someone"
              onClick={() => {
                const t = ta.current;
                const caret = t?.selectionStart ?? text.length;
                const pre = text.slice(0, caret);
                const v = pre + (pre && !/\s$/.test(pre) ? " @" : "@") + text.slice(caret);
                save(v);
                const pos = v.length - (text.length - caret);
                updatePop(v, pos);
                requestAnimationFrame(() => {
                  t?.focus();
                  t?.setSelectionRange(pos, pos);
                });
              }}
            >
              <AtSign size={16} />
            </IconButton>
            <IconButton label="Voice notes ship in phase 2" disabled>
              <Mic size={16} />
            </IconButton>
            <PhaseTwo />
          </div>
        )}
        <Button variant="primary" size="sm" onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
