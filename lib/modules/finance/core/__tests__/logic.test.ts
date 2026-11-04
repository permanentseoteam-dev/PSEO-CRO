import { describe, expect, it } from "vitest";
import {
  agingBucket,
  agingBuckets,
  balance,
  computeTotals,
  convert,
  displayStatus,
  isOverdue,
  last12Months,
  lateDays,
  periodRange,
  statusFromAmounts,
  statusKeys,
  type Money,
} from "../logic";

const TODAY = "2026-11-04";

describe("computeTotals", () => {
  it("matches INV-PS-0142: two lines at 5% VAT", () => {
    const t = computeTotals(
      [
        { qty: 1, rate: 7500, taxPct: 5 },
        { qty: 4, rate: 500, taxPct: 5 },
      ],
      0,
    );
    expect(t).toEqual({ lines: [7500, 2000], subtotal: 9500, discount: 0, tax: 475, total: 9975 });
  });

  it("spreads the discount over lines before tax", () => {
    // 1000 at 10% and 1000 at 0%, discount 200 → 100 off each line; tax = 900 × 10% = 90.
    const t = computeTotals(
      [
        { qty: 1, rate: 1000, taxPct: 10 },
        { qty: 2, rate: 500, taxPct: 0 },
      ],
      200,
    );
    expect(t.subtotal).toBe(2000);
    expect(t.discount).toBe(200);
    expect(t.tax).toBe(90);
    expect(t.total).toBe(1890);
  });

  it("caps the discount at the subtotal and ignores negatives", () => {
    expect(computeTotals([{ qty: 1, rate: 100, taxPct: 5 }], 500)).toMatchObject({ discount: 100, tax: 0, total: 0 });
    expect(computeTotals([{ qty: 1, rate: 100, taxPct: 5 }], -10)).toMatchObject({ discount: 0, total: 105 });
  });

  it("rounds to cents", () => {
    const t = computeTotals([{ qty: 3, rate: 33.33, taxPct: 5 }], 0);
    expect(t.subtotal).toBe(99.99);
    expect(t.tax).toBe(5);
    expect(t.total).toBe(104.99);
  });

  it("handles no lines", () => {
    expect(computeTotals([], 50)).toEqual({ lines: [], subtotal: 0, discount: 0, tax: 0, total: 0 });
  });
});

describe("balance, overdue and status", () => {
  const inv = (o: Partial<Money>): Money => ({ status: "issued", total: 1000, paid: 0, due: "2026-11-01", ...o });

  it("only open statuses carry a balance", () => {
    expect(balance(inv({ paid: 400, status: "partly_paid" }))).toBe(600);
    expect(balance(inv({ status: "disputed" }))).toBe(1000);
    expect(balance(inv({ status: "void" }))).toBe(0);
    expect(balance(inv({ status: "written_off" }))).toBe(0);
    expect(balance(inv({ status: "draft" }))).toBe(0);
  });

  it("is overdue after the due date, never when disputed or paid", () => {
    expect(isOverdue(inv({ due: "2026-11-03" }), TODAY)).toBe(true);
    expect(lateDays(inv({ due: "2026-11-03" }), TODAY)).toBe(1);
    expect(isOverdue(inv({ due: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(inv({ due: "2026-10-01", status: "disputed" }), TODAY)).toBe(false);
    expect(isOverdue(inv({ due: "2026-10-01", status: "paid", paid: 1000 }), TODAY)).toBe(false);
  });

  it("derives the shown status and filter keys", () => {
    expect(displayStatus(inv({ due: "2026-10-15", status: "partly_paid", paid: 6000, total: 14700 }), TODAY)).toEqual({
      label: "Overdue",
      tone: "danger",
      sub: "20 days, partly paid",
    });
    expect(displayStatus(inv({ due: "2026-11-30" }), TODAY).label).toBe("Issued");
    expect(statusKeys(inv({ due: "2026-10-15" }), TODAY)).toEqual(["issued", "open", "overdue"]);
  });

  it("works out status after payments and refunds", () => {
    expect(statusFromAmounts(1000, 0, 0)).toBe("issued");
    expect(statusFromAmounts(1000, 400, 0)).toBe("partly_paid");
    expect(statusFromAmounts(1000, 1000, 0)).toBe("paid");
    expect(statusFromAmounts(6300, 6300, 1260)).toBe("partly_refunded");
    expect(statusFromAmounts(3000, 3000, 3000)).toBe("refunded");
  });
});

describe("aging", () => {
  it("buckets by days late", () => {
    expect([0, -3, 1, 30, 31, 60, 61, 90, 91, 400].map(agingBucket)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("sums open balances only, converted", () => {
    const list: Money[] = [
      { status: "issued", total: 100, paid: 0, due: "2026-11-10" }, // not due
      { status: "partly_paid", total: 100, paid: 40, due: "2026-10-20" }, // 15 days
      { status: "issued", total: 50, paid: 0, due: "2026-08-01" }, // 95 days
      { status: "paid", total: 70, paid: 70, due: "2026-08-01" }, // closed
      { status: "void", total: 70, paid: 0, due: "2026-08-01" }, // closed
    ];
    expect(agingBuckets(list, TODAY)).toEqual([100, 60, 0, 0, 50]);
    expect(agingBuckets(list, TODAY, (_, b) => b * 2)).toEqual([200, 120, 0, 0, 100]);
  });
});

describe("currency and periods", () => {
  const rates = { USD: 1, AED: 0.2723, PKR: 0.0036 };
  it("converts through USD, preferring a saved rate", () => {
    expect(convert(1000, "AED", "USD", rates)).toBeCloseTo(272.3);
    expect(convert(272.3, "USD", "AED", rates)).toBeCloseTo(1000);
    expect(convert(1000, "AED", "USD", rates, 0.25)).toBe(250);
    expect(convert(5, "PKR", "PKR", rates)).toBe(5);
  });

  it("builds period ranges", () => {
    expect(periodRange("month", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("last", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("quarter", TODAY)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodRange("ytd", TODAY)).toEqual({ from: "2026-01-01", to: TODAY });
    expect(periodRange("year", TODAY)).toEqual({ from: "2025-12-01", to: "2026-11-30" });
    expect(periodRange("last", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("lists the last 12 months", () => {
    const m = last12Months(TODAY);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-12");
    expect(m[11]).toBe("2026-11");
  });
});
