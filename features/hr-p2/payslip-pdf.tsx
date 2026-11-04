import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getMe, can } from "@/lib/auth/can";
import { getPayslip } from "./queries";
import { fmtMonth, money } from "./logic";

// PDFs are not themed, so plain named colours are used here (no CSS variables in react-pdf).
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "black" },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: "grey" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "lightgrey" },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, fontFamily: "Helvetica-Bold" },
  block: { marginTop: 24 },
});

/**
 * GET handler body for a payslip PDF. Mount as a route (see WIRING.md):
 *   export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { return payslipPdfResponse((await params).id); }
 * RLS on hr_payslips decides who can read it; a missing row is a 404.
 */
export async function payslipPdfResponse(id: string): Promise<Response> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return new Response("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const slip = await getPayslip(id);
  if (!slip || (slip.member_id !== me.id && !can(me, "hr.pay.view", "team"))) return new Response("Not found", { status: 404 });

  const buf = await renderToBuffer(
    <Document title={`Payslip ${fmtMonth(slip.month)}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Payslip · {fmtMonth(slip.month)}</Text>
        <Text style={s.muted}>
          {slip.memberName}
          {slip.memberTitle ? ` · ${slip.memberTitle}` : ""}
        </Text>
        <View style={s.block}>
          <View style={s.row}>
            <Text>Gross pay</Text>
            <Text>{money(slip.gross, slip.currency)}</Text>
          </View>
          <View style={s.row}>
            <Text>Deductions</Text>
            <Text>{money(slip.deductions, slip.currency)}</Text>
          </View>
          <View style={s.total}>
            <Text>Net pay</Text>
            <Text>{money(slip.net, slip.currency)}</Text>
          </View>
        </View>
        {slip.notes ? <Text style={[s.block, s.muted]}>{slip.notes}</Text> : null}
      </Page>
    </Document>,
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${slip.month.slice(0, 7)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
