import { apiRequest } from "./client";

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  senderRole?: "teacher" | "student" | null;
  body: string;
  read?: boolean | null;
  createdAt?: string | null;
};

export type ConversationThread = {
  recipientId: string;
  recipientName?: string | null;
  recipientRole?: "teacher" | "student" | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
};

export function unwrapMessageList(data: unknown): DirectMessage[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as DirectMessage[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.messages)) return d.messages as DirectMessage[];
    if (Array.isArray(d.items)) return d.items as DirectMessage[];
    if (Array.isArray(d.data)) return d.data as DirectMessage[];
  }
  return [];
}

export function unwrapThreadList(data: unknown): ConversationThread[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as ConversationThread[];
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.threads)) return d.threads as ConversationThread[];
    if (Array.isArray(d.items)) return d.items as ConversationThread[];
    if (Array.isArray(d.data)) return d.data as ConversationThread[];
  }
  return [];
}

export async function listConversations() {
  return apiRequest<unknown>("/messages/threads", { method: "GET" });
}

export async function listMessages(recipientId: string) {
  return apiRequest<unknown>(`/messages/${encodeURIComponent(recipientId)}`, {
    method: "GET",
  });
}

export async function sendMessage(recipientId: string, body: string) {
  return apiRequest<DirectMessage>("/messages", {
    method: "POST",
    body: JSON.stringify({ recipientId, body }),
  });
}

export async function markMessageRead(messageId: string) {
  return apiRequest<unknown>(`/messages/${encodeURIComponent(messageId)}/read`, {
    method: "PATCH",
  });
}

export async function getUnreadCount() {
  return apiRequest<{ count: number }>("/messages/unread-count", {
    method: "GET",
  });
}
