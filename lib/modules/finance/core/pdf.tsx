// Invoice PDF for @react-pdf/renderer (server only). Print colours are fixed; the app themes don't apply to paper.
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { balance, computeTotals, fmtDate, invoiceLabel, money, round2, settledOutside } from "./logic";
import type { Entity, InvoiceDetail, PayChannel } from "./types";
import { getAgencyBrand } from "@/lib/modules/agency/queries";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#3b3f48", fontFamily: "Helvetica", lineHeight: 1.4 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  h: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#111318" },
  strong: { fontFamily: "Helvetica-Bold", color: "#111318" },
  muted: { color: "#7a7f8a" },
  right: { textAlign: "right" },
  section: { marginTop: 22 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#d9dce1", paddingBottom: 4, color: "#7a7f8a" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#e6e8eb", paddingVertical: 6 },
  cItem: { flex: 1, paddingRight: 8 },
  cNum: { width: 70, textAlign: "right" },
  totals: { marginTop: 12, marginLeft: "auto", width: 230 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { borderTopWidth: 1, borderColor: "#d9dce1", marginTop: 4, paddingTop: 6 },
  pay: { marginTop: 22, padding: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#c9ccd2", borderRadius: 6 },
});

export function InvoicePdf({ invoice: i, entity: e, channel, agencyName }: PdfProps) {
  const t = computeTotals(i.lines.map((l) => ({ qty: l.qty, rate: l.rate, taxPct: l.tax_pct })), i.discount);
  const cur = i.currency;
  const b = i.bill_to ?? {};
  const paid = round2(i.amount_paid - i.amount_refunded);
  const due = i.status === "draft" ? t.total : balance({ status: i.status, total: i.total, paid: i.amount_paid, settled: settledOutside(i), due: i.due_on });
  const taxLabel = e && e.tax_label !== "None" ? e.tax_label : "Tax";

  return (
    <Document title={invoiceLabel(i)} author={e?.name ?? agencyName ?? "Permanent SEO"}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.h}>Invoice</Text>
            <Text style={s.strong}>{invoiceLabel(i)}</Text>
            {i.status === "void" ? <Text style={s.strong}>VOID</Text> : null}
          </View>
          {e ? (
            <View style={{ maxWidth: 240 }}>
              <Text style={[s.strong, s.right]}>{e.name}</Text>
              {e.address ? <Text style={s.right}>{e.address}</Text> : null}
              {e.tax_id ? <Text style={s.right}>{e.tax_id}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={[s.row, s.section]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.muted}>Bill to</Text>
            <Text style={s.strong}>{b.name || i.client_name}</Text>
            {b.address ? <Text>{b.address}</Text> : null}
            {b.tax_id ? <Text>{b.tax_id}</Text> : null}
          </View>
          <View>
            <Text>
              <Text style={s.muted}>Issued </Text>
              {fmtDate(i.issued_on)}
            </Text>
            <Text>
              <Text style={s.muted}>Due </Text>
              {fmtDate(i.due_on)}
            </Text>
            {i.po_ref ? (
              <Text>
                <Text style={s.muted}>Reference </Text>
                {i.po_ref}
              </Text>
            ) : null}
          </View>
        </View>

        {i.title ? <Text style={[s.strong, s.section]}>{i.title}</Text> : null}

        <View style={{ marginTop: 10 }}>
          <View style={s.th}>
            <Text style={s.cItem}>Item</Text>
            <Text style={[s.cNum, { width: 40 }]}>Qty</Text>
            <Text style={s.cNum}>Rate</Text>
            <Text style={[s.cNum, { width: 40 }]}>Tax</Text>
            <Text style={s.cNum}>Amount</Text>
          </View>
          {i.lines.map((l, k) => (
            <View key={k} style={s.tr} wrap={false}>
              <View style={s.cItem}>
                <Text style={s.strong}>{l.description || "Untitled line"}</Text>
                {l.detail ? <Text>{l.detail}</Text> : null}
              </View>
              <Text style={[s.cNum, { width: 40 }]}>{l.qty}</Text>
              <Text style={s.cNum}>{money(l.rate, cur)}</Text>
              <Text style={[s.cNum, { width: 40 }]}>{l.tax_pct}%</Text>
              <Text style={s.cNum}>{money(t.lines[k], cur)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.tRow}>
            <Text>Subtotal</Text>
            <Text>{money(t.subtotal, cur)}</Text>
          </View>
          {t.discount ? (
            <View style={s.tRow}>
              <Text>Discount</Text>
              <Text>- {money(t.discount, cur)}</Text>
            </View>
          ) : null}
          <View style={s.tRow}>
            <Text>{taxLabel}</Text>
            <Text>{money(t.tax, cur)}</Text>
          </View>
          <View style={[s.tRow, s.grand]}>
            <Text style={s.strong}>Total</Text>
            <Text style={s.strong}>{money(t.total, cur)}</Text>
          </View>
          {paid > 0 ? (
            <View style={s.tRow}>
              <Text>Paid</Text>
              <Text>- {money(paid, cur)}</Text>
            </View>
          ) : null}
          <View style={s.tRow}>
            <Text style={s.strong}>Balance due</Text>
            <Text style={s.strong}>{money(due, cur)}</Text>
          </View>
        </View>

        {channel || i.pay_link ? (
          <View style={s.pay} wrap={false}>
            {channel ? <Text style={s.strong}>Pay by {channel.name}</Text> : null}
            {channel?.details ? <Text>{channel.details}</Text> : null}
            {i.pay_link ? <Text>Pay online: {i.pay_link}</Text> : null}
          </View>
        ) : null}

        {i.notes ? <Text style={s.section}>{i.notes}</Text> : null}
        {i.terms ? <Text style={[s.muted, { marginTop: 8 }]}>{i.terms}</Text> : null}
      </Page>
    </Document>
  );
}

type PdfProps = { invoice: InvoiceDetail; entity: Entity | null; channel: PayChannel | null; agencyName?: string };

/** Render the invoice to a PDF buffer. */
export async function renderInvoicePdf(props: PdfProps) {
  const agencyName = props.agencyName ?? (await getAgencyBrand()).name;
  return renderToBuffer(<InvoicePdf {...props} agencyName={agencyName} />);
}
