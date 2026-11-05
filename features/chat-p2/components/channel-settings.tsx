"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button, Checkbox, useToast } from "@/components/ui";
import { setAdminsOnly, setArchived } from "../actions";
import { canArchive, canSetAdminsOnly } from "../logic";
import type { ChannelP2 } from "../types";

/**
 * Admin rows for the Phase 1 "Conversation settings" dialog: only admins can post, and archive.
 * Each saves at once. Non-admins see nothing.
 */
export function ChannelSettingsP2({
  channel,
  isAdmin,
  onChange,
}: {
  channel: ChannelP2;
  isAdmin: boolean;
  /** Tells a client-side chat screen what was saved, so it can update without a reload. */
  onChange?: (patch: { adminsOnly?: boolean; archivedAt?: string | null }) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adminsOnly, setOnly] = useState(channel.adminsOnly);
  if (!isAdmin) return null;
  const archived = Boolean(channel.archivedAt);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, undo?: () => void, saved?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        undo?.();
        toast(r.error ?? "Couldn't save");
        return;
      }
      toast(done);
      saved?.();
      if (!onChange) router.refresh();
    });

  return (
    <div className="stack" style={{ gap: 14 }}>
      {canSetAdminsOnly(channel.kind) ? (
        <Checkbox
          label="Only admins can post"
          checked={adminsOnly}
          disabled={pending || archived}
          onChange={(e) => {
            const v = e.target.checked;
            setOnly(v);
            run(
              () => setAdminsOnly({ channelId: channel.id, adminsOnly: v }),
              v ? "Only admins can post now" : "Everyone can post now",
              () => setOnly(!v),
              () => onChange?.({ adminsOnly: v }),
            );
          }}
        />
      ) : null}
      {canArchive(channel.kind) ? (
        <div className="row between" style={{ flexWrap: "nowrap" }}>
          <div>
            <b>{archived ? "Restore this conversation" : "Archive this conversation"}</b>
            <div className="small muted">{archived ? "People can post in it again." : "Hides it for everyone. History stays searchable."}</div>
          </div>
          <Button
            size="sm"
            variant={archived ? "default" : "danger"}
            disabled={pending}
            onClick={() =>
              run(
                () => setArchived({ channelId: channel.id, archived: !archived }),
                archived ? "Conversation restored" : "Conversation archived",
                undefined,
                () => onChange?.({ archivedAt: archived ? null : new Date().toISOString() }),
              )
            }
          >
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {archived ? "Restore" : "Archive"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
