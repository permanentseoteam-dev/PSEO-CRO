import { StatusDot } from "@/components/ui";
import { BAND_LABEL, BAND_TONE, type Band } from "@/lib/modules/clients/logic";
import s from "./clients.module.css";

const colour = (score: number | null) => (score == null ? "--ink-3" : score >= 75 ? "--ok" : score >= 50 ? "--warn" : "--danger");

/** Health ring 0-100. Empty ring with a dash when there is no score. */
export function HealthRing({ score, size = 56 }: { score: number | null; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = score == null ? c : c * (1 - score / 100);
  const m = size / 2;
  return (
    <svg className={s.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Health ${score ?? "no data"}`}>
      <circle cx={m} cy={m} r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle
        cx={m}
        cy={m}
        r={r}
        fill="none"
        stroke={`var(${colour(score)})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c.toFixed(1)}
        strokeDashoffset={off.toFixed(1)}
        transform={`rotate(-90 ${m} ${m})`}
      />
      <text x={m} y={m} textAnchor="middle" dominantBaseline="central" fill="var(--ink)" fontSize={Math.round(size / 3.6)} fontWeight="600">
        {score ?? "–"}
      </text>
    </svg>
  );
}

export function BandDot({ band }: { band: Band }) {
  return <StatusDot tone={BAND_TONE[band] ?? "muted"}>{BAND_LABEL[band] ?? "No data"}</StatusDot>;
}
