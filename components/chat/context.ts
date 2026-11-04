"use client";

import { createContext, useContext } from "react";
import type { Conversation, Message, Person, Reaction } from "@/lib/modules/chat/types";

/** What message rows and panes need from the chat screen. */
export type ChatCtx = {
  me: { id: string; name: string };
  people: Map<string, Person>;
  conv: Conversation;
  messages: Message[];
  reactions: Reaction[];
  canModerate: boolean;
  editingId: number | null;
  menuId: number | null;
  setMenuId: (id: number | null) => void;
  react: (m: Message, emoji: string) => void;
  openThread: (id: number) => void;
  setEditingId: (id: number | null) => void;
  saveEdit: (m: Message, body: string) => void;
  togglePin: (m: Message) => void;
  remove: (m: Message) => void;
  forward: (m: Message) => void;
  ticket: (m: Message) => void;
  copyLink: (m: Message) => void;
  retry: (m: Message) => void;
  jumpTo: (id: number) => void;
};

export const ChatContext = createContext<ChatCtx | null>(null);

export function useChat() {
  const c = useContext(ChatContext);
  if (!c) throw new Error("useChat outside ChatContext");
  return c;
}
