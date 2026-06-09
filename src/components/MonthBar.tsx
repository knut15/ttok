"use client";

// 월 이동 바(공통 헤더 하위 본문 행). ‹ 라벨 › + 선택 시 picker(onPick) 옵션.
import { MonthSelector } from "@/components/MonthSelector";
import { formatMonthLabel, shiftMonth } from "@/lib/date";

export function MonthBar({
  month,
  onChange,
  onPick,
}: {
  month: string;
  onChange: (month: string) => void;
  onPick?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-5 pb-8 pt-3">
      <button
        type="button"
        aria-label="이전 달"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="grid h-8 w-8 place-items-center leading-none text-muted"
      >
        ‹
      </button>
      <MonthSelector label={formatMonthLabel(month)} onClick={onPick} />
      <button
        type="button"
        aria-label="다음 달"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="grid h-8 w-8 place-items-center leading-none text-muted"
      >
        ›
      </button>
    </div>
  );
}
