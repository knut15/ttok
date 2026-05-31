"use client";

// '2026년 5월 ▾' 월 선택(presentational + 클릭 콜백). 데모 범위는 5월 고정 표기.
export function MonthSelector({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-2xl font-extrabold text-foreground"
    >
      {label}
      <span className="text-base text-muted">▾</span>
    </button>
  );
}
