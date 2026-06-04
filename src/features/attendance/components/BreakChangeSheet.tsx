"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { parseHHMM } from "@/lib/time";

// 휴게 시간변경 시트(T7 AC-1): 휴게 시작/종료 HH:MM 2입력만.
// 퇴근시각(clockOut) 입력은 절대 없다(잘못된 기존 배선 제거).
// onApply → {breakStart, breakEnd} 범위만 반환 → AttendanceDetail breakDraft 갱신.
// 적용 활성 = 둘 다 유효 HH:MM AND end>start (역전/동일 비활성, E-2/E-5 흡수).
export function BreakChangeSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: { breakStart: string; breakEnd: string };
  onClose: () => void;
  onApply: (next: { breakStart: string; breakEnd: string }) => void;
}) {
  // key 로 remount 되므로 initial 로 직접 초기화(effect 불필요).
  const [breakStart, setBreakStart] = useState(initial.breakStart);
  const [breakEnd, setBreakEnd] = useState(initial.breakEnd);

  const start = parseHHMM(breakStart);
  const end = parseHHMM(breakEnd);
  const canApply =
    !Number.isNaN(start) && !Number.isNaN(end) && end > start;

  return (
    <BottomSheet open={open} onClose={onClose} title="휴게 시간변경">
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">휴게 시작</span>
          <input
            type="time"
            value={breakStart}
            onChange={(e) => setBreakStart(e.target.value)}
            className="rounded-lg border border-foreground/10 px-3 py-2 text-base"
            aria-label="휴게 시작 시각"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">휴게 종료</span>
          <input
            type="time"
            value={breakEnd}
            onChange={(e) => setBreakEnd(e.target.value)}
            className="rounded-lg border border-foreground/10 px-3 py-2 text-base"
            aria-label="휴게 종료 시각"
          />
        </label>
        <p className="text-xs text-muted">
          휴게 시작·종료를 입력하면 근무시간이 재계산돼요. (예 11:30~12:00)
        </p>
      </div>
      <button
        type="button"
        disabled={!canApply}
        onClick={() => onApply({ breakStart, breakEnd })}
        className="mt-4 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-foreground/5 disabled:text-muted"
      >
        적용
      </button>
    </BottomSheet>
  );
}
