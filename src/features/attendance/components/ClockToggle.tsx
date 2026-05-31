"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { REGULAR_MINUTES, REGULAR_RANGE, STORE_NAME } from "@/lib/constants";
import { nowHHMM } from "@/lib/date";
import { longWorkLabel } from "@/features/attendance/domain";
import type { AttendanceRecord } from "@/types";

type Phase = "before" | "working" | "done";

// 홈 출퇴근 토글(AC-11, AC-12, 쟁점 C: new Date() 기록).
export function ClockToggle({ date }: { date: string }) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance/${date}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setRecord(json);
      });
    return () => {
      active = false;
    };
  }, [date]);

  const phase: Phase = !record?.clockIn
    ? "before"
    : !record?.clockOut
      ? "working"
      : "done";

  async function clock(field: "clockIn" | "clockOut") {
    setBusy(true);
    const res = await fetch(`/api/attendance?date=${date}`, {
      method: "PATCH",
      body: JSON.stringify({ field, time: nowHHMM() }),
    });
    if (res.ok) setRecord(await res.json());
    setBusy(false);
  }

  const workMinutes = record?.workMinutes ?? 0;
  const percent =
    phase === "done"
      ? Math.min(100, Math.round((workMinutes / REGULAR_MINUTES) * 100))
      : phase === "working"
        ? 50
        : 0;
  const headline =
    phase === "done"
      ? `${longWorkLabel(workMinutes)} 근무했어요!`
      : phase === "working"
        ? "근무 중이에요!"
        : "오늘도 화이팅!";

  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden>🏪</span>
        <span className="truncate">{STORE_NAME}</span>
      </div>

      <p className="mt-3 text-lg font-bold text-foreground">{headline}</p>

      <div className="mt-3">
        <ProgressBar
          percent={percent}
          leftLabel={REGULAR_RANGE.replace("~", "-")}
          rightLabel={`${percent}%`}
        />
      </div>

      <div className="mt-4">
        {phase === "before" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => clock("clockIn")}
            className="w-full rounded-xl bg-coral py-3 font-bold text-white disabled:opacity-60"
          >
            출근
          </button>
        )}
        {phase === "working" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => clock("clockOut")}
            className="w-full rounded-xl bg-coral py-3 font-bold text-white disabled:opacity-60"
          >
            퇴근
          </button>
        )}
        {phase === "done" && (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-black/5 py-3 font-bold text-muted"
          >
            오늘 근무 마감
          </button>
        )}
      </div>
    </Card>
  );
}
