import { can, requireMe } from "@/lib/auth/can";
import { checkScope } from "../logic";
import { getClientCardData, getDependencies, getScopeData, getTicketPeople } from "../queries";
import { ClientCardForm, DependenciesCard, PeoplePicker, ScopeCard } from "./ticket-extras-client";

// Ticket page (/t/[key]) extras. Each is an async server component taking the ticket's uuid.
// Staff only: client logins get nothing (the portal reads the client card columns on tickets directly).

/** Main column card "Dependencies": blocked by / blocks, add by key, remove. */
export async function TicketDependencies({ ticketId }: { ticketId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff") return null;
  const deps = await getDependencies(ticketId);
  return <DependenciesCard ticketId={ticketId} {...deps} />;
}

/** Side panel rows "Co-assignees" and "Watchers" (a <dt>/<dd> pair each, for the panel's <dl>). */
export async function TicketPeopleFields({ ticketId }: { ticketId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff") return null;
  const { people, coAssignees, watchers } = await getTicketPeople(ticketId);
  return (
    <>
      <dt>Co-assignees</dt>
      <dd>
        <PeoplePicker ticketId={ticketId} kind="co" people={people} selected={coAssignees} />
      </dd>
      <dt>Watchers</dt>
      <dd>
        <PeoplePicker ticketId={ticketId} kind="watch" people={people} selected={watchers} />
      </dd>
    </>
  );
}

/** Main column card "Client": portal title, details, shared files, needs approval. Hidden for internal projects. */
export async function TicketClientCard({ ticketId }: { ticketId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff") return null;
  const data = await getClientCardData(ticketId);
  if (!data?.clientId) return null;
  return <ClientCardForm ticketId={ticketId} clientId={data.clientId} card={data.card} files={data.files} />;
}

/** Side panel card "Scope": suggestion from the client's terms, and the recorded decision. */
export async function TicketScopeCard({ ticketId }: { ticketId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff") return null;
  const data = await getScopeData(ticketId);
  if (!data?.clientId) return null;
  const hasTerms = data.terms.inScope.length + data.terms.outOfScope.length > 0;
  return (
    <ScopeCard
      ticketId={ticketId}
      clientId={data.clientId}
      suggestion={hasTerms ? checkScope(data.text, data.terms) : null}
      flag={data.flag}
      canDecide={can(me, "clients.view")}
    />
  );
}
