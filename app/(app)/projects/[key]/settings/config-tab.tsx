"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui";
import { setProjectConfig } from "@/lib/modules/work/space-actions";
import type { ConfigMode, WorkConfig } from "@/lib/modules/work/space-types";
import { cn } from "@/lib/utils";
import { ConfigSections } from "../../_components/config-editor";
import s from "./settings.module.css";

type Props = { projectId: string; mode: ConfigMode; config: WorkConfig; canManage: boolean };

export function ConfigTab({ projectId, mode, config, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function switchMode(next: ConfigMode) {
    if (next === mode || pending) return;
    setPending(true);
    const r = await setProjectConfig({ projectId, mode: next });
    setPending(false);
    if (!r.ok) return toast(r.error);
    router.refresh();
  }

  async function saveConfig(c: WorkConfig) {
    const r = await setProjectConfig({ projectId, mode: "custom", config: c });
    if (r.ok) router.refresh();
    return r;
  }

  const option = (value: ConfigMode, title: string, text: string, extra?: ReactNode) => (
    <label className={cn(s.option, mode === value && s.optionOn)}>
      <input type="radio" name="config-mode" checked={mode === value} disabled={!canManage || pending} onChange={() => switchMode(value)} />
      <span className={s.optionText}>
        <b>{title}</b>
        <span className="muted">{text}</span>
        {extra}
      </span>
    </label>
  );

  return (
    <>
      <div className={s.options}>
        {option(
          "inherit",
          "Inherit configuration from the workspace",
          "This project will use the configuration from the workspace level",
          <Link href="/projects/configuration" className={s.extLink}>
            Edit configuration <ExternalLink />
          </Link>,
        )}
        {option("custom", "Custom configuration", "Use custom configuration for this project without syncing with workspace settings")}
      </div>
      <ConfigSections config={config} editable={mode === "custom" && canManage} onSave={saveConfig} />
    </>
  );
}
