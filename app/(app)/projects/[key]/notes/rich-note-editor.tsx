"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { AlignCenter, AlignLeft, Bold, CheckSquare, ChevronDown, Code, Italic, Link2, List, ListOrdered, Minus, Plus, Quote, Redo2, Type, Underline, Undo2 } from "lucide-react";
import { readNote, writeNote } from "./note-content";
import s from "./notes.module.css";

type Props = { initialBody: string; disabled: boolean; onChange: (body: string) => void; onBlur: () => void; status: ReactNode; title: ReactNode };

export function RichNoteEditor({ initialBody, disabled, onChange, onBlur, status, title }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, protocols: ["http", "https", "mailto"] } }),
      TextStyle, Color, TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList, TaskItem.configure({ nested: true }),
    ],
    content: readNote(initialBody),
    editable: !disabled,
    editorProps: { attributes: { class: s.prose, "aria-label": "Note content", "data-placeholder": "Write your text here…", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => onChange(writeNote(current.getJSON())),
    onBlur,
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? ({
    bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"),
    link: current.isActive("link"), taskList: current.isActive("taskList"), orderedList: current.isActive("orderedList"), bulletList: current.isActive("bulletList"),
    center: current.isActive({ textAlign: "center" }), left: current.isActive({ textAlign: "left" }),
    style: [1, 2, 3].find((level) => current.isActive("heading", { level })) ?? 0,
    empty: current.isEmpty,
  }) : null });
  const tool = (label: string, icon: ReactNode, action: () => void, active?: boolean) => (
    <button type="button" className={s.tool} aria-label={label} title={label} aria-pressed={active} disabled={!editor || disabled}
      onMouseDown={(event) => event.preventDefault()} onClick={action}>{icon}</button>
  );
  function applyLink() {
    if (!editor) return;
    const value = href.trim();
    if (value && !/^(https?:\/\/|mailto:)/i.test(value)) { setLinkError("Use a full https:// or mailto: link."); return; }
    if (value) editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }
  return (
    <>
      <div className={s.toolbar} role="toolbar" aria-label="Note formatting">
        <label className={s.stylePicker}><span className="sr-only">Text style</span>
          <select aria-label="Text style" value={state?.style ?? 0} disabled={!editor || disabled} onChange={(e) => {
            const level = Number(e.target.value);
            if (level === 0) editor?.chain().focus().setParagraph().run();
            else editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
          }}><option value={0}>Normal text</option><option value={1}>Heading 1</option><option value={2}>Heading 2</option><option value={3}>Heading 3</option></select><ChevronDown /></label>
        <span className={s.divider} />
        {tool("Bold", <Bold />, () => editor?.chain().focus().toggleBold().run(), state?.bold)}
        {tool("Italic", <Italic />, () => editor?.chain().focus().toggleItalic().run(), state?.italic)}
        {tool("Underline", <Underline />, () => editor?.chain().focus().toggleUnderline().run(), state?.underline)}
        <span className={s.divider} />
        <label className={s.colorTool} title="Text color"><Type /><input type="color" aria-label="Text color" defaultValue="#64748b" disabled={!editor || disabled} onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()} /></label>
        {tool("Insert or edit link", <Link2 />, () => { setHref(editor?.getAttributes("link").href ?? ""); setLinkError(""); setLinkOpen(!linkOpen); }, state?.link)}
        <span className={s.divider} />
        {tool("Align left", <AlignLeft />, () => editor?.chain().focus().setTextAlign("left").run(), state?.left)}
        {tool("Align center", <AlignCenter />, () => editor?.chain().focus().setTextAlign("center").run(), state?.center)}
        <span className={s.divider} />
        {tool("Checklist", <CheckSquare />, () => editor?.chain().focus().toggleTaskList().run(), state?.taskList)}
        {tool("Numbered list", <ListOrdered />, () => editor?.chain().focus().toggleOrderedList().run(), state?.orderedList)}
        {tool("Bullet list", <List />, () => editor?.chain().focus().toggleBulletList().run(), state?.bulletList)}
        <div className={s.insertWrap}>
          <button type="button" className={s.tool} aria-label="Insert" title="Insert" aria-expanded={insertOpen} disabled={!editor || disabled} onClick={() => setInsertOpen(!insertOpen)}><Plus /></button>
          {insertOpen ? <div className={s.insertMenu}>
            <button type="button" onClick={() => { editor?.chain().focus().toggleBlockquote().run(); setInsertOpen(false); }}><Quote /> Quote</button>
            <button type="button" onClick={() => { editor?.chain().focus().toggleCodeBlock().run(); setInsertOpen(false); }}><Code /> Code block</button>
            <button type="button" onClick={() => { editor?.chain().focus().setHorizontalRule().run(); setInsertOpen(false); }}><Minus /> Divider</button>
            <button type="button" onClick={() => { editor?.chain().focus().undo().run(); setInsertOpen(false); }}><Undo2 /> Undo</button>
            <button type="button" onClick={() => { editor?.chain().focus().redo().run(); setInsertOpen(false); }}><Redo2 /> Redo</button>
          </div> : null}
        </div>
        {status}
      </div>
      {linkOpen ? <form className={s.linkForm} onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
        <label htmlFor="note-link">Link URL</label><input id="note-link" type="text" value={href} placeholder="https://example.com" autoFocus onChange={(e) => setHref(e.target.value)} />
        <button type="submit" className="btn sm">{href.trim() ? "Apply" : "Remove link"}</button><button type="button" className="btn sm" onClick={() => setLinkOpen(false)}>Cancel</button>
        {linkError ? <span role="alert">{linkError}</span> : null}
      </form> : null}
      <div className={s.document}>
        {title}
        <div className={s.bodyWrap} data-empty={state?.empty ?? true}>
          <EditorContent editor={editor} />
          {state?.empty ? <span className={s.placeholder} aria-hidden="true">Write your text here…</span> : null}
        </div>
      </div>
    </>
  );
}
