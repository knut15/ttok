// 홈 RSC 셸(AC-11): 공통 헤더(layout) 하위 — 근무 진행·공지/바로가기.
// 마스터는 본인 출퇴근 기록이 없어(E-4) 홈이 무의미 → 메인은 대시보드(/master). 서버에서 리다이렉트(클라 플래시 0).
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { HomeToday } from "@/features/attendance/components/HomeToday";
import { auth } from "@/auth";

export default async function HomePage() {
  // 멤버십 존재/온보딩 가드는 (app)/layout 의 requireMembership 이 이미 수행.
  // 여기선 role 만 필요 → auth()(캐시된 JWT 클레임, TTL 내 DB 0)로 마스터만 대시보드로 리다이렉트.
  // perf: 홈마다 중복 requireMembership(DB 조회) 제거(rank 10).
  const session = await auth();
  if (session?.role === "master") redirect("/master");

  return (
    <div>
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
