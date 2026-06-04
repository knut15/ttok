"use client";

import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { REGULAR_MINUTES, STORE_NAME } from "@/lib/constants";
import {
  clockRangeLabel,
  isSettledStatus,
  longWorkLabel,
  shouldShowPercent,
} from "@/features/attendance/domain";
import { useTodayClock } from "@/features/attendance/hooks/useAttendance";
import type { Tone } from "@/lib/constants";

// 홈 출퇴근 상태 카드(T12 AC-1: 상태 전용).
//   T11 까지의 출근/퇴근/마감 버튼은 제거됨 — 출퇴근 등록은 /attendance 의 ClockFab 으로 일원화.
//   여기서는 record/phase 로 매장명·headline·진행바만 표시하고 clock PATCH(clockIn/clockOut)은 호출하지 않는다.
//   GET 구독(useTodayClock)은 유지 → 등록 후 홈 진입 시 최신 상태 반영(멤버 스코프 authHeaders 계승).
export function ClockToggle({ date }: { date: string }) {
  const { record, phase } = useTodayClock(date);

  const workMinutes = record?.workMinutes ?? 0;
  const status = record?.status;
  // 결근/휴가 = 정산 종료. phase(시각 기반)보다 우선해 0% + 상태 표기로 일관 처리.
  const settled = isSettledStatus(status);
  const percent = settled
    ? 0
    : phase === "done"
      ? Math.min(100, Math.round((workMinutes / REGULAR_MINUTES) * 100))
      : phase === "working"
        ? 50
        : 0;
  const headline = settled
    ? status === "휴가"
      ? "오늘은 휴가예요"
      : "오늘은 결근 처리됐어요"
    : phase === "done"
      ? `${longWorkLabel(workMinutes)} 근무했어요!`
      : phase === "working"
        ? "근무 중이에요!"
        : "오늘도 화이팅!";

  // 상태 pill — 빈 진행 상태에서도 오늘 근무의 단계를 한눈에. 결근/휴가는 상태 그대로.
  const pill: { label: string; tone: Tone } = settled
    ? { label: status as string, tone: status === "휴가" ? "blue" : "gray" }
    : phase === "done"
      ? { label: "완료", tone: "coral" }
      : phase === "working"
        ? { label: "근무 중", tone: "green" }
        : { label: "예정", tone: "neutral" };
  // 결근/휴가 0분, 예정 단계엔 정규 근무시간(예정), 그 외엔 실제 근무시간.
  const durationLabel = settled
    ? longWorkLabel(0)
    : phase === "before"
      ? longWorkLabel(REGULAR_MINUTES)
      : longWorkLabel(workMinutes);
  const progressLabel = settled
    ? (status as string)
    : phase === "done"
      ? "근무 완료"
      : phase === "working"
        ? "근무 중"
        : "근무 시작 전";

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <span aria-hidden>🏪</span>
          <span className="truncate">{STORE_NAME}</span>
        </div>
        <StatusBadge label={pill.label} tone={pill.tone} className="shrink-0" />
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {headline}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
        <span className="font-medium text-muted">오늘 근무</span>
        <span className="font-semibold tabular-nums text-foreground">
          {settled ? "—" : clockRangeLabel(record, phase)}
          <span className="ml-2 font-medium text-muted">{durationLabel}</span>
        </span>
      </div>

      <div className="mt-4">
        <ProgressBar
          percent={percent}
          leftLabel={progressLabel}
          rightLabel={!settled && shouldShowPercent(phase) ? `${percent}%` : ""}
        />
      </div>
    </Card>
  );
}
