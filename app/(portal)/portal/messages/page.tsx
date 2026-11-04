import { can } from "@/lib/auth/can";
import { ButtonLink, EmptyState, NoAccess } from "@/components/ui";
import { ChatApp } from "@/components/chat/chat-app";
import { dubai } from "@/lib/modules/chat/logic";
import { getMessages, latestMessageId, listConversations, listPeople } from "@/lib/modules/chat/queries";
import { portalContext } from "@/lib/modules/portal/queries";
import { NoClient } from "../../_components/page-head";

export const metadata = { title: "Messages" };

// The client's chat channel(s), live through the Chat module's components and actions.
export default async function PortalMessages() {
  const { me, client } = await portalContext();
  if (!can(me, "chat.use")) return <NoAccess />;
  if (!client) return <NoClient />;

  if (me.kind === "staff") {
    return (
      <div className="page">
        <EmptyState title="Client messages live in Chat" action={<ButtonLink href="/chat">Open Chat</ButtonLink>}>
          The client sees their channel here. Reply to them from Chat.
        </EmptyState>
      </div>
    );
  }

  const [all, people, maxId] = await Promise.all([listConversations(me.id), listPeople(), latestMessageId()]);
  const conversations = all.filter((c) => c.kind === "client" && c.clientId === client.id);
  const current = [...conversations].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))[0] ?? null;
  const initial = current ? await getMessages(current.id) : { messages: [], reactions: [] };

  if (!current) {
    return (
      <div className="page">
        <EmptyState title="No conversation yet">Your team will open a channel with you soon.</EmptyState>
      </div>
    );
  }

  return (
    <ChatApp
      me={{ id: me.id, name: me.name, kind: me.kind, perms: me.perms }}
      conversations={conversations}
      people={people}
      clients={[]}
      currentId={current.id}
      initialMessages={initial.messages}
      initialReactions={initial.reactions}
      maxId={maxId}
      today={dubai(new Date().toISOString()).day}
      focusId={null}
    />
  );
}
