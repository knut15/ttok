"use client";

// 월 선택 시트(S3, AC-12~15). BottomSheet 셸 재사용 + 입사월~현재월 목록(Q1).
// 범위 계산이 입사월 의미를 가지므로 attendance 도메인 종속(설계 §1.2). 선택 콜백만 담당.
import { BottomSheet } from "@/components/BottomSheet";
import { formatMonthLabel, monthsBetween } from "@/lib/date";

interface MonthPickerSheetProps {
  open: boolean;
  current: string; // "YYYY-MM" 현재 선택월(강조)
  joinMonth: string; // "YYYY-MM" 입사월
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
