"use client";

// 상세뷰 날짜 이동 행(S2). 공통 헤더(layout)가 뒤로가기/타이틀 제공 →
// 여기선 날짜 라벨 + 이전/다음 일자 이동만(‹ 날짜 ›). 라우팅만 담당.
import { useRouter } from "next/navigation";
import { formatLongDate, shiftDay } from "@/lib/date";

export function AttendanceDetailNav({ date }: { date: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center gap-4 px-5 pb-2 pt-3">
      <button
        type="button"
        aria-label="이전 날"
        onClick={() => router.push(`/attendance/${shiftDay(date, -1)}`)}
        className="grid h-8 w-8 place-items-center text-2xl leading-none text-muted"
      >
        ‹
      </button>
      <span className="text-base font-bold text-foreground">{formatLongDate(date)}</span>
      <button
        type="button"
        aria-label="다음 날"
        onClick={() => router.push(`/attendance/${shiftDay(date, 1)}`)}
        className="grid h-8 w-8 place-items-center text-2xl leading-none text-muted"
      >
        ›
      </button>
    </div>
  );
}
