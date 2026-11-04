"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { formatBytes } from "@/lib/modules/clientops/logic";
import type { ClientFile, Folder } from "@/lib/modules/clientops/types";
import { downloadUrl, moveFile, removeFile, renameFile, restoreVersion, setShared } from "../actions";
import s from "./files.module.css";

type Open = { kind: "versions" | "move" | "rename" | "remove"; file: ClientFile } | null;

const fmtDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: new Date(iso).getFullYear() === new Date().getFullYear() && !withTime ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone: "Asia/Dubai",
  });

export function FileTable({ files, folders, folderId }: { files: ClientFile[]; folders: Folder[]; folderId: string }) {
  const [open, setOpen] = useState<Open>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const close = () => setOpen(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? "Something went wrong");
      toast(okMsg);
      close();
    });

  const download = (versionId: string) =>
    start(async () => {
      const res = await downloadUrl({ versionId });
      if (!res.ok) return toast(res.error);
      window.location.assign(res.url);
    });

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Version</Th>
            <Th num hideSm>
              Size
            </Th>
            <Th hideSm>Uploaded by</Th>
            <Th>Date</Th>
            <Th>Client sees it</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {files.length ? (
            files.map((f) => {
              const v = f.versions[0];
              return (
                <tr key={f.id}>
                  <Td>
                    <strong>{f.name}</strong>
                  </Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "versions", file: f })}>
                      v{v?.version ?? 1}
                    </Button>
                  </Td>
                  <Td num hideSm>
                    {v ? formatBytes(v.sizeBytes) : "–"}
                  </Td>
                  <Td hideSm>{v?.uploadedBy ?? "–"}</Td>
                  <Td>{v ? fmtDate(v.createdAt) : "–"}</Td>
                  <Td>{f.shared ? "Yes" : "No"}</Td>
                  <Td>
                    <div className={s.actions}>
                      <Button size="sm" variant="ghost" disabled={!v || pending} onClick={() => v && download(v.id)}>
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => setShared({ fileId: f.id, shared: !f.shared }), f.shared ? `${f.name} hidden from the client` : `The client can now see ${f.name}`)}
                      >
                        {f.shared ? "Unshare" : "Share"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "move", file: f })}>
                        Move
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "rename", file: f })}>
                        Rename
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "remove", file: f })}>
                        Remove
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7}>
                <div className="empty">No files in this folder yet. Drop files below to add them.</div>
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Dialog
        open={open?.kind === "versions"}
        onClose={close}
        title="Version history"
        wide
        footer={
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        }
      >
        {open?.kind === "versions" ? (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              {open.file.name}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Version</Th>
                  <Th>Uploaded by</Th>
                  <Th>Date</Th>
                  <Th num>Size</Th>
                  <Th>
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {open.file.versions.map((v, i) => (
                  <tr key={v.id}>
                    <Td>{i === 0 ? `v${v.version} (current)` : `v${v.version}`}</Td>
                    <Td>{v.uploadedBy ?? "–"}</Td>
                    <Td>{fmtDate(v.createdAt, true)}</Td>
                    <Td num>{formatBytes(v.sizeBytes)}</Td>
                    <Td>
                      {i === 0 ? (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => download(v.id)}>
                          Download
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => run(() => restoreVersion({ versionId: v.id }), `v${v.version} restored as the current version`)}
                        >
                          Restore
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={open?.kind === "move"}
        onClose={close}
        title="Move file"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="file-move" disabled={pending}>
              Move
            </Button>
          </>
        }
      >
        {open?.kind === "move" ? (
          <form
            id="file-move"
            action={(fd) => {
              const to = String(fd.get("folderId"));
              run(() => moveFile({ fileId: open.file.id, folderId: to }), `${open.file.name} moved to ${folders.find((x) => x.id === to)?.name}`);
            }}
          >
            <FormGrid>
              <Field label="Folder" htmlFor="mv-folder" full>
                <Select id="mv-folder" name="folderId" defaultValue={folders.find((x) => x.id !== folderId)?.id}>
                  {folders
                    .filter((x) => x.id !== folderId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </FormGrid>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={open?.kind === "rename"}
        onClose={close}
        title="Rename file"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="file-rename" disabled={pending}>
              Rename
            </Button>
          </>
        }
      >
        {open?.kind === "rename" ? (
          <form id="file-rename" action={(fd) => run(() => renameFile({ fileId: open.file.id, name: fd.get("name") }), "File renamed")}>
            <FormGrid>
              <Field label="New name" htmlFor="rn-name" full>
                <Input id="rn-name" name="name" defaultValue={open.file.name} maxLength={200} required />
              </Field>
            </FormGrid>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={open?.kind === "remove"}
        onClose={close}
        title="Remove file"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary-danger"
              disabled={pending}
              onClick={() => open && run(() => removeFile({ fileId: open.file.id }), `${open.file.name} removed`)}
            >
              Remove file
            </Button>
          </>
        }
      >
        {open?.kind === "remove" ? (
          <p className="small" style={{ margin: 0 }}>
            This removes <strong>{open.file.name}</strong> and all {open.file.versions.length} version{open.file.versions.length === 1 ? "" : "s"}. The client loses access too.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
