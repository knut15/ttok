"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { WORK_STATUSES } from "@/lib/constants";
import { parseHHMM } from "@/lib/time";
import type { WorkStatus } from "@/types";

// 퇴근 상태변경 시트(T7 AC-4): 상태 라디오 5종 + 퇴근시각(clockOut) 입력.
// 즉시 PATCH 아님(Q3) — onApply 로 draft 만 갱신, AttendanceDetail 이 수정요청으로 제출.
// 적용 활성 = clockOut 빈값 또는 parseHHMM 유효(NaN 비활성, E-4).
export function ClockOutStatusSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: { status: WorkStatus; clockOut: string | null };
  onClose: () => void;
  onApply: (next: { status: WorkStatus; clockOut: string | null }) => void;
}) {
  // key 로 remount 되므로 initial 로 직접 초기화(effect 불필요).
  const [status, setStatus] = useState<WorkStatus>(initial.status);
  const [clockOut, setClockOut] = useState(initial.clockOut ?? "");

  const canApply = clockOut === "" || !Number.isNaN(parseHHMM(clockOut));

  return (
    <BottomSheet open={open} onClose={onClose} title="퇴근 상태변경">
      <ul className="space-y-1">
        {WORK_STATUSES.map((s) => (
          <li key={s}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="radio"
                name="clockout-status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="h-5 w-5 accent-coral"
              />
              <span className="text-base">{s}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-2 flex items-center justify-between gap-3">
        <span className="text-sm text-muted">퇴근</span>
        <input
          type="time"
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
          className="rounded-lg border border-black/10 px-3 py-2 text-base"
          aria-label="퇴근 시각"
        />
      </label>
      <button
        type="button"
        disabled={!canApply}
        onClick={() =>
          onApply({ status, clockOut: clockOut === "" ? null : clockOut })
        }
        className="mt-4 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-black/5 disabled:text-muted"
      >
        적용
      </button>
    </BottomSheet>
  );
}
