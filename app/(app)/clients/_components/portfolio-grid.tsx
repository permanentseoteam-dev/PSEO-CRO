"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, Card, Seg } from "@/components/ui";
import { BAND_LABEL, daysAgo, fmtMeeting, matches, NO_FILTER, SERVICES, statusLabel, type Band, type PortfolioFilter } from "@/lib/modules/clients/logic";
import type { PortfolioCard } from "@/lib/modules/clients/types";
import { BandDot, HealthRing } from "./health-ring";
import s from "./clients.module.css";

const BANDS: Band[] = ["at_risk", "watch", "healthy", "new", "no_data"];

export function PortfolioGrid({ cards, owners, reportMonth }: { cards: PortfolioCard[]; owners: string[]; reportMonth: string }) {
  const [f, setF] = useState<PortfolioFilter>(NO_FILTER);
  const set = (patch: Partial<PortfolioFilter>) => setF((cur) => ({ ...cur, ...patch }));
  const shown = cards.filter((c) => matches(c, f));

  return (
    <>
      <div className="toolbar">
        <Seg
          label="Health"
          value={f.band}
          onChange={(band) => set({ band })}
          items={[{ value: "all", label: "All" }, ...BANDS.map((b) => ({ value: b, label: BAND_LABEL[b] }))]}
        />
        <select aria-label="Owner" value={f.owner} onChange={(e) => set({ owner: e.target.value })}>
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select aria-label="Service" value={f.service} onChange={(e) => set({ service: e.target.value })}>
          <option value="">All services</option>
          {SERVICES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {["Active", "Onboarding", "Paused", "Internal"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input type="search" placeholder="Search clients" aria-label="Search clients" value={f.q} onChange={(e) => set({ q: e.target.value })} />
      </div>

      {shown.length ? (
        <div className={s.grid}>
          {shown.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className={`card ${s.card}`}>
              <div className={s.top}>
                <HealthRing score={c.score} />
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <strong className={s.name}>{c.name}</strong>
                  <div className="row" style={{ gap: 12 }}>
                    <BandDot band={c.band} />
                    <span className="small muted">{statusLabel(c.status)}</span>
                  </div>
                </div>
              </div>
              <div className={`${s.meta} small`}>
                {c.ownerName ? (
                  <div className="row" style={{ gap: 6 }}>
                    <Avatar name={c.ownerName} size={22} />
                    <span>{c.ownerName}</span>
                  </div>
                ) : null}
                <div className="muted">{c.services.join(" · ") || "No services yet"}</div>
                <div className="between">
                  <span className="muted">Last contact</span>
                  <span className={c.contactDays == null || c.contactDays > 10 ? s.late : undefined}>{daysAgo(c.contactDays)}</span>
                </div>
                <div className="between">
                  <span className="muted">Next meeting</span>
                  <span>{c.nextMeeting ? fmtMeeting(c.nextMeeting) : "None booked"}</span>
                </div>
                <div className="between">
                  <span className="muted">{reportMonth} report</span>
                  <span>{c.report}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="empty">
            <p>{cards.length ? "No clients match these filters." : "No clients yet."}</p>
            {cards.length ? (
              <Button size="sm" variant="ghost" onClick={() => setF(NO_FILTER)}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </Card>
      )}
    </>
  );
}
