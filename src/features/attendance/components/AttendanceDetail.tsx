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
import type { ClockInStatus, ClockOutStatus, WorkStatus } from "@/types";
import { StatusChangeSheet } from "./StatusChangeSheet";
import { BreakChangeSheet } from "./BreakChangeSheet";
import { ClockOutTimeSheet } from "./ClockOutTimeSheet";
import { AddRecordForm } from "./AddRecordForm";
import { EditRequestForm } from "./EditRequestForm";
import { EditRequestList } from "./EditRequestList";
import { useDaySchedule } from "@/features/schedule/hooks/useDaySchedule";
import { ScheduleVsActual } from "@/features/schedule/components/ScheduleVsActual";

const [DEFAULT_BREAK_START, DEFAULT_BREAK_END] = DEFAULT_BREAK_RANGE.split("~");
const CLOCK_IN_OPTIONS: readonly string[] = ["정상", "지각", "결근", "휴가"];
const CLOCK_OUT_OPTIONS: readonly string[] = ["정상", "연장", "조퇴"];

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
    <div className="flex items-center justify-between rounded-3xl bg-foreground/[0.03] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-lg font-bold">{value}</span>
        {badge}
      </div>
      {action}
    </div>
  );
}

// 근무기록 상세: 출근/퇴근 상태를 각각 독립 즉시 변경(출근=정상/지각/결근/휴가, 퇴근=정상/연장).
// 휴게(범위) 정정은 수정요청으로.
export function AttendanceDetail({ date }: { date: string }) {
  const { record, loading, changeClockInStatus, changeClockOutStatus, reload: reloadDay } =
    useDayAttendance(date);
  const { requests, submit, approve } = useEditRequests();
  const { user } = useCurrentUser();
  const schedule = useDaySchedule(date);
  const [inSheetOpen, setInSheetOpen] = useState(false);
  const [outSheetOpen, setOutSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [breakSheetOpen, setBreakSheetOpen] = useState(false);
  // 퇴근시각·휴게 범위 draft(수정요청용 — 상태변경은 즉시이지만 시간 정정은 요청).
  const [draft, setDraft] = useState<{
    clockOut: string | null;
    breakStart?: string;
    breakEnd?: string;
  } | null>(null);
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const recordKey = record
    ? `${record.date}|${record.clockOut ?? ""}|${record.breakStart ?? ""}|${record.breakEnd ?? ""}`
    : null;
  if (record && recordKey !== syncKey) {
    setDraft({
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
            await submit({ date, reason, after: { status, clockIn, clockOut } });
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

  const clockInStatus = record.clockInStatus ?? "정상";
  const clockOutStatus = record.clockOutStatus ?? "정상";
  const draftClockOut = draft ? draft.clockOut : record.clockOut;
  const breakStart = draft?.breakStart;
  const breakEnd = draft?.breakEnd;

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
          value={record.clockIn ?? "-"}
          badge={
            clockInStatus !== "정상" ? (
              <StatusBadge label={clockInStatus} tone={statusTone(clockInStatus as WorkStatus)} />
            ) : undefined
          }
          action={
            <button
              type="button"
              onClick={() => setInSheetOpen(true)}
              className="rounded-lg border border-foreground/10 px-3 py-1.5 text-sm font-semibold"
            >
              상태변경
            </button>
          }
        />
        <Row
          label="퇴근"
          value={draftClockOut ?? "-"}
          badge={
            clockOutStatus !== "정상" ? (
              <StatusBadge label={clockOutStatus} tone={statusTone(clockOutStatus as WorkStatus)} />
            ) : undefined
          }
          action={
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setOutSheetOpen(true)}
                className="rounded-lg border border-foreground/10 px-3 py-1.5 text-sm font-semibold"
              >
                상태변경
              </button>
              <button
                type="button"
                onClick={() => setTimeSheetOpen(true)}
                className="rounded-lg border border-foreground/10 px-3 py-1.5 text-sm font-semibold"
              >
                시각변경
              </button>
            </div>
          }
        />
        <Row
          label="휴게"
          value={record.breakMinutes > 0 ? breakRangeLabel : "-"}
          action={
            <button
              type="button"
              onClick={() => setBreakSheetOpen(true)}
              className="rounded-lg border border-foreground/10 px-3 py-1.5 text-sm font-semibold"
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
              clockIn: record.clockIn,
              clockOut: draftClockOut,
              ...(breakStart && breakEnd ? { breakStart, breakEnd } : {}),
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
        open={inSheetOpen}
        current={clockInStatus}
        options={CLOCK_IN_OPTIONS}
        title="출근 상태 변경"
        onClose={() => setInSheetOpen(false)}
        onChange={(s) => changeClockInStatus(s as ClockInStatus)}
      />

      <StatusChangeSheet
        open={outSheetOpen}
        current={clockOutStatus}
        options={CLOCK_OUT_OPTIONS}
        title="퇴근 상태 변경"
        onClose={() => setOutSheetOpen(false)}
        onChange={(s) => changeClockOutStatus(s as ClockOutStatus)}
      />

      <ClockOutTimeSheet
        key={`time|${timeSheetOpen}|${draftClockOut ?? ""}`}
        open={timeSheetOpen}
        initial={draftClockOut}
        onClose={() => setTimeSheetOpen(false)}
        onApply={(clockOut) => {
          setDraft((d) => ({ clockOut, breakStart: d?.breakStart, breakEnd: d?.breakEnd }));
          setTimeSheetOpen(false);
        }}
      />

      <BreakChangeSheet
        key={`break|${breakSheetOpen}|${breakStart ?? ""}|${breakEnd ?? ""}`}
        open={breakSheetOpen}
        initial={{
          breakStart: breakStart ?? DEFAULT_BREAK_START,
          breakEnd: breakEnd ?? DEFAULT_BREAK_END,
        }}
        onClose={() => setBreakSheetOpen(false)}
        onApply={(next) => {
          setDraft((d) => ({
            clockOut: d ? d.clockOut : record.clockOut,
            breakStart: next.breakStart,
            breakEnd: next.breakEnd,
          }));
          setBreakSheetOpen(false);
        }}
      />
    </div>
  );
}
