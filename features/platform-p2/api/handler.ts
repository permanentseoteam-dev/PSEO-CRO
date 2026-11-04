import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "../api-keys";
import { bearerKey } from "../logic";
import type { ApiScope } from "../types";

// Read-only REST API for API keys. Mount at app/api/v1/[resource]/route.ts (see WIRING.md).
// The admin client bypasses RLS, so the key lookup + scope check below is the only guard. Columns are fixed lists.
export const API_RESOURCES: Record<string, { table: string; scope: ApiScope; columns: string; order: string; about: string }> = {
  tickets: {
    table: "tickets",
    scope: "tickets.view",
    columns: "key, title, status, priority, assignee_id, client_id, project_id, due_date, created_at, updated_at",
    order: "created_at",
    about: "Tickets with status, priority, assignee and due date.",
  },
  clients: {
    table: "clients",
    scope: "clients.view",
    columns: "id, name, status, health_score, created_at",
    order: "name",
    about: "Clients with status and health score.",
  },
  "time-entries": {
    table: "time_entries",
    scope: "time.view",
    columns: "id, member_id, ticket_id, date, minutes, billable",
    order: "date",
    about: "Logged time per person and ticket.",
  },
  invoices: {
    table: "invoices",
    scope: "finance.invoices.view",
    columns: "id, number, client_id, entity_id, currency, status, issued_on, due_on, total, amount_paid",
    order: "issued_on",
    about: "Invoices with totals and amount paid.",
  },
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleApiGet(req: Request, resource: string) {
  const res = API_RESOURCES[resource];
  if (!res) return json({ error: "Unknown resource" }, 404);

  const key = bearerKey(req.headers.get("authorization"));
  if (!key) return json({ error: "Missing or malformed API key" }, 401);

  const admin = createAdminClient();
  const { data: row } = await admin.from("api_keys").select("id, scopes, revoked_at").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (!row || row.revoked_at) return json({ error: "Invalid API key" }, 401);
  if (!(row.scopes as string[]).includes(res.scope)) return json({ error: `This key needs the ${res.scope} scope` }, 403);

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const { data, error } = await admin
    .from(res.table)
    .select(res.columns)
    .order(res.order, { ascending: false })
    .range(offset, offset + limit - 1);
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  if (error) return json({ error: "Couldn't read data" }, 500);
  return json({ data, limit, offset });
}
