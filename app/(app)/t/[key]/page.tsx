import { TicketView } from "./_components/ticket-view";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params) {
  const { key } = await params;
  return { title: decodeURIComponent(key).toUpperCase() };
}

export default async function TicketPage({ params }: Params) {
  const { key } = await params;
  return <TicketView ticketKey={decodeURIComponent(key)} />;
}
