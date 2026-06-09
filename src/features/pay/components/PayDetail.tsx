"use client";

import { useRouter } from "next/navigation";
import { useDayPay } from "@/features/pay/hooks/usePay";
import { formatWon, durationLabel } from "@/features/pay/domain";

/** 산정 요약 1행(라벨 좌 / 값 우). total=일급 강조행. */
function SummaryRow({
  label,
  value,
  total,
}: {
  label: string;
  value: React.ReactNode;
  total?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className={`text-sm ${total ? "font-bold text-foreground" : "text-muted"}`}>
        {label}
      </span>
      <span className={total ? "text-lg font-extrabold text-coral" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}

// 급여 일별 상세(AC-18): 금액 히어로 → 출퇴근 타임라인 → 산정 요약.
export function PayDetail({ date }: { date: string }) {
  const { detail, loading } = useDayPay(date);
  const router = useRouter();

  if (loading) {
    return <p className="px-5 py-10 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (!detail) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted">
        해당 날짜의 급여 데이터가 없습니다.
      </p>
    );
  }

  // 출퇴근 기록이 있어야 타임라인 표기(휴가/결근 등 무근무일은 안내문으로 대체).
  const hasTimes = Boolean(detail.clockIn || detail.clockOut);

  return (
    <div className="flex min-h-[70dvh] flex-col px-5">
      {/* 금액 히어로 — 이 페이지의 주인공(일급) */}
      <div className="pt-3 text-center">
        <p className="text-4xl font-extrabold text-coral">{formatWon(detail.amount)}</p>
        <p className="mt-1.5 text-sm text-muted">
          시급{" "}
          <span className="font-semibold text-statusgreen">
            {formatWon(detail.hourlyWage)}
          </span>{" "}
          · {durationLabel(detail.paidMinutes)}
        </p>
      </div>

      {/* 출퇴근 타임라인(가운데 휴게 표기) */}
      {hasTimes ? (
        <div className="mt-7">
          <div className="flex items-center px-1">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral" />
            <span className="relative flex-1 border-t-2 border-dashed border-border">
              {detail.breakMinutes > 0 ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                  휴게 {detail.breakMinutes}분
                </span>
              ) : null}
            </span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral" />
          </div>
          <div className="mt-2 flex items-start justify-between">
            <div className="text-left">
              <p className="text-lg font-bold">{detail.clockIn ?? "-"}</p>
              <p className="text-xs text-muted">출근</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{detail.clockOut ?? "-"}</p>
              <p className="text-xs text-muted">퇴근</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-7 rounded-xl border border-border bg-surface py-4 text-center text-sm text-muted">
          출퇴근 기록이 없는 날입니다
        </p>
      )}

      {/* 산정 요약 */}
      <div className="mt-7 divide-y divide-foreground/5 rounded-2xl border border-border bg-surface px-4">
        <SummaryRow label="급여인정시간" value={durationLabel(detail.paidMinutes)} />
        <SummaryRow
          label="연장근무"
          value={detail.overtimeMinutes > 0 ? durationLabel(detail.overtimeMinutes) : "0분"}
        />
        <SummaryRow
          label="급여차감"
          value={detail.deductMinutes > 0 ? durationLabel(detail.deductMinutes) : "0분"}
        />
        <SummaryRow label="일급" value={formatWon(detail.amount)} total />
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full rounded-xl bg-coral py-3.5 font-bold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
