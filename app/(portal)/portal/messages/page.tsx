import { can } from "@/lib/auth/can";
import { Avatar, Button, Card, CardBody, CardHead, EmptyState, NoAccess, Textarea } from "@/components/ui";
import { ChatApp } from "@/components/chat/chat-app";
import { dubai } from "@/lib/modules/chat/logic";
import { getMessages, latestMessageId, listConversations, listPeople } from "@/lib/modules/chat/queries";
import { listPreviewMessages, portalContext } from "@/lib/modules/portal/queries";
import { fmtDayTime } from "@/lib/modules/portal/logic";
import { NoClient } from "../../_components/page-head";

export const metadata = { title: "Messages" };

// The client's chat channel(s), live through the Chat module's components and actions.
export default async function PortalMessages() {
  const { me, client, preview } = await portalContext();
  if (!can(me, "chat.use")) return <NoAccess />;
  if (!client) return <NoClient />;

  if (preview) {
    // Staff preview: the client's channel as they see it, without the live composer.
    const chat = await listPreviewMessages(client.id, me.id);
    if (!chat) {
      return (
        <div className="page">
          <EmptyState title="No conversation yet">Your team will open a channel with you soon.</EmptyState>
        </div>
      );
    }
    return (
      <div className="page">
        <Card>
          <CardHead title={chat.channel ? `#${chat.channel}` : "Messages"} />
          <CardBody>
            {chat.messages.length ? (
              <div className="list">
                {chat.messages.map((m) => (
                  <div key={m.id} className="item row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <Avatar name={m.author} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{m.author}</b> <span className="muted small">{fmtDayTime(m.at)}</span>
                      <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>No messages yet.</p>
            )}
          </CardBody>
          <CardBody className="row" style={{ flexWrap: "nowrap" }}>
            <Textarea aria-label="Message" rows={1} disabled placeholder="Sending is off in this read-only preview" style={{ flex: 1 }} />
            <Button variant="primary" disabled>
              Send
            </Button>
          </CardBody>
        </Card>
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
