"use client";

import { useState } from "react";
import { WORK_STATUSES } from "@/lib/constants";
import { canSubmitAddRecord } from "@/features/attendance/domain";
import type { WorkStatus } from "@/types";

const MAX = 100;

// T15(S1): 레코드 없는 과거/오늘 날짜의 "근무 추가" 폼(멤버 본인).
// 입력: 상태 라디오 5종(기본 정상) + 출근시각(필수 HH:MM) + 퇴근시각(선택 null 허용) + 사유(EditRequestForm 패턴).
// 로컬 검증(canSubmitAddRecord): 출근 미입력/형식불량 또는 (둘 다 있고 퇴근<=출근) → 제출 비활성(Q5/AC-11).
// store/fetch 비접근 — onSubmit 으로 상위(AttendanceDetail)가 useEditRequests.submit 재사용.
export function AddRecordForm({
  onSubmit,
}: {
  onSubmit: (input: {
    status: WorkStatus;
    clockIn: string;
    clockOut: string | null;
    reason: string;
  }) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<WorkStatus>("정상");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");

  const trimmed = reason.trim();
  const canSubmit =
    canSubmitAddRecord({ clockIn, clockOut }) && trimmed.length > 0;

  return (
    <section className="px-5 pt-6">
      <h2 className="mb-2 text-lg font-bold">근무 추가</h2>
      <p className="mb-4 text-sm text-muted">
        기록이 누락된 날의 근무를 직접 입력해 추가요청합니다.
      </p>

      <div className="space-y-3 rounded-2xl border border-black/10 bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-sm text-muted">출근상태</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {WORK_STATUSES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="radio"
                  name="add-status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="h-5 w-5 accent-coral"
                />
                <span className="text-base">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">출근</span>
          <input
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-base"
            aria-label="출근 시각"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">퇴근</span>
          <input
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-base"
            aria-label="퇴근 시각"
          />
        </label>
      </div>

      <div className="mt-3 rounded-2xl border border-black/10 bg-surface p-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder="사유를 입력해 주세요."
          rows={3}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <div className="text-right text-sm">
          <span className={reason.length > 0 ? "text-coral" : "text-muted"}>
            {reason.length}
          </span>
          <span className="text-muted">/{MAX}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={async () => {
          await onSubmit({
            status,
            clockIn,
            clockOut: clockOut === "" ? null : clockOut,
            reason: trimmed,
          });
          setClockIn("");
          setClockOut("");
          setReason("");
          setStatus("정상");
        }}
        className="mt-3 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-black/5 disabled:text-muted"
      >
        추가요청
      </button>
    </section>
  );
}
