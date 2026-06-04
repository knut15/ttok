"use client";

import { useRouter } from "next/navigation";
import { useDayPay } from "@/features/pay/hooks/usePay";
import { formatWon, durationLabel } from "@/features/pay/domain";
import { REGULAR_RANGE } from "@/lib/constants";

function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="text-right">
        <p className="font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

// 급여 일별 상세(AC-18): 출/퇴근·시급·급여인정시간·휴게·차감·연장 + 확인.
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

  return (
    <div className="flex min-h-[70dvh] flex-col px-5">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 text-center">
        <div>
          <p className="text-sm text-muted">출근</p>
          <p className="mt-1 text-xl font-bold">{detail.clockIn ?? "-"}</p>
        </div>
        <div>
          <p className="text-sm text-muted">퇴근</p>
          <p className="mt-1 text-xl font-bold">{detail.clockOut ?? "-"}</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-foreground/5">
        <DetailRow
          label="기준 급여"
          value={<span className="text-statusgreen">시급 {formatWon(detail.hourlyWage)}</span>}
        />
        <DetailRow
          label="급여인정시간"
          value={durationLabel(detail.paidMinutes)}
          sub={`(${REGULAR_RANGE.replace("~", " ~ ")})`}
        />
        <DetailRow
          label="휴게시간"
          value={`${detail.breakMinutes}분`}
          sub={detail.breakRange ? `(${detail.breakRange.replace("~", " ~ ")})` : undefined}
        />
        <DetailRow label="급여차감시간" value={`${detail.deductMinutes}분`} />
        <DetailRow
          label="연장근무시간"
          value={detail.overtimeMinutes > 0 ? durationLabel(detail.overtimeMinutes) : "0분"}
        />
        <DetailRow
          label="일급"
          value={<span className="text-coral">{formatWon(detail.amount)}</span>}
        />
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
