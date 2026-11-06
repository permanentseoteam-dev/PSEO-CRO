import { describe, expect, it } from "vitest";
import { notePreview, readNote, writeNote } from "../note-content";

describe("project note content", () => {
  it("opens existing plain-text notes as text, including HTML-looking input", () => {
    expect(readNote("<script>alert(1)</script>\nSecond line")).toEqual({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
    ] });
  });
  it("round-trips formatting and checklist state in the existing body field", () => {
    const doc = { type: "doc", content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [
      { type: "paragraph", content: [{ type: "text", text: "Done", marks: [{ type: "bold" }] }] },
    ] }] }] };
    expect(readNote(writeNote(doc))).toEqual(doc);
    expect(notePreview(writeNote(doc))).toBe("Done");
  });
  it("falls back safely for a malformed serialized document", () => {
    expect(notePreview("pseo-note:v1:bad json")).toBe("pseo-note:v1:bad json");
    expect(notePreview("pseo-note:v1:null")).toBe("pseo-note:v1:null");
  });
  it("strips unsafe persisted links and unsupported formatting attributes", () => {
    const doc = readNote(writeNote({ type: "doc", content: [{ type: "paragraph", attrs: { onclick: "bad" }, content: [
      { type: "text", text: "Safe text", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "textStyle", attrs: { color: "expression(bad)" } }] },
    ] }] }));
    expect(doc.content?.[0].attrs).toBeUndefined();
    expect(doc.content?.[0].content?.[0].marks).toEqual([]);
  });
  it("creates a readable, single-line list preview across paragraphs", () => {
    expect(notePreview("First line\n\nSecond line")).toBe("First line Second line");
    expect(notePreview("")).toBe("");
  });
});
