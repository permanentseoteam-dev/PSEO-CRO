import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth/can";
import { getAal, getTwoStepPolicy, mfaGate, requiredByPolicy } from "@/lib/auth/mfa";
import { homeFor } from "@/lib/modules/access/logic";
import { SetupTwoStep } from "./_components/setup-two-step";

export const metadata = { title: "Set up 2-step sign-in" };

// Staff whose role the admin requires 2-step for land here (from requireMe) until they set it up.
export default async function SetupPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const required = requiredByPolicy(me.kind, me.roles, await getTwoStepPolicy());
  if (mfaGate(await getAal(), required) !== "enroll") redirect(homeFor(me.kind));
  return <SetupTwoStep home={homeFor(me.kind)} />;
}
