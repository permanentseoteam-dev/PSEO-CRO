import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { monthLabel } from "@/lib/modules/finance/core/logic";
import { shiftMonth } from "@/lib/modules/finance/ops/logic";
import { getOpsSettings, getProfitability, todayIso } from "@/lib/modules/finance/ops/queries";
import { ProfitView } from "./_components/profit-view";

export const metadata = { title: "Profitability" };

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  // Salaries and everyone's time are read with the service client, so only full-scope viewers get in.
  if (me.kind !== "staff" || !can(me, "finance.profitability.view", "all")) return <NoAccess />;
  const sp = await searchParams;
  const thisMonth = todayIso().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") && sp.m! <= thisMonth ? sp.m! : thisMonth;
  const months = Array.from({ length: 6 }, (_, k) => shiftMonth(month, k - 5));

  const settings = await getOpsSettings();
  const data = await getProfitability(months, settings.workingHours);
  const next = shiftMonth(month, 1);

  return (
    <div className="page">
      <ProfitView
        months={data}
        settings={settings}
        canSettings={can(me, "finance.settings.manage", "all")}
        nav={{
          label: `${monthLabel(month)} ${month.slice(0, 4)}${month === thisMonth ? ", so far" : ""}`,
          prev: `/finance/profitability?m=${shiftMonth(month, -1)}`,
          next: next <= thisMonth ? `/finance/profitability?m=${next}` : null,
        }}
      />
    </div>
  );
}
