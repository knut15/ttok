"use client";

import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { REGULAR_MINUTES, STORE_NAME } from "@/lib/constants";
import {
  clockRangeLabel,
  longWorkLabel,
  shouldShowPercent,
} from "@/features/attendance/domain";
import { useTodayClock } from "@/features/attendance/hooks/useAttendance";

// 홈 출퇴근 상태 카드(T12 AC-1: 상태 전용).
//   T11 까지의 출근/퇴근/마감 버튼은 제거됨 — 출퇴근 등록은 /attendance 의 ClockFab 으로 일원화.
//   여기서는 record/phase 로 매장명·headline·진행바만 표시하고 clock PATCH(clockIn/clockOut)은 호출하지 않는다.
//   GET 구독(useTodayClock)은 유지 → 등록 후 홈 진입 시 최신 상태 반영(크루 스코프 authHeaders 계승).
export function ClockToggle({ date }: { date: string }) {
  const { record, phase } = useTodayClock(date);

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
          leftLabel={clockRangeLabel(record, phase)}
          rightLabel={shouldShowPercent(phase) ? `${percent}%` : ""}
        />
      </div>
    </Card>
  );
}
