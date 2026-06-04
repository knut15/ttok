// 급여 요약카드: 총급여 + 시급 + 월 근무일/근무시간/휴게/주휴 + 근태.
import { Card } from "@/components/Card";
import { formatWon, durationLabel } from "@/features/pay/domain";
import type { PayMonthStats, PaySummary } from "@/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

function Chip({ label, count, tone }: { label: string; count: number; tone: string }) {
  if (count <= 0) return null;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label} {count}
    </span>
  );
}

export function PaySummaryCard({
  summary,
  stats,
  monthLabel,
  rangeLabel,
}: {
  summary: PaySummary;
  stats: PayMonthStats;
  monthLabel: string;
  rangeLabel: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">{monthLabel} 급여</span> {rangeLabel}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{formatWon(summary.totalPay)}</p>
          <p className="mt-0.5 text-xs text-muted">
            시급 {formatWon(stats.hourlyWage)} · 근무 {formatWon(stats.basePay)} + 주휴 {formatWon(stats.weeklyHolidayPay)}
          </p>
        </div>
        <span aria-hidden className="text-3xl">🏪</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="근무일" value={`${stats.workDays}일`} />
        <Stat label="근무시간" value={durationLabel(stats.workMinutes)} />
        <Stat label="휴게시간" value={durationLabel(stats.breakMinutes)} />
        <Stat label="주휴수당" value={formatWon(stats.weeklyHolidayPay)} />
        <Stat
          label="연장"
          value={stats.overtimeCount > 0 ? `${stats.overtimeCount}회 ${durationLabel(stats.overtimeMinutes)}` : "없음"}
        />
        <Stat label="휴가" value={`${stats.vacationDays}일`} />
      </div>

      {(stats.lateCount > 0 || stats.earlyLeaveCount > 0 || stats.absentCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-foreground/5 pt-3">
          <span className="text-xs text-muted">근태</span>
          <Chip label="지각" count={stats.lateCount} tone="bg-coral/10 text-coral" />
          <Chip label="조퇴" count={stats.earlyLeaveCount} tone="bg-amber-100 text-amber-700" />
          <Chip label="결근" count={stats.absentCount} tone="bg-foreground/[0.06] text-muted" />
        </div>
      )}
    </Card>
  );
}
