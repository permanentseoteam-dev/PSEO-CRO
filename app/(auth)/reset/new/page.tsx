import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getAal, needsVerify, verifyPath } from "@/lib/auth/mfa";
import { NewPasswordForm } from "./_components/new-password-form";

export const metadata = { title: "Set a new password" };

// Reached from the reset email via /auth/callback, which signs the person in for this step.
export default async function NewPasswordPage() {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) {
    return (
      <div className="grid gap-5">
        <div className="grid gap-1">
          <h1>This link has expired</h1>
          <p className="muted">Reset links work once and only for a short time.</p>
        </div>
        <ButtonLink href="/reset" variant="primary" className="w-full">
          Send a new link
        </ButtonLink>
      </div>
    );
  }
  // With 2-step on, the reset link only gives a first-step session; ask for the app code before the new password.
  if (needsVerify(await getAal())) redirect(verifyPath("/reset/new"));
  return <NewPasswordForm email={data.user.email ?? ""} />;
}
