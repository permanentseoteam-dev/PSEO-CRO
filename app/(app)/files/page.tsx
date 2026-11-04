import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { EmptyState, NoAccess, PhaseTwo } from "@/components/ui";
import { getFiles, listClients } from "@/lib/modules/clientops/queries";
import { BrandKitButton } from "./_components/brand-kit-dialog";
import { ClientPicker } from "./_components/client-picker";
import { FileSearch } from "./_components/file-search";
import { FileTable } from "./_components/file-table";
import { NewFolderButton } from "./_components/new-folder";
import { DropZone, UploadButton } from "./_components/upload";
import s from "./_components/files.module.css";

export const metadata = { title: "Files" };

export default async function FilesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;

  const sp = await searchParams;
  const clients = await listClients();
  if (!clients.length) {
    return (
      <div className="page">
        <h1>Files</h1>
        <div className="card">
          <EmptyState title="No clients yet">Files live in client folders. Add a client first.</EmptyState>
        </div>
      </div>
    );
  }
  const client = clients.find((c) => c.id === sp.client) ?? clients[0];
  const { folders, folder, files, brandKit } = await getFiles(client.id, sp.folder);

  return (
    <div className="page">
      <div className="between">
        <h1>Files</h1>
        <div className="row">
          <NewFolderButton clients={clients} clientId={client.id} />
          <UploadButton clientId={client.id} folderId={folder?.id ?? null} />
        </div>
      </div>

      <FileSearch />

      <div className={s.wrap}>
        <div className="card">
          <div className="card-body stack">
            <ClientPicker clients={clients} value={client.id} />
            <nav className={s.folders} aria-label="Folders">
              {folders.map((f) => (
                <Link
                  key={f.id}
                  href={`/files?client=${client.id}&folder=${f.id}`}
                  className={`${s.folder} ${f.id === folder?.id ? s.on : ""}`}
                  aria-current={f.id === folder?.id ? "page" : undefined}
                >
                  <span>{f.name}</span>
                  <span className="num muted small">{f.count}</span>
                </Link>
              ))}
              <div className={`${s.folder} ${s.static}`}>
                <span>
                  Google Drive <PhaseTwo />
                </span>
                <span className="small muted">read-only</span>
              </div>
            </nav>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <h3>{folder ? `${client.name} · ${folder.name}` : client.name}</h3>
              {folder && !folder.clientVisible ? <span className="small muted">Hidden from the client</span> : null}
            </div>
            <div className="card-body">
              {folder ? (
                <>
                  <FileTable files={files} folders={folders} folderId={folder.id} />
                  <DropZone clientId={client.id} folderId={folder.id} />
                </>
              ) : (
                <div className="empty">This client has no folders yet. Create one to start uploading.</div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Brand kit: {client.name}</h3>
              <div className="row">
                <BrandKitButton clientId={client.id} kit={brandKit} label={brandKit ? "Edit brand kit" : "Start brand kit"} />
              </div>
            </div>
            <div className="card-body">
              {brandKit ? (
                <div className="stack" style={{ gap: 12 }}>
                  {brandKit.colours.length ? (
                    <div>
                      <h4 className={s.h4}>Colours</h4>
                      <div className="row" style={{ gap: 14, marginTop: 4 }}>
                        {brandKit.colours.map((c) => (
                          <span key={c.hex + c.name} className="row small" style={{ gap: 6 }}>
                            {/* The client's own brand colour: data, not a theme colour. */}
                            <span className={s.swatch} style={{ background: c.hex }} aria-hidden="true" />
                            {c.name} <span className="muted num">{c.hex}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {brandKit.fonts ? (
                    <div>
                      <h4 className={s.h4}>Fonts</h4>
                      <p className="small" style={{ margin: "2px 0 0" }}>
                        {brandKit.fonts}
                      </p>
                    </div>
                  ) : null}
                  {brandKit.tone ? (
                    <div>
                      <h4 className={s.h4}>Tone</h4>
                      <p className="small" style={{ margin: "2px 0 0" }}>
                        {brandKit.tone}
                      </p>
                    </div>
                  ) : null}
                  {brandKit.dos.length || brandKit.donts.length ? (
                    <div className="grid-2">
                      <div>
                        <h4 className={s.h4}>Do</h4>
                        <ul className={`small ${s.ul}`}>
                          {brandKit.dos.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className={s.h4}>Don&apos;t</h4>
                        <ul className={`small ${s.ul}`}>
                          {brandKit.donts.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <h4 className={s.h4}>
                      Links and audience <PhaseTwo />
                    </h4>
                  </div>
                </div>
              ) : (
                <div className="empty">No brand kit for {client.name} yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
