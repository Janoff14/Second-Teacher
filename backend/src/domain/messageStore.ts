import { randomUUID } from "node:crypto";
import type { Role } from "./userStore";

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  senderRole: Role;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface ConversationThread {
  recipientId: string;
  recipientName: string | null;
  recipientRole: Role | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

const messages: DirectMessage[] = [];

export function sendMessage(
  senderId: string,
  senderRole: Role,
  recipientId: string,
  body: string,
): DirectMessage {
  const msg: DirectMessage = {
    id: randomUUID(),
    senderId,
    recipientId,
    senderRole,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  messages.push(msg);
  return msg;
}

export function listMessagesBetween(
  userA: string,
  userB: string,
): DirectMessage[] {
  return messages
    .filter(
      (m) =>
        (m.senderId === userA && m.recipientId === userB) ||
        (m.senderId === userB && m.recipientId === userA),
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

export function markMessageRead(messageId: string, userId: string): DirectMessage | null {
  const msg = messages.find(
    (m) => m.id === messageId && m.recipientId === userId,
  );
  if (!msg) return null;
  msg.read = true;
  return msg;
}

export function markConversationRead(currentUserId: string, otherUserId: string): number {
  let count = 0;
  for (const m of messages) {
    if (m.recipientId === currentUserId && m.senderId === otherUserId && !m.read) {
      m.read = true;
      count++;
    }
  }
  return count;
}

export function getUnreadCount(userId: string): number {
  return messages.filter((m) => m.recipientId === userId && !m.read).length;
}

/**
 * Build conversation thread list for a user.
 * `resolveUser` is called to look up display name and role for each counterpart.
 */
export function listThreads(
  userId: string,
  resolveUser: (id: string) => { displayName: string | null; role: Role } | undefined,
): ConversationThread[] {
  const counterparts = new Set<string>();
  for (const m of messages) {
    if (m.senderId === userId) counterparts.add(m.recipientId);
    if (m.recipientId === userId) counterparts.add(m.senderId);
  }

  const threads: ConversationThread[] = [];
  for (const cId of counterparts) {
    const conversation = listMessagesBetween(userId, cId);
    const last = conversation[conversation.length - 1] ?? null;
    const unread = conversation.filter(
      (m) => m.recipientId === userId && !m.read,
    ).length;
    const user = resolveUser(cId);
    threads.push({
      recipientId: cId,
      recipientName: user?.displayName ?? null,
      recipientRole: user?.role ?? null,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.createdAt ?? null,
      unreadCount: unread,
    });
  }

  threads.sort((a, b) => {
    const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tB - tA;
  });

  return threads;
}

export function getConversationPartnerIds(userId: string): string[] {
  const partners = new Set<string>();
  for (const m of messages) {
    if (m.senderId === userId) partners.add(m.recipientId);
    if (m.recipientId === userId) partners.add(m.senderId);
  }
  return [...partners];
}

export function resetMessagesForTest(): void {
  messages.length = 0;
}
