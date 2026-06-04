"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { parseHHMM } from "@/lib/time";

// 퇴근 시각 정정 시트 — 즉시 PATCH 아님. onApply 로 draft 갱신, 수정요청으로 제출.
// 적용 활성 = 빈값(퇴근 미기록) 또는 parseHHMM 유효(NaN 비활성).
export function ClockOutTimeSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: string | null;
  onClose: () => void;
  onApply: (clockOut: string | null) => void;
}) {
  const [clockOut, setClockOut] = useState(initial ?? "");
  const canApply = clockOut === "" || !Number.isNaN(parseHHMM(clockOut));

  return (
    <BottomSheet open={open} onClose={onClose} title="퇴근 시각 정정">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">퇴근 시각</span>
        <input
          type="time"
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
          className="rounded-lg border border-foreground/10 px-3 py-2 text-base"
          aria-label="퇴근 시각"
        />
      </label>
      <p className="mt-2 text-xs text-muted">변경 후 아래 수정요청으로 제출하세요.</p>
      <button
        type="button"
        disabled={!canApply}
        onClick={() => onApply(clockOut === "" ? null : clockOut)}
        className="mt-4 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-black/5 disabled:text-muted"
      >
        적용
      </button>
    </BottomSheet>
  );
}
