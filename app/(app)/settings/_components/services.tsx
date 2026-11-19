"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, Card, CardBody, Dialog, Field, Input, Table, Td, Th, useToast } from "@/components/ui";
import { addService, deleteService, renameService, serviceUsage } from "@/lib/modules/services/actions";
import { ServiceName, deleteWarning, duplicateError, isDuplicateName, type Service, type ServiceUsage } from "@/lib/modules/services/logic";

type Draft = { id?: string; name: string };

type Props = { services: Service[]; view?: "list" | "board"; usage?: Record<string, ServiceUsage>; viewSwitch?: ReactNode };

/** Admin: list, add, rename and delete the services used by templates and clients. Board view shows them as cards with usage. */
export function ServicesManager({ services, view = "list", usage, viewSwitch }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const parsed = draft ? ServiceName.safeParse(draft.name) : null;
  const problem = !draft
    ? null
    : !parsed?.success
      ? (parsed?.error.issues[0]?.message ?? null)
      : isDuplicateName(draft.name, services, draft.id)
        ? duplicateError(draft.name)
        : null;

  function save() {
    if (!draft || problem) return;
    start(async () => {
      const r = draft.id ? await renameService(draft.id, draft.name) : await addService(draft.name);
      toast(r.ok ? (draft.id ? "Service saved" : "Service added") : r.error);
      if (r.ok) setDraft(null);
    });
  }

  function remove(s: Service) {
    start(async () => {
      const u = await serviceUsage(s.id);
      if (!u.ok) return toast(u.error);
      if (!window.confirm(deleteWarning(s.name, u.usage))) return;
      const r = await deleteService(s.id);
      toast(r.ok ? `Deleted "${s.name}"` : r.error);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewSwitch}
        <Button variant="primary" className="ml-auto" disabled={pending} onClick={() => setDraft({ name: "" })}>
          Add service
        </Button>
      </div>
      {view === "board" ? (
        services.length === 0 ? (
          <p className="muted m-0">No services yet.</p>
        ) : (
          <div className="grid-3">
            {services.map((s) => {
              const u = usage?.[s.id] ?? { templates: 0, clients: 0 };
              return (
                <Card key={s.id} className="flex flex-col">
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <h4 className="m-0 break-words text-[15px]">{s.name}</h4>
                    <dl className="muted m-0 grid grid-cols-2 gap-x-4 text-[13px]">
                      {[
                        { n: u.clients, label: u.clients === 1 ? "client" : "clients" },
                        { n: u.templates, label: u.templates === 1 ? "template" : "templates" },
                      ].map((x) => (
                        <div key={x.label} className="flex min-w-0 flex-col-reverse">
                          <dt>{x.label}</dt>
                          <dd className="num m-0 text-lg font-semibold leading-tight">{x.n}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="row mt-auto pt-1">
                      <Button size="sm" disabled={pending} onClick={() => setDraft({ id: s.id, name: s.name })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(s)}>
                        Delete
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <Td>{s.name}</Td>
                <Td right>
                  <div className="row justify-end">
                    <Button size="sm" disabled={pending} onClick={() => setDraft({ id: s.id, name: s.name })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(s)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {services.length === 0 ? (
              <tr>
                <Td colSpan={2} className="muted">
                  No services yet.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Rename service" : "Add service"}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" disabled={pending || !!problem} onClick={save}>
              {draft?.id ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Name" htmlFor="service-name" hint={draft.id ? "Templates and clients using this service follow the new name." : undefined}>
              <Input id="service-name" value={draft.name} maxLength={40} autoFocus onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
            </Field>
            {problem && draft.name.trim() ? (
              <p role="alert" className="m-0 text-danger">
                {problem}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
