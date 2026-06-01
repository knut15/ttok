"use client";

// 상세뷰 내비 client 래퍼(S2, AC-6~11). 라우팅만 담당 — 데이터/도메인 비접근.
// 뒤로(‹)=래퍼 상단 좌측 → /attendance (결정적 목적지, 딥링크 안전).
// 이전/다음 일자=AppHeader right 슬롯 → /attendance/<shiftDay(date,±1)> (무제한, Q3).
// 공용 AppHeader 시그니처 무변경(설계 §1.5): title/right 슬롯만 사용.
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { formatLongDate, shiftDay } from "@/lib/date";

export function AttendanceDetailNav({ date }: { date: string }) {
  const router = useRouter();

  return (
    <div>
      <div className="px-5 pt-4">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => router.push("/attendance")}
          className="grid h-8 w-8 place-items-center text-2xl leading-none text-muted"
        >
          ‹
        </button>
      </div>
      <AppHeader
        title={formatLongDate(date)}
        right={
          <span className="flex items-center gap-4">
            <button
              type="button"
              aria-label="이전 날"
              onClick={() => router.push(`/attendance/${shiftDay(date, -1)}`)}
              className="grid h-8 w-8 place-items-center text-2xl leading-none text-muted"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="다음 날"
              onClick={() => router.push(`/attendance/${shiftDay(date, 1)}`)}
              className="grid h-8 w-8 place-items-center text-2xl leading-none text-muted"
            >
              ›
            </button>
          </span>
        }
      />
    </div>
  );
}
