"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SearchHit } from "@/lib/modules/clientops/types";
import { searchFiles } from "../actions";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" });

export function FileSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; hits: SearchHit[]; total: number } | null>(null);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchFiles(term);
      if (live) setRes({ q: term, ...r });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  const shown = term.length >= 2 && res?.q === term ? res : null;

  return (
    <div className="card">
      <div className="card-body stack">
        <input type="search" placeholder="Search files across all clients" aria-label="Search files across all clients" value={q} onChange={(e) => setQ(e.target.value)} />
        {term.length < 2 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Type 2 or more characters to search every client&apos;s files.
          </p>
        ) : !shown ? (
          <p className="small muted" style={{ margin: 0 }}>
            Searching…
          </p>
        ) : shown.hits.length ? (
          <>
            <div className="list">
              {shown.hits.map((h) => (
                <Link key={h.id} href={`/files?client=${h.clientId}&folder=${h.folderId}`} className="item flex-wrap justify-between" style={{ color: "inherit" }}>
                  <strong>{h.name}</strong>
                  <span className="small muted">
                    {h.clientName} · {h.folderName} · v{h.version} · {fmt(h.date)}
                  </span>
                </Link>
              ))}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {shown.total} file{shown.total === 1 ? "" : "s"} found
            </p>
          </>
        ) : (
          <div className="empty">No files match &ldquo;{term}&rdquo;.</div>
        )}
      </div>
    </div>
  );
}
