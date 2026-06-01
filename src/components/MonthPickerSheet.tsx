"use client";

// 월 선택 시트(공용 — 출퇴근 캘린더/급여 공유). BottomSheet 셸 재사용 + 범위 목록.
// 범위(입사월~현재월)는 호출자가 joinMonth/currentMonth 로 주입 → 도메인 비종속 presentational.
import { BottomSheet } from "@/components/BottomSheet";
import { formatMonthLabel, monthsBetween } from "@/lib/date";

interface MonthPickerSheetProps {
  open: boolean;
  current: string; // "YYYY-MM" 현재 선택월(강조)
  joinMonth: string; // "YYYY-MM" 입사월(범위 하한)
  currentMonth: string; // "YYYY-MM" 현재월(범위 상한)
  onSelect: (month: string) => void; // 선택 시 "YYYY-MM"
  onClose: () => void;
}

export function MonthPickerSheet({
  open,
  current,
  joinMonth,
  currentMonth,
  onSelect,
  onClose,
}: MonthPickerSheetProps) {
  const months = monthsBetween(joinMonth, currentMonth);

  return (
    <BottomSheet open={open} onClose={onClose} title="월 선택">
      <ul className="space-y-1">
        {months.map((m) => {
          const selected = m === current;
          return (
            <li key={m}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(m)}
                className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold ${
                  selected ? "bg-coral text-white" : "text-foreground"
                }`}
              >
                {formatMonthLabel(m)}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
