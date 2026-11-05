"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { saveStatusReview } from "../actions";
import { REVIEW_STATUS, reviewDefault } from "../logic";
import { REVIEW_STATUSES, type ReviewStatus } from "../types";

type Entry = { status: ReviewStatus; note: string };

/** Client Portfolio "Status review": a quick weekly read on each client. Each row becomes a relationship log note. */
export function StatusReviewButton({ clients }: { clients: { id: string; name: string; band: string }[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, Entry>>({});
  const [busy, start] = useTransition();
  const toast = useToast();

  function openDialog() {
    setRows(Object.fromEntries(clients.map((c) => [c.id, { status: reviewDefault(c.band), note: "" }])));
    setOpen(true);
  }

  const set = (id: string, patch: Partial<Entry>) => setRows((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));

  function save() {
    start(async () => {
      const r = await saveStatusReview({ rows: clients.map((c) => ({ clientId: c.id, ...rows[c.id] })) });
      toast(r.ok ? "Status review saved" : r.error);
      if (r.ok) setOpen(false);
    });
  }

  if (!clients.length) return null;
  return (
    <>
      <Button onClick={openDialog}>Status review</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Status review"
        wide
        footer={
          <Button variant="primary" disabled={busy} onClick={save}>
            Save review
          </Button>
        }
      >
        <p className="muted small">Your read on each client this week. Notes go to the client&rsquo;s relationship log.</p>
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Status</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const r = rows[c.id];
              if (!r) return null;
              return (
                <tr key={c.id}>
                  <Td>
                    <strong>{c.name}</strong>
                  </Td>
                  <Td>
                    <Select aria-label={`Status for ${c.name}`} value={r.status} onChange={(e) => set(c.id, { status: e.target.value as ReviewStatus })}>
                      {REVIEW_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {REVIEW_STATUS[s].label}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Input aria-label={`Note for ${c.name}`} placeholder="Note (optional)" maxLength={500} value={r.note} onChange={(e) => set(c.id, { note: e.target.value })} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Dialog>
    </>
  );
}
