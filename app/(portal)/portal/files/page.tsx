import Link from "next/link";
import { Avatar, Card, CardBody, CardHead, EmptyState, Table, Td, Th } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getBrandKit, listFiles, listFolders, portalContext } from "@/lib/modules/portal/queries";
import { fileSize, fmtDay } from "@/lib/modules/portal/logic";
import { NoClient, PageHead } from "../../_components/page-head";
import { Upload } from "./_components/upload";
import s from "../portal.module.css";

export const metadata = { title: "Files" };

export default async function PortalFiles({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;

  const sp = await searchParams;
  const [folders, kit] = await Promise.all([listFolders(client.id), getBrandKit(client.id)]);
  const current = folders.find((f) => f.id === sp.folder) ?? null;
  const files = await listFiles(client.id, { folderId: current?.id });
  const uploadFolder = folders.find((f) => f.kind === "from_client");

  return (
    <div className="page">
      <PageHead title="Files" sub="Everything we share, in one place." />

      {folders.length ? (
        <div className="grid-3">
          {folders.map((f) => (
            <Link key={f.id} href={`/portal/files?folder=${f.id}`} className={cn(s.folder, current?.id === f.id && s.on)} aria-current={current?.id === f.id ? "true" : undefined}>
              <b>{f.name}</b>
              <span className="muted small">
                {f.count} {f.count === 1 ? "file" : "files"}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHead
          title={current ? current.name : "All files"}
          actions={
            current ? (
              <Link className="btn ghost sm" href="/portal/files">
                Show all
              </Link>
            ) : null
          }
        />
        {files.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th hideSm>Folder</Th>
                <Th>Added by</Th>
                <Th>Date</Th>
                <Th hideSm>Size</Th>
                <Th right>Download</Th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <Td>{f.name}</Td>
                  <Td hideSm>{f.folderName}</Td>
                  <Td>
                    <span className="row" style={{ flexWrap: "nowrap" }}>
                      <Avatar name={f.addedBy} size={22} />
                      <span className="hide-sm">{f.addedBy}</span>
                    </span>
                  </Td>
                  <Td num>{fmtDay(f.date)}</Td>
                  <Td num hideSm>
                    {fileSize(f.size)}
                  </Td>
                  <Td right>
                    {f.versionId ? (
                      <a className="btn sm" href={`/portal/files/download/${f.versionId}`} aria-label={`Download ${f.name}`}>
                        Download
                      </a>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No files here yet">Files we share with you show here.</EmptyState>
        )}
      </Card>

      {me.kind === "client" && uploadFolder ? <Upload clientId={client.id} folderName={uploadFolder.name} readOnly={!!preview} /> : null}

      {kit ? (
        <Card>
          <CardHead title="Brand kit" actions={<span className="muted small">Read only</span>} />
          <CardBody className="stack" style={{ gap: 16 }}>
            {kit.colours.length ? (
              <div>
                <b>Colours</b>
                <div className={s.swatches}>
                  {kit.colours.map((c) => (
                    <div key={c.hex + c.name} className={s.sw}>
                      {/* The client's own brand colour is data, not a theme colour. */}
                      <i style={{ background: /^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : undefined }} />
                      <span>{c.name}</span>
                      <span className="num">{c.hex}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid-2">
              {kit.fonts ? (
                <div>
                  <b>Fonts</b>
                  <div className="muted">{kit.fonts}</div>
                </div>
              ) : null}
              {kit.tone ? (
                <div>
                  <b>Tone</b>
                  <div className="muted">{kit.tone}</div>
                </div>
              ) : null}
            </div>
            {kit.dos.length || kit.donts.length ? (
              <div className={s.dd}>
                <div>
                  <b>Do</b>
                  <ul>
                    {kit.dos.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <b>Don&apos;t</b>
                  <ul>
                    {kit.donts.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
