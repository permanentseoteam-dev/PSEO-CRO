import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getInvoice } from "@/lib/modules/finance/core/queries";
import { renderInvoicePdf } from "@/lib/modules/finance/core/pdf";
import { invoiceLabel } from "@/lib/modules/finance/core/logic";
import type { Entity, PayChannel } from "@/lib/modules/finance/core/types";

export const runtime = "nodejs";

/** GET /api/finance/invoices/:id/pdf — staff with invoice access, or the invoice's own client (RLS decides which rows). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) return new Response("Sign in first.", { status: 401 });
  if (!can(me, "finance.invoices.view")) return new Response("You don't have access to this invoice.", { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invoice not found.", { status: 404 });

  const found = await getInvoice(id);
  if (!found) return new Response("Invoice not found.", { status: 404 });
  const { invoice } = found;

  const supabase = await createClient();
  const [{ data: entity }, { data: channel }] = await Promise.all([
    supabase.from("entities").select("id, code, name, short_name, country, address, tax_id, invoice_prefix, tax_label, tax_rate, currency").eq("id", invoice.entity_id).maybeSingle(),
    invoice.channel_id
      ? supabase.from("channels_pay").select("id, name, type, account, details").eq("id", invoice.channel_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const pdf = await renderInvoicePdf({ invoice, entity: (entity as Entity) ?? null, channel: (channel as PayChannel) ?? null });
  const name = invoiceLabel(invoice).replace(/[^A-Za-z0-9-]+/g, "-");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(req.url).searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
