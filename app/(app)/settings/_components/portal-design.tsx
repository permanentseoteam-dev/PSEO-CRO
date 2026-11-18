"use client";

import { useRef, useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
import { Button, Field, Input, StatusDot, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  ACCENT_CHOICES,
  LOGO_BUCKET,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  accentProblem,
  contrastRatio,
  logoExt,
  type PortalDensity,
  type PortalDesign,
  type PortalTheme,
} from "@/lib/modules/portal-design/logic";
import { savePortalDesign, savePortalLogo } from "../actions";
import { ReadRows, SaveCancel, useEditing } from "./edit-mode";

function Seg<T extends string>({ label, items, value, onChange }: { label: string; items: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([v, l]) => (
        <button key={v} type="button" className={v === value ? "on" : undefined} aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// Preview palettes mirror the light and dark tokens in globals.css, scoped to the preview box only.
const LIGHT = { "--bg": "#f6f8f8", "--surface": "#ffffff", "--ink": "#0f1a1f", "--ink-2": "#3d4b52", "--line": "#e3e8e9" };
const DARK = { "--bg": "#0b1215", "--surface": "#111a1e", "--ink": "#e7eef0", "--ink-2": "#b4c2c7", "--line": "#223038" };

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
function subscribeDark(cb: () => void) {
  const q = darkQuery();
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}

const THEME_LABEL: Record<PortalTheme, string> = { system: "System", light: "Light", dark: "Dark" };
const DENSITY_LABEL: Record<PortalDensity, string> = { comfortable: "Comfortable", compact: "Compact" };

/** Admin card for the company-wide client portal look: saved values, or the form while editing. */
export function PortalDesignForm({ initial }: { initial: PortalDesign }) {
  const { editing, setEditing } = useEditing();
  const [saved, setSaved] = useState(initial);
  if (!editing) {
    return (
      <ReadRows
        rows={[
          [
            "Accent colour",
            <span key="a" className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-4 w-4 rounded border border-line" style={{ background: saved.accent }} />
              <span className="font-mono">{saved.accent}</span>
            </span>,
          ],
          ["Default theme", THEME_LABEL[saved.theme]],
          ["Density", DENSITY_LABEL[saved.density]],
          // eslint-disable-next-line @next/next/no-img-element
          ["Default logo", saved.logoUrl ? <img key="l" src={saved.logoUrl} alt="Default logo" className="h-7 w-auto max-w-[140px] object-contain" /> : "None"],
        ]}
      />
    );
  }
  return (
    <PortalForm
      initial={saved}
      // The logo saves on upload, so it is kept even if the rest is cancelled.
      onLogo={(logoUrl) => setSaved((cur) => ({ ...cur, logoUrl }))}
      onDone={(next) => {
        if (next) setSaved((cur) => ({ ...cur, ...next }));
        setEditing(false);
      }}
    />
  );
}

/** The edit form, with a live preview. Unmounted on Cancel, which drops the draft. */
function PortalForm({
  initial,
  onLogo,
  onDone,
}: {
  initial: PortalDesign;
  onLogo: (url: string | null) => void;
  onDone: (saved?: Pick<PortalDesign, "accent" | "theme" | "density">) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [accent, setAccent] = useState(initial.accent);
  const [hex, setHex] = useState(initial.accent);
  const [theme, setTheme] = useState<PortalTheme>(initial.theme);
  const [density, setDensity] = useState<PortalDensity>(initial.density);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const file = useRef<HTMLInputElement>(null);
  const sysDark = useSyncExternalStore(subscribeDark, () => darkQuery().matches, () => false);

  const problem = accentProblem(hex);
  const ratio = problem ? null : contrastRatio(hex, "#ffffff");

  function pick(v: string) {
    setHex(v);
    if (!accentProblem(v)) setAccent(v.toLowerCase());
  }

  function save() {
    if (problem) return toast(problem);
    start(async () => {
      const r = await savePortalDesign({ accent: hex, theme, density });
      toast(r.ok ? "Portal design saved" : r.error);
      if (r.ok) onDone({ accent: hex.toLowerCase(), theme, density });
    });
  }

  function upload(f: File | undefined) {
    if (!f) return;
    const ext = logoExt(f.type);
    if (!ext || !(LOGO_TYPES as readonly string[]).includes(f.type)) return toast("Use a PNG, JPG or WebP image.");
    if (f.size > LOGO_MAX_BYTES) return toast("Use an image under 2 MB.");
    start(async () => {
      const sb = createClient();
      const path = `defaults/logo-${Date.now()}.${ext}`;
      const up = await sb.storage.from(LOGO_BUCKET).upload(path, f, { contentType: f.type });
      if (up.error) return toast(up.error.message);
      const r = await savePortalLogo(path);
      if (!r.ok) {
        await sb.storage.from(LOGO_BUCKET).remove([path]);
        return toast(r.error);
      }
      const url = sb.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      setLogoUrl(url);
      onLogo(url);
      toast("Logo saved");
    });
    if (file.current) file.current.value = "";
  }

  function removeLogo() {
    start(async () => {
      const r = await savePortalLogo(null);
      if (!r.ok) return toast(r.error);
      setLogoUrl(null);
      onLogo(null);
      toast("Logo removed");
    });
  }

  const dark = theme === "dark" || (theme === "system" && sysDark);
  const previewVars = { ...(dark ? DARK : LIGHT), "--accent": accent } as CSSProperties;
  const pad = density === "compact" ? "p-3 gap-2" : "p-5 gap-3";

  return (
    <div className="grid gap-5 min-[1100px]:grid-cols-[1fr_320px]">
      <div className="stack">
        <Field label="Accent colour" htmlFor="pd-hex" hint="Must reach 4.5:1 contrast on white so buttons and links stay readable.">
          <div className="row items-center">
            <input
              type="color"
              aria-label="Pick accent colour"
              value={accent}
              onChange={(e) => pick(e.currentTarget.value)}
              className="h-[var(--ctl-h)] w-12 cursor-pointer rounded-[var(--radius-ctl)] border border-line bg-surface p-1"
            />
            <Input id="pd-hex" value={hex} maxLength={7} onChange={(e) => pick(e.currentTarget.value.trim())} className="w-[120px] font-mono" aria-invalid={!!problem} />
            {problem ? <StatusDot tone="danger">Not accessible</StatusDot> : <StatusDot tone="ok">{ratio!.toFixed(1)}:1 on white</StatusDot>}
          </div>
          <div className="row mt-2 flex-wrap" role="group" aria-label="Accessible colours">
            {ACCENT_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use ${c}`}
                aria-pressed={c === accent}
                onClick={() => pick(c)}
                style={{ background: c }}
                className={`h-7 w-7 rounded-full border-2 ${c === accent ? "border-ink" : "border-line"}`}
              />
            ))}
          </div>
          {problem ? (
            <p role="alert" className="m-0 mt-1 text-danger">
              {problem}
            </p>
          ) : null}
        </Field>
        <Field label="Default theme">
          <Seg label="Default theme" value={theme} items={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={setTheme} />
        </Field>
        <Field label="Density">
          <Seg label="Density" value={density} items={[["comfortable", "Comfortable"], ["compact", "Compact"]]} onChange={setDensity} />
        </Field>
        <Field label="Default logo" htmlFor="pd-logo" hint="PNG, JPG or WebP, up to 2 MB. A client's own logo replaces it.">
          <div className="row items-center">
            <input ref={file} id="pd-logo" type="file" accept={LOGO_TYPES.join(",")} disabled={pending} onChange={(e) => upload(e.currentTarget.files?.[0])} />
            {logoUrl ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={removeLogo}>
                Remove logo
              </Button>
            ) : null}
          </div>
        </Field>
        <SaveCancel pending={pending} disabled={!!problem} onSave={save} onCancel={() => onDone()} />
        <p className="muted m-0">Branding set on a client page (colour and logo) overrides these defaults for that client.</p>
      </div>

      <div aria-label="Preview" role="region">
        <h4 className="m-0 mb-2 text-ink-3">Preview</h4>
        <div style={previewVars} className={`grid rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] ${pad}`}>
          <div className="row items-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-7 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="font-display font-bold">Client name</span>
            )}
          </div>
          <div className={`grid rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] ${pad}`}>
            <strong>Welcome back</strong>
            <span className="text-[var(--ink-2)]">2 tickets waiting for your reply.</span>
            <span className="text-[var(--accent)] underline">View tickets</span>
            <span className="justify-self-start rounded-[var(--radius-ctl)] bg-[var(--accent)] px-3 py-1.5 font-semibold text-white">Approve</span>
          </div>
        </div>
      </div>
    </div>
  );
}
