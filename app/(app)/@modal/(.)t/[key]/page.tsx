import { TicketView } from "../../../t/[key]/_components/ticket-view";
import { TaskModal } from "../../../t/[key]/_components/task-modal";

/** /t/KEY opened from inside the app shows as a pop-up; a direct load or refresh renders the full page. */
export default async function TaskPopup({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return (
    <TaskModal>
      <TicketView ticketKey={decodeURIComponent(key)} />
    </TaskModal>
  );
}
