"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useDayAttendance,
  useEditRequests,
} from "@/features/attendance/hooks/useAttendance";
import { statusTone } from "@/features/attendance/domain";
import { DEFAULT_BREAK_RANGE } from "@/lib/constants";
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
export function AttendanceDetail({ date }: { date: string }) {
  const { record, loading, changeStatus } = useDayAttendance(date);
  const { requests, submit } = useEditRequests();
  const [sheetOpen, setSheetOpen] = useState(false);

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
          value={record.clockIn ?? "-"}
          badge={
            record.status !== "정상" ? (
              <StatusBadge label={record.status} tone={statusTone(record.status)} />
            ) : undefined
          }
          action={changeBtn}
        />
        <Row label="퇴근" value={record.clockOut ?? "-"} action={changeBtn} />
        <Row
          label="휴게"
          value={record.breakMinutes > 0 ? DEFAULT_BREAK_RANGE : "-"}
          action={
            <button
              type="button"
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
              clockIn: record.clockIn,
              clockOut: record.clockOut,
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
    </div>
  );
}
