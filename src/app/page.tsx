// 홈 RSC 셸(AC-11): 브랜드 헤더·날짜·매장명·근무 진행·토글(client)·공지/바로가기.
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { ClockToggle } from "@/features/attendance/components/ClockToggle";
import { formatDotDate } from "@/lib/date";

const TODAY = "2026-05-29"; // 데모 기준일(시드 월). AC-11 헤더 날짜.

export default function HomePage() {
  return (
    <div>
      <AppHeader
        brand
        right={
          <span aria-hidden className="text-xl text-muted">
            🔔
          </span>
        }
      />

      <div className="space-y-3 px-5 pt-1">
        <Link
          href="/attendance"
          className="flex items-center justify-between text-base font-bold text-foreground"
        >
          <span>{formatDotDate(TODAY)}</span>
          <span className="text-muted">›</span>
        </Link>

        <ClockToggle date={TODAY} />

        <Link href="#" className="block">
          <Card className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-coral" aria-hidden>
                ◆
              </span>
              크루몬 서비스 종료 안내
            </span>
            <span className="text-muted">›</span>
          </Card>
        </Link>

        <section className="pt-1">
          <h2 className="mb-2 text-base font-bold text-foreground">
            확인해 주세요!
          </h2>
          <Link href="/pay">
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-lg bg-coral-soft text-coral"
                >
                  ₩
                </span>
                <div>
                  <p className="text-sm font-semibold">이번 달 출퇴근 기록</p>
                  <p className="text-xs text-muted">
                    곧 발급될 급여명세서와 비교해 보세요!
                  </p>
                </div>
              </div>
              <span className="text-muted">›</span>
            </Card>
          </Link>
        </section>

        <section className="pt-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">매장공지</h2>
            <span className="text-muted">›</span>
          </div>
          <Card className="flex items-center gap-2">
            <span className="text-sm font-semibold">오늘 할 일</span>
            <StatusBadge label="공지" tone="green" />
          </Card>
        </section>
      </div>
    </div>
  );
}
