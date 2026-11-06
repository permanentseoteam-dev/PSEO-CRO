"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowRight, CalendarClock, CircleAlert, Hourglass, History, ListTodo, LoaderCircle, Search, SearchX, Users } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui";
import { startClientPreview } from "../preview-actions";
import styles from "./preview.module.css";

/** One client card, with every fact already formatted on the server. A null fact couldn't be read and is hidden. */
export type ClientCardView = {
  id: string;
  name: string;
  line: string | null;
  openWork: string | null;
  waiting: string | null;
  meeting: string | null;
  activity: string | null;
};

export function ClientPreviewGrid({ clients }: { clients: ClientCardView[] }) {
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [pending, start] = useTransition();

  if (!clients.length) {
    return (
      <EmptyState icon={<Users aria-hidden />} title="No clients to preview">
        Clients you can see will appear here.
      </EmptyState>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;

  function open(id: string) {
    if (pending) return;
    setOpeningId(id);
    setError(null);
    start(async () => {
      // On success the action redirects to the portal, so only an error comes back.
      const result = await startClientPreview(id);
      setError({ id, message: result.error });
      setOpeningId(null);
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.search}>
        <Search aria-hidden className={styles.searchIcon} />
        <input
          type="search"
          aria-label="Search clients by name"
          placeholder="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length ? (
        <ul className={styles.grid}>
          {shown.map((c) => {
            const opening = pending && openingId === c.id;
            const err = error?.id === c.id ? error.message : null;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => open(c.id)}
                  disabled={pending}
                  aria-busy={opening || undefined}
                  aria-describedby={err ? `err-${c.id}` : undefined}
                >
                  <span className={styles.top}>
                    <Avatar name={c.name} size={40} />
                    <span className={styles.who}>
                      <span className={styles.name}>{c.name}</span>
                      {c.line ? <span className={styles.line}>{c.line}</span> : null}
                    </span>
                    {opening ? (
                      <LoaderCircle aria-hidden className={`${styles.go} ${styles.spin}`} />
                    ) : (
                      <ArrowRight aria-hidden className={styles.go} />
                    )}
                  </span>
                  <span className={styles.facts}>
                    {c.openWork ? <Fact icon={<ListTodo aria-hidden />}>{c.openWork}</Fact> : null}
                    {c.waiting ? <Fact icon={<Hourglass aria-hidden />}>{c.waiting}</Fact> : null}
                    {c.meeting ? <Fact icon={<CalendarClock aria-hidden />}>{c.meeting}</Fact> : null}
                    {c.activity ? <Fact icon={<History aria-hidden />}>{c.activity}</Fact> : null}
                  </span>
                  {opening ? <span className={styles.status}>Opening&hellip;</span> : null}
                </button>
                {err ? (
                  <p id={`err-${c.id}`} role="alert" className={styles.error}>
                    <CircleAlert aria-hidden /> {err}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<SearchX aria-hidden />} title="No clients match">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Try another name.
        </EmptyState>
      )}
    </div>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className={styles.fact}>
      {icon}
      {children}
    </span>
  );
}
