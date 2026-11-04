"use client";

import { useState, useTransition } from "react";
import { Button, CardBody, Checkbox, Field, Select, useToast } from "@/components/ui";
import { savePersonAccess } from "../../../actions";

type Status = "active" | "suspended" | "left";

export function AccessForm({
  memberId,
  roles,
  initialRoles,
  initialStatus,
  canGrantSuper,
}: {
  memberId: string;
  roles: { key: string; name: string; description: string | null }[];
  initialRoles: string[];
  initialStatus: Status;
  canGrantSuper: boolean;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState(initialRoles);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, start] = useTransition();

  const toggle = (key: string, on: boolean) => setPicked((cur) => (on ? [...cur, key] : cur.filter((k) => k !== key)));

  return (
    <CardBody className="stack">
      <div className="grid gap-2" role="group" aria-label="Roles">
        {roles.map((r) => (
          <Checkbox
            key={r.key}
            checked={picked.includes(r.key)}
            disabled={r.key === "super_admin" && !canGrantSuper}
            onChange={(e) => toggle(r.key, e.target.checked)}
            label={
              <span>
                <b className="font-semibold">{r.name}</b>
                {r.description ? <span className="muted"> · {r.description}</span> : null}
              </span>
            }
          />
        ))}
      </div>
      <div className="form-grid">
        <Field label="Status" htmlFor="pa-status" hint="Suspended and left people can't sign in.">
          <Select id="pa-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="left">Left</option>
          </Select>
        </Field>
      </div>
      <div className="row">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await savePersonAccess({ memberId, roles: picked, status });
              toast(res.ok ? "Access saved" : res.error);
            })
          }
        >
          {pending ? "Saving…" : "Save access"}
        </Button>
      </div>
    </CardBody>
  );
}
