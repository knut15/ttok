// (app) 보호 그룹 레이아웃 — 진입 가드 + 앱 셸(헤더/메인/하단탭).
// requireMembership: 미로그인 → /login, 멤버십 없음 → /onboarding (서버 가드가 진실원).
import { BottomNav } from "@/components/BottomNav";
import { GlobalHeader } from "@/components/GlobalHeader";
import { requireMembership } from "@/lib/guard";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireMembership();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
