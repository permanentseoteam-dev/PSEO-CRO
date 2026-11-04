"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Button, Dialog, Field, FormGrid, Input, useToast } from "@/components/ui";
import { saveWebsite } from "../actions";
import type { Website } from "../types";

export function WebsiteEditor({ clientId, site }: { clientId: string; site: Website | null }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    url: site?.url ?? "",
    platform: site?.platform ?? "",
    hosting: site?.hosting ?? "",
    sslRenewsOn: site?.sslRenewsOn ?? "",
    domainRenewsOn: site?.domainRenewsOn ?? "",
    tracking: site?.tracking.join(", ") ?? "",
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = () =>
    start(async () => {
      const res = await saveWebsite({ clientId, ...f });
      if (!res.ok) return toast(res.error);
      toast("Site details saved");
      setOpen(false);
    });

  return (
    <>
      <Button size="sm" variant={site ? "default" : "primary"} onClick={() => setOpen(true)}>
        {site ? "Edit" : "Add site details"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Site details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending || f.url.trim().length < 3} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field label="Address" htmlFor="web-url" full>
            <Input id="web-url" value={f.url} onChange={set("url")} placeholder="example.com" />
          </Field>
          <Field label="Platform" htmlFor="web-platform">
            <Input id="web-platform" value={f.platform} onChange={set("platform")} />
          </Field>
          <Field label="Hosting" htmlFor="web-hosting">
            <Input id="web-hosting" value={f.hosting} onChange={set("hosting")} />
          </Field>
          <Field label="SSL renews" htmlFor="web-ssl">
            <Input id="web-ssl" type="date" value={f.sslRenewsOn} onChange={set("sslRenewsOn")} />
          </Field>
          <Field label="Domain renews" htmlFor="web-domain">
            <Input id="web-domain" type="date" value={f.domainRenewsOn} onChange={set("domainRenewsOn")} />
          </Field>
          <Field label="Tracking" htmlFor="web-tracking" hint="Comma separated" full>
            <Input id="web-tracking" value={f.tracking} onChange={set("tracking")} />
          </Field>
        </FormGrid>
      </Dialog>
    </>
  );
}
