import { axisLabel, money, monthLabel, niceTop } from "@/lib/modules/finance/core/logic";
import s from "./finance.module.css";

type Month = { ym: string; invoiced: number; collected: number; inPeriod: boolean };

/** Grouped bars: invoiced vs collected per month. Months outside the chosen period are faded. */
export function MonthChart({ months, currency }: { months: Month[]; currency: string }) {
  const W = 720, H = 250, L = 56, B = 30, T = 12;
  const plotH = H - B - T;
  const slot = (W - L - 8) / months.length;
  const top = niceTop(Math.max(1, ...months.flatMap((m) => [m.invoiced, m.collected])));
  const y = (v: number) => T + plotH - (plotH * v) / top;

  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Invoiced and collected per month in ${currency}`}>
      {[0, 1, 2, 3, 4].map((g) => {
        const v = (top * g) / 4;
        return (
          <g key={g}>
            <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end">
              {axisLabel(v)}
            </text>
          </g>
        );
      })}
      {months.map((m, k) => {
        const x = L + slot * k + slot * 0.18;
        const bw = slot * 0.3;
        const label = `${monthLabel(m.ym)} ${m.ym.slice(0, 4)}`;
        return (
          <g key={m.ym} opacity={m.inPeriod ? 1 : 0.45}>
            <rect x={x} y={y(m.invoiced)} width={bw} height={T + plotH - y(m.invoiced)} rx={2} style={{ fill: "var(--accent)" }}>
              <title>{`${label} invoiced ${money(m.invoiced, currency, 0)}`}</title>
            </rect>
            <rect x={x + bw + 2} y={y(m.collected)} width={bw} height={T + plotH - y(m.collected)} rx={2} style={{ fill: "var(--blue)" }}>
              <title>{`${label} collected ${money(m.collected, currency, 0)}`}</title>
            </rect>
            <text x={x + bw + 1} y={H - 10} textAnchor="middle">
              {monthLabel(m.ym)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
