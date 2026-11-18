"use client";

import { useState, useTransition } from "react";
import { Field, Input, useToast } from "@/components/ui";
import { AgencyInput, suggestInitials, type AgencySettings } from "@/lib/modules/agency/logic";
import { saveAgencySettings } from "@/lib/modules/agency/actions";
import { ReadRows, SaveCancel, useEditing } from "./edit-mode";

/** Admin card for the agency's own brand and workday length: saved values, or the form while editing. */
export function AgencyBrandingForm({ initial }: { initial: AgencySettings }) {
  const { editing, setEditing } = useEditing();
  const [saved, setSaved] = useState(initial);
  if (!editing) {
    return (
      <ReadRows
        rows={[
          ["Company name", saved.name],
          ["Subtitle", saved.subtitle || "None"],
          ["Initials", saved.initials],
          ["Logo URL", saved.logoUrl || "None"],
          ["Workday hours", String(saved.workdayMinutes / 60)],
        ]}
      />
    );
  }
  return (
    <AgencyForm
      initial={saved}
      onDone={(next) => {
        if (next) setSaved(next);
        setEditing(false);
      }}
    />
  );
}

/** The edit form, with a live sidebar preview. Unmounted on Cancel, which drops the draft. */
function AgencyForm({ initial, onDone }: { initial: AgencySettings; onDone: (saved?: AgencySettings) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [initials, setInitials] = useState(initial.initials);
  // Initials follow the name until the admin types their own.
  const [autoInitials, setAutoInitials] = useState(initial.initials === suggestInitials(initial.name));
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [hours, setHours] = useState(String(initial.workdayMinutes / 60));

  const input = { name, subtitle, initials, logoUrl, workdayHours: Number(hours) };
  const check = AgencyInput.safeParse(input);
  const problem = check.success ? null : check.error.issues[0]?.message ?? "Check the form.";
  const showLogo = /^https:\/\/\S+$/i.test(logoUrl.trim());
  const mark = initials.trim() || suggestInitials(name) || "?";

  function changeName(v: string) {
    setName(v);
    if (autoInitials) setInitials(suggestInitials(v).slice(0, 3));
  }

  function save() {
    if (problem) return toast(problem);
    start(async () => {
      const r = await saveAgencySettings(input);
      toast(r.ok ? "Agency branding saved" : r.error);
      if (r.ok) onDone({ name: name.trim(), subtitle: subtitle.trim(), initials: (initials.trim() || suggestInitials(name)).toUpperCase(), logoUrl: logoUrl.trim() || null, workdayMinutes: Math.round(Number(hours) * 60) });
    });
  }

  return (
    <div className="grid gap-5 min-[1100px]:grid-cols-[1fr_320px]">
      <div className="stack">
        <Field label="Company name" htmlFor="ag-name">
          <Input id="ag-name" value={name} maxLength={80} onChange={(e) => changeName(e.currentTarget.value)} />
        </Field>
        <Field label="Subtitle" htmlFor="ag-sub">
          <Input id="ag-sub" value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.currentTarget.value)} />
        </Field>
        <Field label="Initials" htmlFor="ag-init" hint="Shown when there is no logo. Suggested from the name.">
          <Input
            id="ag-init"
            value={initials}
            maxLength={3}
            className="w-[90px]"
            onChange={(e) => {
              setInitials(e.currentTarget.value.toUpperCase());
              setAutoInitials(false);
            }}
          />
        </Field>
        <Field label="Logo URL" htmlFor="ag-logo" hint="An https:// link to a square image. Leave blank to show the initials.">
          <Input id="ag-logo" type="url" value={logoUrl} maxLength={500} placeholder="https://…/logo.png" onChange={(e) => setLogoUrl(e.currentTarget.value)} />
        </Field>
        <Field label="Workday hours" htmlFor="ag-hours" hint="Used for the clock progress bar">
          <Input id="ag-hours" type="number" min={1} max={16} step={0.5} value={hours} className="w-[90px]" onChange={(e) => setHours(e.currentTarget.value)} />
        </Field>
        {problem ? (
          <p role="alert" className="m-0 text-danger">
            {problem}
          </p>
        ) : null}
        <SaveCancel pending={pending} disabled={!!problem} onSave={save} onCancel={() => onDone()} />
      </div>

      <div aria-label="Sidebar preview" role="region">
        <h4 className="m-0 mb-2 text-ink-3">Preview</h4>
        <div className="rounded-[var(--radius-card)] bg-[var(--side-bg)] p-3">
          <div className="brand">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote logo of unknown size, same as the sidebar
              <img className="brand-mark rounded-lg object-contain" src={logoUrl.trim()} alt="" aria-hidden="true" />
            ) : (
              <span
                className="brand-mark grid place-items-center rounded-lg font-display text-[13px] font-extrabold text-white"
                style={{ background: "var(--accent)" }}
                aria-hidden="true"
              >
                {mark}
              </span>
            )}
            <span className="brand-name">
              {name.trim() || "Company name"}
              <span className="brand-sub">{subtitle}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
