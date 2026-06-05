// (app) 보호 그룹 레이아웃 — 진입 가드 + 앱 셸(헤더/메인/하단탭).
// 미로그인 → /login 은 client gate 에서 처리해 페이지 이동마다 서버 함수 왕복을 만들지 않는다.
import { BottomNav } from "@/components/BottomNav";
import { GlobalHeader } from "@/components/GlobalHeader";
import { AppAuthGate } from "@/features/auth/components/AppAuthGate";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppAuthGate>
      <div className="relative mx-auto flex min-h-dvh w-full flex-col bg-background">
        <GlobalHeader />
        <main className="flex-1 pb-24 pt-4">{children}</main>
        <BottomNav />
      </div>
    </AppAuthGate>
  );
}
