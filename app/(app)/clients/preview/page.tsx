import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { PageTitle } from "@/components/shell/page-title";
import { listPreviewCards, type PreviewCard } from "@/lib/modules/clients/preview-cards";
import { statusLabel } from "@/lib/modules/clients/logic";
import { timeAgo } from "@/lib/modules/shell/logic";
import { ClientPreviewGrid, type ClientCardView } from "./preview-form";
import styles from "./preview.module.css";

export const metadata = { title: "Client view" };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function toView(c: PreviewCard, now: Date): ClientCardView {
  const line = [c.status ? statusLabel(c.status) : null, c.services.join(", ") || null].filter(Boolean).join(" · ");
  return {
    id: c.id,
    name: c.name,
    line: line || null,
    openWork: c.openWork == null ? null : plural(c.openWork, "open task", "open tasks"),
    waiting: c.waiting == null ? null : `${c.waiting} waiting for approval`,
    meeting:
      c.nextMeeting === undefined
        ? null
        : c.nextMeeting
          ? `Meeting ${new Date(c.nextMeeting).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
          : "No meeting booked",
    activity: c.lastActivity === undefined ? null : c.lastActivity ? `Active ${lowerFirst(timeAgo(c.lastActivity, now))}` : "No activity yet",
  };
}

export default async function ClientPreviewPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;

  // The signed-in staff member's RLS scope determines which clients can be previewed.
  const cards = await listPreviewCards();
  const now = new Date();

  return (
    <div className="page">
      <PageTitle title="Client view" />
      <header className={styles.head}>
        <h1>Client view</h1>
        <p>See any client&rsquo;s portal exactly as they do, read-only for 30 minutes.</p>
      </header>
      {cards ? (
        <ClientPreviewGrid clients={cards.map((c) => toView(c, now))} />
      ) : (
        <p role="alert" className={styles.alert}>Couldn&rsquo;t load clients. Please try again.</p>
      )}
    </div>
  );
}
