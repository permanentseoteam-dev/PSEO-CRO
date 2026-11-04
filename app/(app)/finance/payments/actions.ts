"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };
const BAD_INPUT = { ok: false as const, error: "Check the form and try again." };

async function canRecord() {
  const me = await getMe();
  return !!me && me.kind === "staff" && can(me, "finance.payments.record", "all");
}

function refresh() {
  revalidatePath("/finance/payments");
  revalidatePath("/finance");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/clients");
  revalidatePath("/finance/reminders");
}

const money = z.coerce.number().finite().min(0).max(1e11);
const proofPath = z.string().min(3).max(300).regex(/^[0-9a-f-]{36}\/[^/]+$/);

const RecordInput = z
  .object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.enum(["AED", "USD", "PKR"]),
    amount: money.refine((n) => n > 0, "Enter the amount received."),
    fee: money,
    channelId: z.string().uuid().nullable(),
    account: z.string().max(120).default(""),
    reference: z.string().max(120).default(""),
    note: z.string().max(1000).default(""),
    proof: z.array(proofPath).max(10),
    noProofReason: z.string().max(300).default(""),
    allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: money })).max(100),
  })
  .refine((v) => v.fee <= v.amount, { message: "The fee can't be more than the amount." })
  .refine((v) => v.proof.length > 0 || v.noProofReason.trim().length > 0, { message: "Attach proof or say why there is none." })
  .refine((v) => v.proof.every((p) => p.startsWith(`${v.id}/`)), { message: "Proof files don't match this payment." });

export async function recordPayment(raw: unknown): Promise<Result<{ no: number }>> {
  const p = RecordInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  if (!(await canRecord())) return NO_ACCESS;
  const v = p.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_id: v.id,
    p_client: v.clientId,
    p_date: v.date,
    p_currency: v.currency,
    p_amount: v.amount,
    p_fee: v.fee,
    p_channel: v.channelId,
    p_account: v.account,
    p_reference: v.reference,
    p_note: v.note,
    p_proof: v.proof,
    p_no_proof_reason: v.proof.length ? "" : v.noProofReason.trim(),
    p_allocations: v.allocations.filter((a) => a.amount > 0).map((a) => ({ invoice_id: a.invoiceId, amount: a.amount })),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, no: Number(data) };
}

const VoidInput = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, "Give a reason for voiding.").max(500) });

export async function voidReceipt(raw: unknown): Promise<Result> {
  const p = VoidInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  if (!(await canRecord())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_receipt", { p_id: p.data.id, p_reason: p.data.reason });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const ProofInput = z.object({ id: z.string().uuid(), paths: z.array(proofPath).min(1).max(10) });

/** Add proof files to a payment after the fact. The files are already uploaded under <receipt id>/. */
export async function addProof(raw: unknown): Promise<Result> {
  const p = ProofInput.safeParse(raw);
  if (!p.success || !p.data.paths.every((x) => x.startsWith(`${p.data.id}/`))) return BAD_INPUT;
  if (!(await canRecord())) return NO_ACCESS;
  const supabase = await createClient();
  const { data: rc } = await supabase.from("receipts").select("proof_paths").eq("id", p.data.id).maybeSingle();
  if (!rc) return { ok: false, error: "Payment not found." };
  const paths = [...new Set([...((rc.proof_paths as string[]) ?? []), ...p.data.paths])];
  const { error } = await supabase.from("receipts").update({ proof_paths: paths, no_proof_reason: null }).eq("id", p.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Short-lived links to view a payment's proof files. */
export async function proofLinks(raw: unknown): Promise<Result<{ links: { name: string; url: string }[] }>> {
  const p = z.object({ id: z.string().uuid() }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "finance.payments.view", "all")) return NO_ACCESS;
  const supabase = await createClient();
  const { data: rc } = await supabase.from("receipts").select("proof_paths").eq("id", p.data.id).maybeSingle();
  const paths = ((rc?.proof_paths as string[]) ?? []).filter(Boolean);
  if (!paths.length) return { ok: true, links: [] };
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrls(paths, 300);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    links: (data ?? []).flatMap((d) => (d.signedUrl ? [{ name: (d.path ?? "").split("/").pop() ?? "file", url: d.signedUrl }] : [])),
  };
}
