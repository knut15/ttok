"use client";

// 현재 사용자(크루) 알림 훅. GET /api/notifications 폴링(대타 승인 등 실시간 감지) + 읽음 처리.
import { useCallback, useEffect, useState } from "react";
import type { Notification, NotificationsResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const POLL_MS = 10000;

export function useNotifications() {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/notifications", { cache: "no-store", headers: authHeaders(user) })
        .then((r) => (r.ok ? (r.json() as Promise<NotificationsResponse>) : null))
        .then((json) => {
          if (!active || !json) return;
          setItems(json.items);
          setUnread(json.unread);
        });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, user.role, tick]);

  const markRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "POST",
      cache: "no-store",
      headers: authHeaders(user),
    });
    reload();
  }, [user, reload]);

  return { items, unread, markRead };
}
