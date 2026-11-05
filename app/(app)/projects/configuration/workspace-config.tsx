"use client";

import { useRouter } from "next/navigation";
import { setWorkConfig } from "@/lib/modules/work/space-actions";
import type { WorkConfig } from "@/lib/modules/work/space-types";
import { ConfigSections } from "../_components/config-editor";

export function WorkspaceConfig({ config, canEdit }: { config: WorkConfig; canEdit: boolean }) {
  const router = useRouter();
  async function save(c: WorkConfig) {
    const r = await setWorkConfig(c);
    if (r.ok) router.refresh();
    return r;
  }
  return <ConfigSections config={config} editable={canEdit} onSave={save} />;
}
