"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useDayAttendance,
  useEditRequests,
} from "@/features/attendance/hooks/useAttendance";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { statusTone } from "@/features/attendance/domain";
import { DEFAULT_BREAK_RANGE } from "@/lib/constants";
import { todayDate } from "@/lib/date";
import type { WorkStatus } from "@/types";
import { StatusChangeSheet } from "./StatusChangeSheet";
import { BreakChangeSheet } from "./BreakChangeSheet";
import { ClockOutStatusSheet } from "./ClockOutStatusSheet";
import { AddRecordForm } from "./AddRecordForm";
import { EditRequestForm } from "./EditRequestForm";
import { EditRequestList } from "./EditRequestList";
import { useDaySchedule } from "@/features/schedule/hooks/useDaySchedule";
import { ScheduleVsActual } from "@/features/schedule/components/ScheduleVsActual";

const [DEFAULT_BREAK_START, DEFAULT_BREAK_END] = DEFAULT_BREAK_RANGE.split("~");

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

// 근무기록 상세(T7): 출/퇴근/휴게 카드 + 시트 3종 + 수정요청.
// - 출근 행 → StatusChangeSheet 즉시 PATCH(현행 유지, Q2).
// - 퇴근 행 → ClockOutStatusSheet(상태+퇴근시각) → draft → 수정요청(Q3).
// - 휴게 행 → BreakChangeSheet(휴게 범위) → draft → 수정요청(Q3).
// clockIn 은 모든 경로에서 record 값 고정(불변, AC-8).
export function AttendanceDetail({ date }: { date: string }) {
  const { record, loading, changeStatus, reload: reloadDay } =
    useDayAttendance(date);
  const { requests, submit, approve } = useEditRequests();
  const { user } = useCurrentUser();
  const schedule = useDaySchedule(date); // T21: 예정 대비 실제 비교용
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [clockOutSheetOpen, setClockOutSheetOpen] = useState(false);
  const [breakSheetOpen, setBreakSheetOpen] = useState(false);
  const [draft, setDraft] = useState<{
    status: WorkStatus;
    clockOut: string | null;
    breakStart?: string;
    breakEnd?: string;
  } | null>(null);
  // record 로드/변경 시 draft 를 현재 값으로 동기화(렌더 중 상태 조정 — effect 불필요).
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const recordKey = record
    ? `${record.date}|${record.clockOut ?? ""}|${record.status}|${record.breakStart ?? ""}|${record.breakEnd ?? ""}`
    : null;
  if (record && recordKey !== syncKey) {
    setDraft({
      status: record.status,
      clockOut: record.clockOut,
      breakStart: record.breakStart,
      breakEnd: record.breakEnd,
    });
    setSyncKey(recordKey);
  }

  if (loading) {
    return <p className="px-5 py-10 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (!record) {
    // T15(S1/S4): 레코드 없는 날 — 미래(Q3)는 추가 불가 안내, 과거/오늘은 "근무 추가" 폼.
    if (date > todayDate()) {
      return (
        <p className="px-5 py-10 text-center text-sm text-muted">
          미래 날짜는 추가할 수 없습니다.
        </p>
      );
    }
    return (
      <div>
        <AddRecordForm
          onSubmit={async ({ status, clockIn, clockOut, reason }) => {
            // 추가요청: before 미전송 → store.addRequest 가 빈 스냅샷 자동 생성(AC-5).
            await submit({
              date,
              reason,
              after: { status, clockIn, clockOut },
            });
          }}
        />
        <EditRequestList
          requests={requests.filter((r) => r.date === date)}
          canApprove={user.role === "master"}
          onApprove={async (id) => {
            if (await approve(id)) await reloadDay();
          }}
        />
      </div>
    );
  }

  // sync 가 같은 렌더에서 이미 draft 를 채우지만, 타입 안전을 위해 record 로 폴백.
  const effectiveDraft = draft ?? {
    status: record.status,
    clockOut: record.clockOut,
    breakStart: record.breakStart,
    breakEnd: record.breakEnd,
  };

  // 휴게 표시: record.breakStart~breakEnd(있으면) 아니면 DEFAULT_BREAK_RANGE.
  const breakRangeLabel =
    record.breakStart && record.breakEnd
      ? `${record.breakStart}~${record.breakEnd}`
      : DEFAULT_BREAK_RANGE;

  return (
    <div>
      {schedule ? (
        <div className="px-5 pb-3">
          <ScheduleVsActual entry={schedule} record={record} />
        </div>
      ) : null}
      <div className="space-y-3 px-5">
        <Row
          label="출근"
          // 출근은 시간변경 대상 아님 — record 값 고정 표시. 상태변경은 즉시 PATCH(현행).
          value={record.clockIn ?? "-"}
          badge={
            record.status !== "정상" ? (
              <StatusBadge label={record.status} tone={statusTone(record.status)} />
            ) : undefined
          }
          action={
            <button
              type="button"
              onClick={() => setStatusSheetOpen(true)}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold"
            >
              상태변경
            </button>
          }
        />
        <Row
          label="퇴근"
          value={effectiveDraft.clockOut ?? "-"}
          action={
            <button
              type="button"
              onClick={() => setClockOutSheetOpen(true)}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold"
            >
              상태변경
            </button>
          }
        />
        <Row
          label="휴게"
          value={record.breakMinutes > 0 ? breakRangeLabel : "-"}
          action={
            <button
              type="button"
              onClick={() => setBreakSheetOpen(true)}
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
              status: effectiveDraft.status,
              // AC-8: clockIn 은 항상 record 값(불변).
              clockIn: record.clockIn,
              clockOut: effectiveDraft.clockOut,
              // 휴게 범위는 draft 에 있으면 담는다(없으면 키 부재 → 기존 휴게 유지).
              ...(effectiveDraft.breakStart && effectiveDraft.breakEnd
                ? {
                    breakStart: effectiveDraft.breakStart,
                    breakEnd: effectiveDraft.breakEnd,
                  }
                : {}),
            },
          });
        }}
      />

      <EditRequestList
        requests={requests.filter((r) => r.date === date)}
        canApprove={user.role === "master"}
        onApprove={async (id) => {
          if (await approve(id)) await reloadDay();
        }}
      />

      <StatusChangeSheet
        open={statusSheetOpen}
        current={record.status}
        onClose={() => setStatusSheetOpen(false)}
        onChange={changeStatus}
      />

      <ClockOutStatusSheet
        key={`clockout|${clockOutSheetOpen}|${effectiveDraft.clockOut ?? ""}|${effectiveDraft.status}`}
        open={clockOutSheetOpen}
        initial={{ status: effectiveDraft.status, clockOut: effectiveDraft.clockOut }}
        onClose={() => setClockOutSheetOpen(false)}
        onApply={(next) => {
          setDraft((d) => ({
            status: next.status,
            clockOut: next.clockOut,
            breakStart: d?.breakStart,
            breakEnd: d?.breakEnd,
          }));
          setClockOutSheetOpen(false);
        }}
      />

      <BreakChangeSheet
        key={`break|${breakSheetOpen}|${effectiveDraft.breakStart ?? ""}|${effectiveDraft.breakEnd ?? ""}`}
        open={breakSheetOpen}
        initial={{
          breakStart: effectiveDraft.breakStart ?? DEFAULT_BREAK_START,
          breakEnd: effectiveDraft.breakEnd ?? DEFAULT_BREAK_END,
        }}
        onClose={() => setBreakSheetOpen(false)}
        onApply={(next) => {
          setDraft((d) => ({
            status: d?.status ?? record.status,
            clockOut: d?.clockOut ?? record.clockOut,
            breakStart: next.breakStart,
            breakEnd: next.breakEnd,
          }));
          setBreakSheetOpen(false);
        }}
      />
    </div>
  );
}
