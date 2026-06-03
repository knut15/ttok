"use client";

import Link from "next/link";
import { useMonthPay } from "@/features/pay/hooks/usePay";
import {
  formatWon,
  overtimeLabel,
  isVacationItem,
} from "@/features/pay/domain";
import { formatPayRowDate, shortMonthLabel, payPeriodLabel } from "@/lib/date";
import { PaySummaryCard } from "./PaySummaryCard";
import { StabilityRadar } from "./StabilityRadar";

// 급여 메인 리스트(AC-17): 요약카드 + 일별 행(휴가0원/연장표기/주휴 블루행).
export function PayList({ month }: { month: string }) {
  const { data, loading } = useMonthPay(month);

  if (loading) {
    return <p className="px-5 py-10 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (!data || data.items.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted">
        해당 월 급여 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="px-5">
      <PaySummaryCard
        summary={data.summary}
        stats={data.stats}
        monthLabel={shortMonthLabel(month)}
        rangeLabel={payPeriodLabel(month)}
      />

      <div className="mt-3">
        <StabilityRadar axes={data.stats.stability} />
      </div>

      <ul className="mt-2 divide-y divide-black/5">
        {data.items.map((item, i) => {
          const ot = overtimeLabel(item.overtimeMinutes);
          const row = (
            <div className="flex items-center justify-between py-4">
              <div>
                <p
                  className={`font-bold ${item.isWeeklyHoliday ? "text-foreground" : ""}`}
                >
                  {formatPayRowDate(item.date)}
                </p>
                <p
                  className={`text-sm ${item.isWeeklyHoliday ? "text-statusblue" : "text-muted"}`}
                >
                  {item.label}
                </p>
                {ot && <p className="text-sm text-statusblue">{ot}</p>}
              </div>
              <span
                className={`text-lg font-bold ${
                  item.isWeeklyHoliday
                    ? "text-statusblue"
                    : isVacationItem(item)
                      ? "text-muted"
                      : "text-foreground"
                }`}
              >
                {formatWon(item.amount)}
                {!item.isWeeklyHoliday && !isVacationItem(item) ? " ›" : ""}
              </span>
            </div>
          );

          return (
            <li key={`${item.date}-${item.kind}-${i}`}>
              {item.kind === "work" ? (
                <Link href={`/pay/${item.date}`} className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
