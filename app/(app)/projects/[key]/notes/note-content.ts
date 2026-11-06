import type { JSONContent } from "@tiptap/react";

const PREFIX = "pseo-note:v1:";
const NODES = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle"]);

/** Validate and whitelist stored attributes; never interpret legacy note text as HTML. */
function cleanNode(value: unknown, depth = 0): JSONContent {
  if (!value || typeof value !== "object" || depth > 64) throw new Error("Invalid note");
  const node = value as JSONContent;
  if (!node.type || !NODES.has(node.type)) throw new Error("Unknown note node");
  const next: JSONContent = { type: node.type };
  if (node.type === "text") {
    if (typeof node.text !== "string") throw new Error("Invalid text");
    next.text = node.text;
  }
  const attrs = node.attrs ?? {};
  if (node.type === "heading") next.attrs = { level: [1, 2, 3].includes(attrs.level) ? attrs.level : 1 };
  if (node.type === "taskItem") next.attrs = { checked: attrs.checked === true };
  if (node.type === "orderedList") next.attrs = { start: Number.isInteger(attrs.start) && attrs.start > 0 ? attrs.start : 1 };
  if (["paragraph", "heading"].includes(node.type) && ["left", "center", "right", "justify"].includes(attrs.textAlign)) next.attrs = { ...next.attrs, textAlign: attrs.textAlign };
  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) throw new Error("Invalid content");
    next.content = node.content.map((child) => cleanNode(child, depth + 1));
  }
  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks)) throw new Error("Invalid marks");
    next.marks = node.marks.flatMap((mark) => {
      if (!mark || !MARKS.has(mark.type)) return [];
      if (mark.type === "link") {
        const href = mark.attrs?.href;
        return typeof href === "string" && /^(https?:\/\/|mailto:)/i.test(href) ? [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }] : [];
      }
      if (mark.type === "textStyle") {
        const color = mark.attrs?.color;
        return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? [{ type: "textStyle", attrs: { color } }] : [];
      }
      return [{ type: mark.type }];
    });
  }
  return next;
}

/** Tagged documents keep existing plain-text notes readable without a migration. */
export function readNote(body: string): JSONContent {
  if (body.startsWith(PREFIX)) {
    try {
      const doc = cleanNode(JSON.parse(body.slice(PREFIX.length)));
      if (doc.type === "doc" && Array.isArray(doc.content)) return doc;
    } catch { /* Invalid documents remain text, never HTML. */ }
  }
  return { type: "doc", content: body.split("\n").map((text) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] })) };
}

export function writeNote(doc: JSONContent): string { return PREFIX + JSON.stringify(doc); }

export function notePreview(body: string): string {
  const text = (node: JSONContent): string => node.text ?? (node.content ?? []).map(text).join(node.type === "doc" ? " " : "");
  return text(readNote(body)).replace(/\s+/g, " ").trim();
}
