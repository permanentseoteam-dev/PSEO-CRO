import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getProjectSpace, listProjectNotes } from "@/lib/modules/work/space";
import { NotesView } from "./notes-view";

export const metadata = { title: "Notes" };

export default async function NotesPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ note?: string }> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const [{ key }, { note }] = await Promise.all([params, searchParams]);
  const space = await getProjectSpace(key);
  if (!space) notFound();
  const notes = await listProjectNotes(space.id);
  const selected = notes.find((n) => n.id === note) ?? notes[0] ?? null;

  return <NotesView projectId={space.id} notes={notes} selected={selected} />;
}
