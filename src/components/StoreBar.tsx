// 월 바(MonthBar) 위 매장 정보 헤더 — 풀블리드 각진 배너. 글로벌 헤더와 flush(-mt-4로 main pt-4 상쇄),
// 부드러운 그림자 + 넉넉한 하단 여백(mb-8)으로 아래 달력과 심플하게 분리. width 100%.
// 원형 매장 사진(+카메라 뱃지 플레이스홀더) + 매장명 + 영업시간 칩(그린 액센트) + 우측 컨트롤 슬롯.
// 사진 업로드는 추후(지금은 ☕ + warm 그라데이션 — overflow-hidden 이라 <img>로 교체 가능).
import { OPERATING_HOURS, STORE_NAME } from "@/lib/constants";

export function StoreBar({ right }: { right?: React.ReactNode }) {
  const hours = `${OPERATING_HOURS.weekday.open}–${OPERATING_HOURS.weekday.close}`;
  return (
    <div className="-mt-4 mb-8 bg-surface px-5 py-6 shadow-[0_8px_20px_-14px_rgba(28,24,20,0.18)]">
      <div className="flex items-center gap-3.5">
        {/* 매장 사진 슬롯(원형) + 카메라 뱃지 — 추후 업로드 연결(현재 플레이스홀더) */}
        <span aria-hidden className="relative shrink-0">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-coral-soft to-border text-2xl ring-1 ring-border">
            ☕
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-surface ring-2 ring-surface">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="7" width="18" height="13" rx="2.5" />
              <path d="M8.5 7l1.5-2.5h4L15.5 7" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted">근무 매장</p>
          <p className="truncate text-base font-bold leading-tight text-foreground">
            {STORE_NAME}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-greensoft px-2 py-0.5 text-[11px] font-semibold text-statusgreen">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            영업 {hours}
          </span>
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}
