import { getMe } from "@/lib/auth/can";
import { getClockToday, getEmployment } from "../queries";
import { ClockWidgetClient } from "./clock-client";

/**
 * "Today" clock card: clock in, start/end break, clock out, with a warning before clocking out early.
 * Always for the signed-in person. Mount on Profile → Attendance (and optionally Home / Time).
 */
export async function ClockWidget() {
  const me = await getMe();
  if (!me || me.kind !== "staff") return null;
  const [day, employment] = await Promise.all([getClockToday(me.id), getEmployment(me.id)]);
  return <ClockWidgetClient day={day} shiftEnd={employment?.shift_end ?? "18:00"} />;
}
