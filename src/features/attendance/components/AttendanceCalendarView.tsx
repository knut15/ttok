"use client";

// 월 이동 client 래퍼(AC-10/11): month useState + ‹ 라벨 › 화살표 + 매장명 + 캘린더.
// page(RSC) 셸은 보존하고 월 상태를 이 경계로 지역화(architect §2.3).
import { useState, useSyncExternalStore } from "react";
import { MonthBar } from "@/components/MonthBar";
import { StoreBar } from "@/components/StoreBar";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { ClockFab } from "./ClockFab";
import { MonthPickerSheet } from "@/components/MonthPickerSheet";
import { SEED_MONTH, SEED_JOIN_DATE } from "@/lib/constants";
import { todayMonth } from "@/lib/date";

// 마운트 여부 구독(HomeToday 동일 패턴, AC-T6-7). 서버/첫CSR 스냅샷 false →
// SSR·하이드레이션은 SEED_MONTH 중립 스냅샷, 마운트 후 실제 현재월로 초기화.
const emptySubscribe = () => () => {};

export function AttendanceCalendarView() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  // 마운트 전(SSR/첫CSR)은 SEED_MONTH 중립 스냅샷 → 하이드레이션 텍스트 불일치 0.
  // 마운트 후 사용자가 아직 월을 직접 고르지 않았다면(month===null) 실제 현재월 사용.
  const [picked, setMonth] = useState<string | null>(null);
  const currentMonth = mounted ? todayMonth() : SEED_MONTH;
  const month = picked ?? currentMonth;
  // 월 picker open state(AC-12/15). month 단일 소유 유지(setMonth 그대로).
  const [pickerOpen, setPickerOpen] = useState(false);
  // T11 ST-3(AC-6): FAB 등록 성공 시 reloadKey 증가 → MonthlyCalendar effect 가 현재 월 갱신.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div>
      <StoreBar />
      <MonthBar month={month} onChange={setMonth} onPick={() => setPickerOpen(true)} />
      <MonthlyCalendar month={month} reloadKey={reloadKey} />
      <ClockFab onRegistered={() => setReloadKey((k) => k + 1)} />
      <MonthPickerSheet
        open={pickerOpen}
        current={month}
        joinMonth={SEED_JOIN_DATE.slice(0, 7)}
        currentMonth={currentMonth}
        onSelect={(m) => {
          setMonth(m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
