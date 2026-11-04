import { describe, expect, it } from "vitest";
import {
  clientStatus,
  commitmentState,
  dubaiHour,
  dubaiToday,
  fileSize,
  fileType,
  fmtDate,
  fmtWhen,
  greeting,
  invoiceTotals,
  invoiceView,
  meetHref,
  money,
  portalRedirect,
  safeName,
} from "../logic";

const today = "2026-11-04";

describe("greeting", () => {
  it("follows the hour", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(12)).toBe("Good afternoon");
    expect(greeting(19)).toBe("Good evening");
  });
  it("uses Dubai time", () => {
    const d = new Date("2026-11-04T21:30:00Z"); // 01:30 on 5 Nov in Dubai
    expect(dubaiHour(d)).toBe(1);
    expect(dubaiToday(d)).toBe("2026-11-05");
  });
});

describe("clientStatus", () => {
  it("uses client words", () => {
    expect(clientStatus("todo")).toEqual({ label: "Planned", tone: "muted" });
    expect(clientStatus("in_review").label).toBe("Ready soon");
    expect(clientStatus("blocked").label).toBe("On hold");
  });
});

describe("commitmentState", () => {
  it("done wins", () => expect(commitmentState({ status: "done", due_date: "2026-10-01" }, today).label).toBe("Done"));
  it("late after the due date", () => expect(commitmentState({ status: "in_progress", due_date: "2026-11-03" }, today).label).toBe("Late"));
  it("at risk when blocked or not started close to the date", () => {
    expect(commitmentState({ status: "blocked", due_date: "2026-11-20" }, today).label).toBe("At risk");
    expect(commitmentState({ status: "todo", due_date: "2026-11-06" }, today).label).toBe("At risk");
  });
  it("on track otherwise", () => {
    expect(commitmentState({ status: "in_progress", due_date: "2026-11-05" }, today).label).toBe("On track");
    expect(commitmentState({ status: "todo", due_date: null }, today).label).toBe("On track");
  });
});

describe("invoiceView", () => {
  const base = { status: "issued", due_on: "2026-11-15", total: 14000, amount_paid: 0, written_off_amount: 0 };
  it("open", () => expect(invoiceView(base, today)).toEqual({ label: "Open", tone: "blue", balance: 14000 }));
  it("overdue when past due with a balance", () =>
    expect(invoiceView({ ...base, status: "partly_paid", due_on: "2026-10-15", amount_paid: 9800 }, today)).toEqual({
      label: "Overdue",
      tone: "danger",
      balance: 4200,
    }));
  it("partly paid before the due date", () =>
    expect(invoiceView({ ...base, status: "partly_paid", amount_paid: 4000 }, today).label).toBe("Partly paid"));
  it("closed statuses owe nothing", () => {
    expect(invoiceView({ ...base, status: "paid", amount_paid: 14000 }, today)).toEqual({ label: "Paid", tone: "ok", balance: 0 });
    expect(invoiceView({ ...base, status: "void" }, today).balance).toBe(0);
    expect(invoiceView({ ...base, status: "written_off", written_off_amount: 14000 }, today).label).toBe("Closed");
  });
  it("disputed keeps its balance", () => expect(invoiceView({ ...base, status: "disputed" }, today).balance).toBe(14000));
});

describe("formatting", () => {
  it("money", () => {
    expect(money(14000, "AED")).toBe("AED 14,000");
    expect(money(666.67, "USD")).toBe("USD 666.67");
  });
  it("file size and type", () => {
    expect(fileSize(48 * 1024)).toBe("48 KB");
    expect(fileSize(2.4 * 1_048_576)).toBe("2.4 MB");
    expect(fileSize(10)).toBe("1 KB");
    expect(fileType("Brand guidelines 2026.pdf")).toBe("PDF");
    expect(fileType("README")).toBe("FILE");
  });
  it("safe names", () => {
    expect(safeName("Service menu Nov.pdf")).toBe("Service-menu-Nov.pdf");
    expect(safeName("///")).toBe("file");
  });
  it("dates", () => {
    expect(fmtDate("2026-11-10")).toBe("10 Nov");
    expect(fmtWhen("2026-11-06T07:00:00Z")).toBe("Fri 6 Nov, 11:00");
  });
  it("meeting links", () => {
    expect(meetHref("meet.google.com/abc")).toBe("https://meet.google.com/abc");
    expect(meetHref("https://x.y")).toBe("https://x.y");
    expect(meetHref(null)).toBeNull();
  });
});

describe("portalRedirect", () => {
  it("sends /portal to /portal/home for everyone", () => {
    expect(portalRedirect("client", "/portal")).toBe("/portal/home");
    expect(portalRedirect("staff", "/portal/")).toBe("/portal/home");
  });
  it("keeps clients inside the portal", () => {
    expect(portalRedirect("client", "/home")).toBe("/portal/home");
    expect(portalRedirect("client", "/finance/invoices")).toBe("/portal/home");
    expect(portalRedirect("client", "/portal/work")).toBeNull();
    expect(portalRedirect("client", "/api/finance/invoices/x/pdf")).toBeNull();
    expect(portalRedirect("client", "/auth/callback")).toBeNull();
  });
  it("lets staff and signed-out users through", () => {
    expect(portalRedirect("staff", "/home")).toBeNull();
    expect(portalRedirect(null, "/tickets")).toBeNull();
  });
});

describe("invoiceTotals", () => {
  const inv = (number: string, status: string, due_on: string, total: number, amount_paid: number, currency = "AED") => ({
    number,
    status,
    due_on,
    total,
    amount_paid,
    written_off_amount: 0,
    currency,
  });
  it("sums open, overdue and this year's receipts in one currency", () => {
    const t = invoiceTotals(
      [
        inv("PS-118", "issued", "2026-11-15", 14000, 0),
        inv("PS-104", "partly_paid", "2026-10-15", 14000, 9800),
        inv("PS-091", "paid", "2026-09-15", 14000, 14000),
        inv("US-1", "issued", "2026-10-01", 500, 0, "USD"),
      ],
      [
        { amount: 9800, currency: "AED", receivedOn: "2026-10-18" },
        { amount: 14000, currency: "AED", receivedOn: "2025-12-20" },
      ],
      today,
    );
    expect(t).toEqual({ currency: "AED", open: 18200, openCount: 2, overdue: 4200, oldest: { number: "PS-104", due_on: "2026-10-15" }, paidYear: 9800 });
  });
  it("handles no invoices", () => {
    expect(invoiceTotals([], [], today)).toMatchObject({ currency: "AED", open: 0, openCount: 0, overdue: 0, oldest: null, paidYear: 0 });
  });
});
