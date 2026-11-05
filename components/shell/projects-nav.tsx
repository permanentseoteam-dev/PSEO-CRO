"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Folder, FolderKanban, Plus, SquarePlus } from "lucide-react";
import { Button, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createFolder, createSpaceProject } from "@/lib/modules/work/space-actions";
import type { SidebarProject, SidebarProjects } from "@/lib/modules/work/space-types";
import s from "./projects-nav.module.css";

type Props = { projects: SidebarProjects; canManage: boolean };

function ProjectLink({ p, on }: { p: SidebarProject; on: boolean }) {
  return (
    <Link className={cn("nav-link", s.project, on && "on")} href={`/projects/${p.key}/tasks`} aria-current={on ? "page" : undefined}>
      <span className="txt">{p.name}</span>
    </Link>
  );
}

export function ProjectsNav({ projects, canManage }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(true);
  const [closedFolders, setClosedFolders] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"project" | "folder" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside click or Esc closes the "+" menu.
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const isOn = (key: string) => pathname === `/projects/${key}` || pathname.startsWith(`/projects/${key}/`);
  const toggleFolder = (id: string) =>
    setClosedFolders((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const empty = projects.folders.length === 0 && projects.loose.length === 0;

  const pick = (d: "project" | "folder") => {
    setMenu(false);
    setDialog(d);
  };

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    start(async () => {
      if (dialog === "folder") {
        const r = await createFolder({ name });
        if (!r.ok) return toast(r.error);
        setDialog(null);
        router.refresh();
      } else {
        const folderId = String(fd.get("folderId") ?? "") || undefined;
        const r = await createSpaceProject({ name, folderId });
        if (!r.ok) return toast(r.error);
        setDialog(null);
        router.push(`/projects/${r.key}/tasks`);
        router.refresh();
      }
    });
  };

  return (
    <nav className={cn("nav-group", s.wrap)} aria-label="Projects">
      <Link className={cn("nav-link", s.collapsedLink, pathname.startsWith("/projects") && "on")} href="/projects" title="Projects">
        <FolderKanban aria-hidden="true" />
      </Link>

      <div className={s.full}>
        <div className={s.head}>
          <button type="button" className={cn("nav-label", s.label, !open && s.closed)} onClick={() => setOpen(!open)} aria-expanded={open}>
            <ChevronDown aria-hidden="true" />
            Projects
          </button>
          {canManage ? (
            <div className={s.menuWrap} ref={menuRef}>
              <button
                type="button"
                className="icon-btn sm"
                aria-label="Add project or folder"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Plus />
              </button>
              {menu ? (
                <div className={s.menu} role="menu">
                  <button type="button" role="menuitem" onClick={() => pick("project")}>
                    <SquarePlus aria-hidden="true" />
                    Create project
                  </button>
                  <button type="button" role="menuitem" onClick={() => pick("folder")}>
                    <Folder aria-hidden="true" />
                    Create folder
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {open ? (
          <div className="nav-links">
            {empty ? <span className={s.empty}>No projects yet</span> : null}
            {projects.folders.map((f) => {
              const fOpen = !closedFolders.includes(f.id);
              return (
                <div key={f.id} className={s.folder}>
                  <button type="button" className={cn("nav-link", s.folderRow)} onClick={() => toggleFolder(f.id)} aria-expanded={fOpen}>
                    <ChevronDown aria-hidden="true" className={cn(s.chev, !fOpen && s.closedChev)} />
                    <Folder aria-hidden="true" />
                    <span className="txt">{f.name}</span>
                  </button>
                  {fOpen ? (
                    <div className={s.indent}>
                      {f.projects.map((p) => (
                        <ProjectLink key={p.id} p={p} on={isOn(p.key)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {projects.loose.map((p) => (
              <ProjectLink key={p.id} p={p} on={isOn(p.key)} />
            ))}
          </div>
        ) : null}
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "folder" ? "Create folder" : "Create project"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="projects-nav-form" disabled={pending}>
              {dialog === "folder" ? "Create folder" : "Create project"}
            </Button>
          </>
        }
      >
        <form
          id="projects-nav-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <FormGrid>
            <Field label="Name" htmlFor="pn-name" full>
              <Input id="pn-name" name="name" required
                minLength={dialog === "folder" ? 1 : 2}
                maxLength={dialog === "folder" ? 80 : 120}
                autoFocus />
            </Field>
            {dialog === "project" && projects.folders.length ? (
              <Field label="Folder" htmlFor="pn-folder" full>
                <Select id="pn-folder" name="folderId" defaultValue="">
                  <option value="">No folder</option>
                  {projects.folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </FormGrid>
        </form>
      </Dialog>
    </nav>
  );
}
