// 급여 요약카드(AC-17, presentational): 합계/차감시간/연장 회수·시간.
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatWon, durationLabel } from "@/features/pay/domain";
import type { PaySummary } from "@/types";

export function PaySummaryCard({
  summary,
  rangeLabel,
}: {
  summary: PaySummary;
  rangeLabel: string;
}) {
  return (
    <Card className="bg-coral-soft/40">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">5월 급여</span>{" "}
            {rangeLabel}
          </p>
          <p className="mt-1 text-2xl font-extrabold">
            {formatWon(summary.totalPay)}
          </p>
        </div>
        <span aria-hidden className="text-3xl">
          🏪
        </span>
      </div>

      <div className="mt-4 space-y-2 border-t border-black/5 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">급여 차감시간</span>
          <span className="font-semibold">{summary.deductMinutes}분 ›</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">연장 근무</span>
          <span className="flex items-center gap-2 font-semibold">
            <StatusBadge label={`${summary.overtimeCount}회`} tone="neutral" />
            {durationLabel(summary.overtimeMinutes)}
          </span>
        </div>
      </div>
    </Card>
  );
}
