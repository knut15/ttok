"use client";

// 알림 벨 + 미읽음 배지(홈 헤더). 탭하면 시트로 알림 목록 표시 + 전부 읽음 처리.
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useNotifications } from "@/features/accounts/hooks/useNotifications";

function timeLabel(iso: string): string {
  // "2026-06-05T08:30:00.000Z" → "06-05 08:30" (간단 표기)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : "";
}

export function NotificationBell() {
  const { items, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const openSheet = () => {
    setOpen(true);
    if (unread > 0) markRead(); // 열면 읽음 처리 → 배지 해제
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={`알림${unread > 0 ? ` ${unread}건` : ""}`}
        className="relative text-xl text-muted"
      >
        🔔
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <BottomSheet open onClose={() => setOpen(false)} title="알림">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">알림이 없습니다.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl bg-white px-3 py-2.5"
                >
                  <p className="text-sm font-medium">{n.message}</p>
                  <p className="pt-0.5 text-xs text-muted">{timeLabel(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      ) : null}
    </>
  );
}
