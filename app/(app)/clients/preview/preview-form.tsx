"use client";

import { useState, useTransition } from "react";
import { Button, Field, Select } from "@/components/ui";
import { startClientPreview } from "../preview-actions";

export function ClientPreviewForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const clientId = String(new FormData(event.currentTarget).get("clientId") ?? "");
        setError(null);
        start(async () => {
          const result = await startClientPreview(clientId);
          setError(result.error);
        });
      }}
    >
      <Field label="Client" htmlFor="preview-client">
        <Select id="preview-client" name="clientId" defaultValue="" required disabled={pending}>
          <option value="" disabled>Choose a client</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </Select>
      </Field>
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Opening preview…" : "Open client view"}
      </Button>
    </form>
  );
}
