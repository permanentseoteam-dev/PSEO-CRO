import { describe, expect, it } from "vitest";
import {
  agingBucket,
  agingExport,
  applyCreditPreview,
  buildMonthlyDrafts,
  checkApplyCredit,
  checkGiveBack,
  checkPastInvoice,
  checkSubLink,
  creditBalances,
  invoiceBalance,
  isPortalVisible,
  lineTotals,
  nextMonthStart,
  pastInvoiceStatus,
  sendSummary,
  toCsv,
  upworkFee,
  upworkStats,
} from "../logic";
import { getEmailSender } from "../email";
import type { BillingProfile, InvoiceLite, UpworkEarning, UpworkWithdrawal } from "../types";

const profile = (o: Partial<BillingProfile>): BillingProfile => ({
  clientId: "c1",
  clientName: "Alba Motors",
  entityId: "e-ps",
  entityName: "Permanent SEO FZ-LLC",
  currency: "AED",
  agreedFee: 14000,
  feeBasis: "monthly",
  termsDays: 14,
  taxRate: 5,
  ...o,
});

const inv = (o: Partial<InvoiceLite>): InvoiceLite => ({
  id: "i1",
  number: "INV-1",
  clientId: "c1",
  clientName: "Alba Motors",
  entityId: "e-ps",
  currency: "AED",
  status: "issued",
  title: null,
  issuedOn: "2026-10-01",
  dueOn: "2026-10-15",
  total: 1000,
  amountPaid: 0,
  paidBeforePortal: 0,
  creditApplied: 0,
  ...o,
});

describe("monthly drafts", () => {
  it("drafts next month from today", () => {
    expect(nextMonthStart("2026-11-04")).toBe("2026-12-01");
    expect(nextMonthStart("2026-12-31")).toBe("2027-01-01");
  });

  it("makes one draft per monthly client with tax and due date", () => {
    const plans = buildMonthlyDrafts({ profiles: [profile({})], links: [], month: "2026-12-01", existingClientIds: [] });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ title: "December retainer", issuedOn: "2026-12-01", dueOn: "2026-12-15", subtotal: 14000, tax: 700, total: 14700 });
  });

  it("skips non-monthly, zero-fee and already-drafted clients", () => {
    const plans = buildMonthlyDrafts({
      profiles: [profile({ clientId: "a", feeBasis: "hourly" }), profile({ clientId: "b", agreedFee: 0 }), profile({ clientId: "c" }), profile({ clientId: "d" })],
      links: [],
      month: "2026-12-01",
      existingClientIds: ["c"],
    });
    expect(plans.map((p) => p.clientId)).toEqual(["d"]);
  });

  it("rolls a sub-account billed under its parent into the parent's draft", () => {
    const plans = buildMonthlyDrafts({
      profiles: [profile({}), profile({ clientId: "c2", clientName: "Alba Rent a Car", agreedFee: 3000, taxRate: 0 })],
      links: [{ parentId: "c1", childId: "c2", billing: "parent" }],
      month: "2026-12-01",
      existingClientIds: [],
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].lines).toHaveLength(2);
    expect(plans[0].lines[1].description).toBe("December retainer, Alba Rent a Car");
    expect(plans[0].lines[1].taxPct).toBe(5); // parent's entity tax applies
    expect(plans[0].total).toBe(17850);
    expect(plans[0].subClientIds).toEqual(["c2"]);
  });

  it("bills a sub-account separately when billing is 'own' or the currency differs", () => {
    const profiles = [profile({}), profile({ clientId: "c2", currency: "USD" }), profile({ clientId: "c3" })];
    const plans = buildMonthlyDrafts({
      profiles,
      links: [
        { parentId: "c1", childId: "c2", billing: "parent" },
        { parentId: "c1", childId: "c3", billing: "own" },
      ],
      month: "2026-12-01",
      existingClientIds: [],
    });
    expect(plans.map((p) => p.clientId).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("totals lines as qty x rate plus tax", () => {
    expect(lineTotals([{ description: "x", qty: 4, rate: 500, taxPct: 5 }, { description: "y", qty: 1, rate: 7500, taxPct: 5 }])).toEqual({
      subtotal: 9500,
      tax: 475,
      total: 9975,
    });
  });
});

describe("past invoices and portal", () => {
  it("derives status from what was already paid", () => {
    expect(pastInvoiceStatus(100, 100)).toBe("paid");
    expect(pastInvoiceStatus(100, 40)).toBe("partly_paid");
    expect(pastInvoiceStatus(100, 0)).toBe("issued");
  });

  it("validates a past invoice", () => {
    const ok = { total: 100, paid: 0, issuedOn: "2025-12-01", dueOn: "2025-12-15", today: "2026-11-04" };
    expect(checkPastInvoice(ok)).toBeNull();
    expect(checkPastInvoice({ ...ok, paid: 101 })).toMatch(/more than the total/);
    expect(checkPastInvoice({ ...ok, dueOn: "2025-11-01" })).toMatch(/before the issue/);
    expect(checkPastInvoice({ ...ok, issuedOn: "2026-12-01", dueOn: "2026-12-15" })).toMatch(/future/);
  });

  it("never shows drafts or voids; others follow the toggle, shown by default", () => {
    expect(isPortalVisible("draft", { portal_visible: true })).toBe(false);
    expect(isPortalVisible("void", null)).toBe(false);
    expect(isPortalVisible("issued", null)).toBe(true);
    expect(isPortalVisible("paid", { portal_visible: false })).toBe(false);
  });
});

describe("credit", () => {
  it("balance subtracts payments, pre-portal payments and applied credit", () => {
    expect(invoiceBalance(inv({ total: 1000, amountPaid: 200, paidBeforePortal: 100, creditApplied: 250 }))).toBe(450);
    expect(invoiceBalance(inv({ total: 100, amountPaid: 150 }))).toBe(0);
  });

  it("credit left = credit in minus credit used, per client and currency", () => {
    const names = new Map([["c1", "Alba Motors"], ["c2", "Harbor Legal"]]);
    const b = creditBalances(
      [
        { clientId: "c1", currency: "AED", amount: 1200 },
        { clientId: "c2", currency: "USD", amount: 250 },
        { clientId: "c2", currency: "AED", amount: 50 },
      ],
      [
        { clientId: "c1", currency: "AED", amount: 200 },
        { clientId: "c2", currency: "USD", amount: 250 },
      ],
      names,
    );
    expect(b).toEqual([
      { clientId: "c1", clientName: "Alba Motors", currency: "AED", amount: 1000 },
      { clientId: "c2", clientName: "Harbor Legal", currency: "AED", amount: 50 },
    ]);
  });

  it("checks apply credit", () => {
    const base = { amount: 250, available: 250, invoiceBalance: 1500, sameClient: true, sameCurrency: true };
    expect(checkApplyCredit(base)).toBeNull();
    expect(checkApplyCredit({ ...base, amount: 300 })).toMatch(/credit left/);
    expect(checkApplyCredit({ ...base, invoiceBalance: 100 })).toMatch(/invoice balance/);
    expect(checkApplyCredit({ ...base, sameCurrency: false })).toMatch(/currency/);
    expect(checkApplyCredit({ ...base, sameClient: false })).toMatch(/same client/);
  });

  it("give back needs a reason and enough credit", () => {
    expect(checkGiveBack({ amount: 100, available: 250, reason: "Client asked" })).toBeNull();
    expect(checkGiveBack({ amount: 100, available: 250, reason: "  " })).toMatch(/reason/);
    expect(checkGiveBack({ amount: 300, available: 250, reason: "x" })).toMatch(/credit left/);
  });

  it("previews the result in plain words", () => {
    expect(applyCreditPreview("INV-PU-0056", 1500, 250, 250, "USD")).toBe("INV-PU-0056 balance drops to USD 1,250. No credit left.");
    expect(applyCreditPreview("INV-1", 1000, 200, 500, "AED")).toBe("INV-1 balance drops to AED 800. AED 300 credit left.");
  });
});

describe("upwork", () => {
  it("fee defaults to 10%", () => {
    expect(upworkFee(1300)).toBe(130);
    expect(upworkFee(680.5)).toBe(68.05);
  });

  it("stats for the month", () => {
    const e = (o: Partial<UpworkEarning>): UpworkEarning => ({
      id: "x", contract: "c", upwork_client: "u", kind: "fixed", hours: null, earned: 0, fee: 0, currency: "USD", status: "released", earned_on: "2026-11-02", note: null, ...o,
    });
    const w = (o: Partial<UpworkWithdrawal>): UpworkWithdrawal => ({ id: "w", amount: 0, currency: "USD", withdrawn_on: "2026-11-03", to_account: "Wise", reference: null, ...o });
    const s = upworkStats(
      [e({ earned: 1200, fee: 120 }), e({ earned: 1300, fee: 130, status: "in_review" }), e({ earned: 500, fee: 50, earned_on: "2026-10-20", status: "pending_release" })],
      [w({ amount: 4600, to_account: "Wise USD ••7720" }), w({ amount: 999, withdrawn_on: "2026-10-01" })],
      "2026-11-01",
    );
    expect(s).toEqual({ earned: 2500, fees: 250, pending: 1620, withdrawn: 4600, lastAccount: "Wise USD ••7720" });
  });
});

describe("exports", () => {
  it("buckets by days late", () => {
    expect(agingBucket("2026-11-10", "2026-11-04")).toBe("not_due");
    expect(agingBucket("2026-11-04", "2026-11-04")).toBe("not_due");
    expect(agingBucket("2026-10-15", "2026-11-04")).toBe("1_30");
    expect(agingBucket("2026-09-15", "2026-11-04")).toBe("31_60");
    expect(agingBucket("2026-08-15", "2026-11-04")).toBe("61_90");
    expect(agingBucket("2026-01-15", "2026-11-04")).toBe("90_plus");
  });

  it("escapes CSV and blocks spreadsheet formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', null, 12.345, "=SUM(A1)", -5]])).toBe('"a,b","say ""hi""",,12.35,\'=SUM(A1),-5\r\n');
  });

  it("aging export lists open invoices and totals per currency and bucket", () => {
    const rows = agingExport(
      [
        inv({ id: "1", number: "A", dueOn: "2026-10-15", total: 1000 }),
        inv({ id: "2", number: "B", dueOn: "2026-10-20", total: 500, amountPaid: 100 }),
        inv({ id: "3", number: "C", status: "paid", total: 700, amountPaid: 700 }),
      ],
      "2026-11-04",
    );
    expect(rows.slice(1, 3).map((r) => r[0])).toEqual(["A", "B"]);
    expect(rows.at(-1)).toEqual(["", "", "", "AED", 1400, "", "1–30 days"]);
  });
});

describe("sub-account links", () => {
  const links = [{ parentId: "p", childId: "c", billing: "parent" as const }];
  it("allows a fresh link and a re-link to the same parent", () => {
    expect(checkSubLink("p", "x", links)).toBeNull();
    expect(checkSubLink("p", "c", links)).toBeNull();
  });
  it("blocks self, double parents and chains", () => {
    expect(checkSubLink("p", "p", links)).toMatch(/own sub-account/);
    expect(checkSubLink("q", "c", links)).toMatch(/another client/);
    expect(checkSubLink("c", "x", links)).toMatch(/itself a sub-account/);
    expect(checkSubLink("q", "p", links)).toMatch(/its own sub-accounts/);
  });
});

describe("email", () => {
  it("counts the last 30 days", () => {
    const s = sendSummary(
      [
        { status: "sent", created_at: "2026-11-03T10:00:00Z" },
        { status: "bounced", created_at: "2026-10-06T10:00:00Z" },
        { status: "sent", created_at: "2026-10-05T10:00:00Z" },
        { status: "failed", created_at: "2026-11-04T08:00:00Z" },
      ],
      "2026-11-04",
    );
    expect(s).toEqual({ sent: 1, bounced: 1, failed: 1 });
  });

  it("every provider is not configured", async () => {
    for (const p of ["resend", "brevo", "smtp", "none"] as const) {
      const sender = getEmailSender(p);
      expect(sender.configured).toBe(false);
      const r = await sender.send("a@b.co", "Hi", "<p>x</p>");
      expect(r.ok).toBe(false);
    }
  });
});
