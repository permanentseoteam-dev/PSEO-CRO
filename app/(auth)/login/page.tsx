import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth/can";
import { getAal, needsVerify, verifyPath } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { homeFor, safeNext } from "@/lib/modules/access/logic";
import { LoginForm } from "./_components/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next, error, email } = await searchParams;
  const me = await getMe();
  if (me) redirect(safeNext(next, homeFor(me.kind)));
  // Password or code done, authenticator code still to come.
  if (needsVerify(await getAal())) redirect(verifyPath(next));
  // Signed in but not an active member: explain instead of looping back here.
  const { data } = await (await createClient()).auth.getUser();
  if (data.user) redirect("/no-access");

  return (
    <LoginForm
      next={next}
      initialEmail={email ?? ""}
      initialError={error === "link" ? "That link has expired. Sign in, or ask for a new link." : undefined}
    />
  );
}
