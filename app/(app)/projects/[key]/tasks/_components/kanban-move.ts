// Pure helpers for the project Kanban. Tasks have no sort column, so a move only changes status;
// the card keeps its place in the list order (newest first) inside the new column.

type Movable = { id: string; status: string };

/** The list with one task's status changed. Same array back when nothing changes. */
export function moveTask<T extends Movable>(tasks: T[], id: string, status: T["status"]): T[] {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.status === status) return tasks;
  return tasks.map((x) => (x.id === id ? { ...x, status } : x));
}

/** Where the dragged card will land in the target column: how many of that column's cards come before it. */
export function landingIndex(tasks: Movable[], id: string, status: string): number {
  let n = 0;
  for (const t of tasks) {
    if (t.id === id) return n;
    if (t.status === status) n++;
  }
  return n;
}
