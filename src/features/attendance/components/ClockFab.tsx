"use client";

import { useSyncExternalStore } from "react";
import { nowHHMM, todayDate } from "@/lib/date";
import { useTodayClock } from "@/features/attendance/hooks/useAttendance";
import { clockOutConfirmMessage } from "./clockFabConfirm";

// 마운트 여부 구독(HomeToday/BottomNav 동일 패턴). 서버/첫CSR false → mount 전 미렌더.
const emptySubscribe = () => () => {};

/**
 * 출퇴근 등록 FAB(T11 ST-2): /attendance 우하단 플로팅 버튼.
 *   useTodayClock(todayDate()) 공용 훅 소비(홈 ClockToggle 과 단일 진실원).
 *   phase: before→"출근" / working→"퇴근" / done→비활성 "마감".
 *   fixed z-40(BottomNav z-30 위·BottomSheet z-50 아래), bottom 오프셋으로 BottomNav 바와 비겹침.
 *   client-only + 오늘 날짜 mount-gate(todayDate build 고정 mismatch 회피, 하이드레이션 0, FR-1.5).
 *   마스터 포함 무조건 노출(authHeaders 가 self 스코프 강제, Q-2).
 */
export function ClockFab({ onRegistered }: { onRegistered?: () => void }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // mount 전(SSR/첫CSR)은 todayDate 미확정 → 미렌더(하이드레이션 안전, FR-1.5/E-4).
  if (!mounted) return null;

  return <ClockFabInner onRegistered={onRegistered} />;
}

// mount 확정 후에만 마운트 → todayDate()/useTodayClock 을 client 에서만 실행.
function ClockFabInner({ onRegistered }: { onRegistered?: () => void }) {
  const { phase, busy, clockIn, clockOut } = useTodayClock(todayDate());

  async function handleClick() {
    if (phase === "before") {
      // 출근은 즉시(확인 없음, T12 AC-3 / T11 회귀 0).
      const res = await clockIn();
      if (res) onRegistered?.();
      return;
    }
    // 퇴근은 현재 시각 확인 대화상자 후에만 처리(취소 시 미처리, T12 AC-3).
    // P2-1: now 를 한 번만 캡처 → confirm 메시지 시각과 clockOut PATCH 시각을
    //   동일 인스턴스로 통일(분 경계에서 표시 시각 ≠ 저장 시각 레이스 차단).
    const now = new Date();
    if (!window.confirm(clockOutConfirmMessage(now))) return;
    const res = await clockOut(nowHHMM(now));
    if (res) onRegistered?.();
  }

  const label =
    phase === "before" ? "출근" : phase === "working" ? "퇴근" : "마감";
  const disabled = phase === "done" || busy;

  return (
    <button
      type="button"
      aria-label={`오늘 ${label}`}
      disabled={disabled}
      onClick={handleClick}
      className="fixed bottom-28 right-4 z-40 mx-auto rounded-full bg-coral px-6 py-4 font-bold text-white shadow-lg disabled:bg-black/20 disabled:text-white/70 sm:right-[calc((100vw-28rem)/2+1rem)]"
    >
      {label}
    </button>
  );
}
