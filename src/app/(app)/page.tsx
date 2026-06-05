// 홈 RSC 셸(AC-11): 공통 헤더(layout) 하위 — 근무 진행·공지/바로가기.
// 마스터는 본인 출퇴근 기록이 없어(E-4) 홈이 무의미 → client gate 에서 대시보드(/master)로 보낸다.
import Link from "next/link";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { HomeToday } from "@/features/attendance/components/HomeToday";
import { HomeRoleRedirect } from "@/features/auth/components/HomeRoleRedirect";

export default function HomePage() {
  return (
    <div>
      <HomeRoleRedirect />
      <div className="space-y-7 px-5">
        <HomeToday />

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

        <section>
          <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground">
            확인해 주세요!
          </h2>
          <Link href="/pay">
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-coral-soft text-coral"
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

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              매장공지
            </h2>
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
