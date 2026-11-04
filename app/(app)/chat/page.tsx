import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { ChatApp } from "@/components/chat/chat-app";
import { dubai } from "@/lib/modules/chat/logic";
import { getMessages, latestMessageId, listClients, listConversations, listPeople } from "@/lib/modules/chat/queries";

export const metadata = { title: "Chat" };

export default async function ChatPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "chat.use")) return <NoAccess />;

  const sp = await searchParams;
  const [conversations, people, clients, maxId] = await Promise.all([
    listConversations(me.id),
    listPeople(),
    me.kind === "staff" ? listClients() : Promise.resolve([]),
    latestMessageId(),
  ]);

  // Open the conversation from ?c=, else the one with the newest message.
  const byRecent = [...conversations].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  const current = conversations.find((c) => c.id === sp.c) ?? byRecent[0] ?? null;
  const initial = current ? await getMessages(current.id) : { messages: [], reactions: [] };
  const focusId = Number(sp.m) || null;

  return (
    <ChatApp
      me={{ id: me.id, name: me.name, kind: me.kind, perms: me.perms }}
      conversations={conversations}
      people={people}
      clients={clients}
      currentId={current?.id ?? null}
      initialMessages={initial.messages}
      initialReactions={initial.reactions}
      maxId={maxId}
      today={dubai(new Date().toISOString()).day}
      focusId={focusId}
    />
  );
}
