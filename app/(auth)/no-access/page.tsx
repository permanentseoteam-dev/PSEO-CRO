import { redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/modules/access/logic";

export const metadata = { title: "No access" };

// Signed in, but the login isn't linked to an active member (never invited, suspended or left).
export default async function NoAccessPage() {
  const me = await getMe();
  if (me) redirect(homeFor(me.kind));
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>You don&apos;t have access yet</h1>
        <p className="muted">
          {data.user.email} isn&apos;t linked to an active account. Ask your admin to invite you.
        </p>
      </div>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="primary" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
