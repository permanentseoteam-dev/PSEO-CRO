import { describe, expect, it } from "vitest";
import { buildDashboard } from "../dashboard";
import type { Entity, InvoiceRow } from "../types";

const ent = (id: string, currency: "AED" | "USD"): Entity => ({
  id, code: id, name: id, short_name: id, country: null, address: null, tax_id: null, invoice_prefix: id.toUpperCase(), tax_label: "VAT", tax_rate: 0, currency,
});
const inv = (o: Partial<InvoiceRow>): InvoiceRow => ({
  id: "x", number: "INV-PS-0001", draft_no: 1, status: "issued", client_id: "c", client_name: "C", entity_id: "ps", currency: "AED",
  issued_on: "2026-11-01", due_on: "2026-11-15", title: "", total: 1000, amount_paid: 0, amount_refunded: 0, written_off_amount: 0, fx_rate_usd: 0.25, ...o,
});

const base = {
  today: "2026-11-04",
  period: "month" as const,
  entityId: null,
  currency: "USD" as const,
  rates: { USD: 1, AED: 0.25 },
  entities: [ent("ps", "AED"), ent("pu", "USD")],
  channels: [{ id: "w", name: "Wise", type: "wise", account: null, details: null }],
  refunds: [],
};

describe("buildDashboard", () => {
  const invoices = [
    inv({ id: "a" }), // this month, open, not due
    inv({ id: "b", issued_on: "2026-10-01", due_on: "2026-10-15", amount_paid: 400, status: "partly_paid" }), // overdue 600 AED
    inv({ id: "c", entity_id: "pu", currency: "USD", fx_rate_usd: 1, total: 500, status: "void" }), // voided this month
    inv({ id: "d", status: "draft", number: null }), // ignored
  ];
  const receipts = [
    { date: "2026-11-02", amount: 400, fee: 4, currency: "AED" as const, rate: 0.25, channelId: "w" },
    { date: "2026-10-20", amount: 100, fee: 0, currency: "USD" as const, rate: 1, channelId: null },
  ];

  it("works out KPIs in the chosen currency", () => {
    const d = buildDashboard({ ...base, invoices, receipts });
    expect(d.stats).toMatchObject({
      invoiced: 250, // only "a"; void and draft excluded
      collected: 100,
      fees: 1,
      outstanding: 400, // 1000 + 600 AED at 0.25
      openCount: 2,
      overdue: 150,
      overdueCount: 1,
      voided: 500,
    });
    expect(d.aging).toEqual([250, 150, 0, 0, 0]);
    expect(d.biggest.map((b) => b.invoice.id)).toEqual(["a", "b"]);
    expect(d.byChannel).toEqual([{ name: "Wise", count: 1, collected: 100, fees: 1 }]);
    expect(d.chart.find((m) => m.ym === "2026-10")).toMatchObject({ invoiced: 250, collected: 100, inPeriod: false });
  });

  it("filters by entity, mapping receipts by currency", () => {
    const d = buildDashboard({ ...base, entityId: "pu", invoices, receipts });
    expect(d.stats.invoiced).toBe(0);
    expect(d.stats.voided).toBe(500);
    expect(d.stats.collected).toBe(0);
    expect(d.byEntity.map((e) => e.entity.id)).toEqual(["pu"]);
  });

  it("converts to AED", () => {
    const d = buildDashboard({ ...base, currency: "AED", invoices, receipts });
    expect(d.stats.invoiced).toBe(1000);
    expect(d.stats.collected).toBe(400);
  });
});
