import { payslipPdfResponse } from "@/features/hr-p2/payslip-pdf";

/** Payslip PDF. Also serves HR viewing someone else's payslips: RLS plus hr.pay.view decide access. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return payslipPdfResponse((await params).id);
}
