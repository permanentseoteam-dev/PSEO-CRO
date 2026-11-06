import { requireMe, can } from "@/lib/auth/can";
import { getMyTickets } from "@/lib/modules/home/queries";
import { localDate, parseView } from "@/lib/modules/home/logic";
import { MyWork } from "./_components/my-work";

export const metadata = { title: "My work" };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const tickets = await getMyTickets(me.id);
  return <MyWork tickets={tickets} meId={me.id} today={localDate(new Date())} initialView={parseView(sp.view)} initialLayout={sp.layout === "list" ? "list" : "board"} canEdit={can(me, "tickets.manage")} />;
}
