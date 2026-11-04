import { it, expect } from "vitest";
import { renderInvoicePdf } from "../pdf";
it("renders", async () => {
  const buf = await renderInvoicePdf({
    invoice: { id: "x", number: "INV-PS-0142", draft_no: 1, status: "partly_paid", client_id: "c", client_name: "Cedar", entity_id: "e", currency: "AED",
      issued_on: "2026-11-01", due_on: "2026-11-15", title: "November SEO", total: 9975, amount_paid: 4000, amount_refunded: 0, written_off_amount: 0, fx_rate_usd: 0.27,
      po_ref: "PO", discount: 0, subtotal: 9500, tax_total: 475, channel_id: null, pay_link: "https://x", notes: "Thanks", terms: "14 days",
      bill_to: { name: "Cedar LLC", address: "Dubai" }, status_reason: null,
      lines: [{ description: "SEO", detail: "d", qty: 1, rate: 7500, tax_pct: 5 }, { description: "Blog", detail: "", qty: 4, rate: 500, tax_pct: 5 }] },
    entity: { id: "e", code: "ps", name: "Permanent SEO FZ-LLC", short_name: "FZ", country: null, address: "Dubai", tax_id: "TRN", invoice_prefix: "PS", tax_label: "VAT", tax_rate: 5, currency: "AED" },
    channel: { id: "w", name: "Bank ENBD", type: "bank", account: null, details: "IBAN" },
  });
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
});
