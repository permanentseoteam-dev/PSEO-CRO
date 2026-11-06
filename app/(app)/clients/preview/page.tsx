import { requireMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHead, NoAccess } from "@/components/ui";
import { ClientPreviewForm } from "./preview-form";
import { PageTitle } from "@/components/shell/page-title";

export const metadata = { title: "Client view" };

export default async function ClientPreviewPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;

  // The signed-in staff member's RLS scope determines which clients can be previewed.
  const db = await createClient();
  const { data: clients, error } = await db.from("clients").select("id, name").order("name");

  return (
    <div className="page">
      <PageTitle title="Client view" />
      <h1>Client view</h1>
      <Card className="max-w-xl">
        <CardHead title="Choose a client" />
        <p className="muted mb-4">Preview their portal read-only for 30 minutes.</p>
        {error ? (
          <p role="alert">Couldn’t load clients. Please try again.</p>
        ) : clients?.length ? (
          <ClientPreviewForm clients={clients} />
        ) : (
          <p className="muted">No clients are available to preview.</p>
        )}
      </Card>
    </div>
  );
}
