// /api/notifications — 현재 사용자(멤버) 알림.
// GET → { items, unread }. POST(read) → 전부 읽음 처리. scope.crewId 기준.
import { NextResponse } from "next/server";
import { listNotifications, unreadNotificationCount, markNotificationsRead } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import type { NotificationsResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const { crewId } = await resolveScope(request);
  const payload: NotificationsResponse = {
    items: await listNotifications(crewId),
    unread: await unreadNotificationCount(crewId),
  };
  return NextResponse.json(payload, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  // 읽음 처리(현재 사용자 전체).
  const { crewId } = await resolveScope(request);
  const updated = await markNotificationsRead(crewId);
  return NextResponse.json({ ok: true, updated }, { headers: NO_STORE });
}
