import { redirect } from "next/navigation";
import { getAal, needsVerify } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/modules/access/logic";
import { VerifyForm } from "./_components/verify-form";

export const metadata = { title: "2-step sign-in" };

// Second step after password or email code, for people with an authenticator app set up.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) redirect("/login");
  if (!needsVerify(await getAal())) redirect(safeNext(next, "/"));
  return <VerifyForm next={next} email={data.user.email ?? ""} />;
}
