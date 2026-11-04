import { Card, CardHead, EmptyState, StatusDot, Table, Td, Th } from "@/components/ui";
import { DELIVERY_TONE, shortDate } from "../logic";
import type { DeliveryRow } from "../types";

const CHANNEL = { push: "Phone", email: "Email", in_app: "In app" } as const;
const time = (iso: string) => `${shortDate(iso)} ${new Date(iso).toISOString().slice(11, 16)}`;

/** Settings → Notifications log. Admins see everyone's deliveries; others see their own (RLS). */
export function NotificationsLog({ rows }: { rows: DeliveryRow[] }) {
  return (
    <Card id="nlog">
      <CardHead title="Notifications log" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing sent yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Sent</Th>
              <Th>To</Th>
              <Th hideSm>Channel</Th>
              <Th>Message</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="num whitespace-nowrap">{time(r.sent_at)}</Td>
                <Td className="break-all">{r.to}</Td>
                <Td hideSm>{CHANNEL[r.channel]}</Td>
                <Td>{r.message}</Td>
                <Td>
                  <StatusDot tone={DELIVERY_TONE[r.result].tone}>{DELIVERY_TONE[r.result].label}</StatusDot>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
