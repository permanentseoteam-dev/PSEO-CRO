"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, FormGrid, Input, Seg, Select, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { connectSlack, saveSlackSetup, setLinkBridge, startSlackImport } from "../actions";
import { bridgeTone, duplicateTargets, importProgress } from "../logic";
import { IMPORT_DAYS, type BridgeState, type ImportStatus, type SlackSetup } from "../types";

const DAYS_LABEL: Record<number, string> = { 30: "Last 30 days", 90: "Last 90 days", 365: "Last 12 months" };
const JOB_LABEL: Record<ImportStatus, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "blue" }> = {
  queued: { label: "Import queued", tone: "blue" },
  running: { label: "Importing", tone: "blue" },
  paused: { label: "Import paused", tone: "warn" },
  done: { label: "Import finished", tone: "ok" },
  failed: { label: "Import failed", tone: "danger" },
  not_configured: { label: "Waiting for Slack to be connected", tone: "muted" },
};

/** "Slack import" button for the chat sidebar plus the import and bridge dialog. Staff with chat.slack.manage (all). */
export function SlackImport({ setup }: { setup: SlackSetup }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ws = setup.workspace;
  const [workspace, setWorkspace] = useState(ws?.workspace ?? "");
  const [days, setDays] = useState<number>(ws?.importDays ?? 90);
  const [bridge, setBridge] = useState<BridgeState>(ws?.bridge ?? "paused");
  const [map, setMap] = useState(() => Object.fromEntries(setup.links.map((l) => [l.id, l.channelId])));
  const connected = ws?.status === "connected";
  const dups = duplicateTargets(Object.values(map).map((channelId) => ({ channelId })));
  const job = setup.lastJob;
  const pct = job ? importProgress(job.importedCount, job.totalEstimate) : null;

  const done = (msg: string) => {
    toast(msg);
    router.refresh();
  };

  function save(thenImport: boolean) {
    start(async () => {
      const r = await saveSlackSetup({
        workspace,
        importDays: days,
        bridge,
        links: Object.entries(map).map(([id, channelId]) => ({ id, channelId })),
      });
      if (!r.ok) return toast(r.error);
      if (!thenImport || !ws) return done("Slack settings saved");
      const j = await startSlackImport({ workspaceId: ws.id });
      if (!j.ok) return toast(j.error);
      done(j.data?.configured ? "Import queued" : "Saved. The import starts once Slack is connected.");
    });
  }

  function connect() {
    start(async () => {
      const r = await connectSlack();
      if (!r.ok) return toast(r.error);
      if (r.data) window.location.href = r.data.url;
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Slack import</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Slack import and bridge"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <Button disabled={pending || dups.length > 0 || workspace.length < 3} onClick={() => save(false)}>Save</Button>
            <Button variant="primary" disabled={pending || dups.length > 0 || !ws} onClick={() => save(true)}>Start import</Button>
          </>
        }
      >
        <div className="row between">
          <StatusDot tone={connected ? "ok" : ws?.status === "error" ? "danger" : "muted"}>
            {connected ? "Slack connected" : ws?.status === "error" ? "Slack connection failed" : "Slack not connected"}
          </StatusDot>
          {connected ? null : (
            <Button size="sm" variant="primary" disabled={pending} onClick={connect}>Connect Slack</Button>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Copy history from Slack and keep chosen channels in sync both ways.</p>

        <FormGrid>
          <Field label="Slack workspace" htmlFor="cp2-slack-ws">
            <Input id="cp2-slack-ws" value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="yourteam.slack.com" />
          </Field>
          <Field label="History to import" htmlFor="cp2-slack-days">
            <Select id="cp2-slack-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {IMPORT_DAYS.map((d) => (
                <option key={d} value={d}>{DAYS_LABEL[d]}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        {setup.links.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Slack channel</Th>
                <Th>Portal channel</Th>
                <Th>Bridge</Th>
              </tr>
            </thead>
            <tbody>
              {setup.links.map((l) => (
                <tr key={l.id}>
                  <Td>{l.slackChannel}</Td>
                  <Td>
                    <Select
                      aria-label={`Portal channel for ${l.slackChannel}`}
                      value={map[l.id] ?? ""}
                      onChange={(e) => setMap((m) => ({ ...m, [l.id]: e.target.value || null }))}
                      aria-invalid={map[l.id] ? dups.includes(map[l.id]!) : undefined}
                    >
                      <option value="">Not linked</option>
                      {setup.channels.map((c) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={pending}
                      title={l.bridge === "running" ? "Pause this bridge" : "Run this bridge"}
                      onClick={() =>
                        start(async () => {
                          const r = await setLinkBridge({ linkId: l.id, bridge: l.bridge === "running" ? "paused" : "running" });
                          if (r.ok) done(l.bridge === "running" ? "Bridge paused" : "Bridge running");
                          else toast(r.error);
                        })
                      }
                    >
                      <StatusDot tone={bridgeTone(l.bridge)}>{l.bridge === "running" ? "Running" : "Paused"}</StatusDot>
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>Slack channels show here once Slack is connected.</p>
        )}
        {dups.length ? <p className="small text-danger" style={{ margin: 0 }}>Each portal channel can link to one Slack channel only.</p> : null}

        <div className="row between">
          <span className="small">
            {job ? (
              <StatusDot tone={JOB_LABEL[job.status].tone}>
                {JOB_LABEL[job.status].label}
                {pct != null ? ` · ${pct}%` : ""}
                {ws?.importedCount ? ` · ${ws.importedCount.toLocaleString("en-GB")} messages imported` : ""}
              </StatusDot>
            ) : (
              <span className="muted">No import yet</span>
            )}
          </span>
          <Seg
            label="Bridge"
            value={bridge}
            onChange={(v) => setBridge(v as BridgeState)}
            items={[
              { value: "running", label: "Running" },
              { value: "paused", label: "Paused" },
            ]}
          />
        </div>
      </Dialog>
    </>
  );
}
