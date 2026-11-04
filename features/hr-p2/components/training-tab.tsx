import { getMe, can } from "@/lib/auth/can";
import { EmptyState, NoAccess } from "@/components/ui";
import { listMemberPaths } from "../queries";
import { TrainingTabClient } from "./training-client";

/**
 * Performance → Training tab: one card per assigned path with its steps (Done / Next / Not started).
 * `memberId` defaults to the signed-in person. The learner (or a setup manager) can tick steps.
 */
export async function TrainingTab({ memberId }: { memberId?: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff") return <NoAccess />;
  const who = memberId ?? me.id;
  if (who !== me.id && !can(me, "perf.setup.manage", "team")) return <NoAccess />;
  const paths = await listMemberPaths(who);
  if (!paths.length) return <EmptyState title="No training paths yet" />;
  return <TrainingTabClient paths={paths} />;
}
