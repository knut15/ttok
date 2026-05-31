"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomSheet } from "@/components/BottomSheet";
import {
  useDayAttendance,
  useEditRequests,
} from "@/features/attendance/hooks/useAttendance";
import { statusTone } from "@/features/attendance/domain";
import { DEFAULT_BREAK_RANGE } from "@/lib/constants";
import { parseHHMM } from "@/lib/time";
import { StatusChangeSheet } from "./StatusChangeSheet";
import { EditRequestForm } from "./EditRequestForm";
import { EditRequestList } from "./EditRequestList";

function Row({
  label,
  value,
  badge,
  action,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-lg font-bold">{value}</span>
        {badge}
      </div>
      {action}
    </div>
  );
}

// 근무기록 상세(AC-14~16): 출/퇴근/휴게 카드 + 상태변경 시트 + 수정요청.
// 시간변경은 로컬 draft 로 수집 → 수정요청(before→after)으로 제출.
// 상태변경(상태시트→PATCH 즉시 적용)과 시간변경(요청용 draft)은 분리된 흐름.
export function AttendanceDetail({ date }: { date: string }) {
  const { record, loading, changeStatus } = useDayAttendance(date);
  const { requests, submit } = useEditRequests();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [draft, setDraft] = useState<{
    clockIn: string | null;
    clockOut: string | null;
  } | null>(null);
  // record 로드/변경 시 draft 를 현재 값으로 동기화(렌더 중 상태 조정 — effect 불필요).
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const recordKey = record
    ? `${record.date}|${record.clockIn ?? ""}|${record.clockOut ?? ""}`
    : null;
  if (record && recordKey !== syncKey) {
    setDraft({ clockIn: record.clockIn, clockOut: record.clockOut });
    setSyncKey(recordKey);
  }

  if (loading) {
    return <p className="px-5 py-10 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (!record) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted">
        해당 날짜의 근무기록이 없습니다.
      </p>
    );
  }

  // sync 가 같은 렌더에서 이미 draft 를 채우지만, 타입 안전을 위해 record 로 폴백.
  const effectiveDraft = draft ?? {
    clockIn: record.clockIn,
    clockOut: record.clockOut,
  };

  const changeBtn = (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold"
    >
      상태변경
    </button>
  );

  return (
    <div>
      <div className="space-y-3 px-5">
        <Row
          label="출근"
          value={effectiveDraft.clockIn ?? "-"}
          badge={
            record.status !== "정상" ? (
              <StatusBadge label={record.status} tone={statusTone(record.status)} />
            ) : undefined
          }
          action={changeBtn}
        />
        <Row label="퇴근" value={effectiveDraft.clockOut ?? "-"} action={changeBtn} />
        <Row
          label="휴게"
          value={record.breakMinutes > 0 ? DEFAULT_BREAK_RANGE : "-"}
          action={
            <button
              type="button"
              onClick={() => setTimeSheetOpen(true)}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold"
            >
              시간변경
            </button>
          }
        />
      </div>

      <EditRequestForm
        onSubmit={async (reason) => {
          await submit({
            date,
            reason,
            after: {
              status: record.status,
              clockIn: effectiveDraft.clockIn,
              clockOut: effectiveDraft.clockOut,
            },
          });
        }}
      />

      <EditRequestList requests={requests.filter((r) => r.date === date)} />

      <StatusChangeSheet
        open={sheetOpen}
        current={record.status}
        onClose={() => setSheetOpen(false)}
        onChange={changeStatus}
      />

      <TimeChangeSheet
        // 열릴 때마다 remount 하여 현재 draft 로 입력을 초기화(effect 불필요).
        key={`${timeSheetOpen}|${effectiveDraft.clockIn ?? ""}|${effectiveDraft.clockOut ?? ""}`}
        open={timeSheetOpen}
        initial={effectiveDraft}
        onClose={() => setTimeSheetOpen(false)}
        onApply={(next) => {
          setDraft(next);
          setTimeSheetOpen(false);
        }}
      />
    </div>
  );
}

// 시간변경 시트(REWORK v3): clockIn/clockOut 을 HH:MM 으로 입력 → draft 갱신.
// parseHHMM 으로 유효성 검사. NaN 이면 "적용" 비활성.
function TimeChangeSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: { clockIn: string | null; clockOut: string | null };
  onClose: () => void;
  onApply: (next: { clockIn: string | null; clockOut: string | null }) => void;
}) {
  // key 로 remount 되므로 initial 로 직접 초기화(effect 불필요).
  const [clockIn, setClockIn] = useState(initial.clockIn ?? "");
  const [clockOut, setClockOut] = useState(initial.clockOut ?? "");

  const inValid = clockIn === "" || !Number.isNaN(parseHHMM(clockIn));
  const outValid = clockOut === "" || !Number.isNaN(parseHHMM(clockOut));
  const canApply = inValid && outValid;

  return (
    <BottomSheet open={open} onClose={onClose} title="시간변경">
      <div className="space-y-3">
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
        <p className="text-xs text-muted">형식: HH:MM (예 08:00)</p>
      </div>
      <button
        type="button"
        disabled={!canApply}
        onClick={() =>
          onApply({
            clockIn: clockIn === "" ? null : clockIn,
            clockOut: clockOut === "" ? null : clockOut,
          })
        }
        className="mt-4 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-black/5 disabled:text-muted"
      >
        적용
      </button>
    </BottomSheet>
  );
}
