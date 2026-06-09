import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProviderClient } from "@/features/auth/components/SessionProviderClient";
import { auth } from "@/auth";
import type { Session } from "next-auth";

// Pretendard Variable(자체 호스팅) — 한글 친근감의 핵심(DESIGN.md §3). weight 축 45~920.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crewmon",
  description: "크루몬 — 출퇴근·급여 관리",
};

// RSC 루트 셸: html/body + 세션 컨텍스트. 헤더/하단탭은 (app) 그룹 레이아웃(가드 통과 후)에만.
// /login·/onboarding 은 (app) 밖이라 앱 셸 없이 단독 렌더.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 세션을 서버에서 읽어 클라에 주입 → 첫 렌더부터 status 확정(AppAuthGate "불러오는 중" 제거).
  // auth() 는 쿠키 복호화 실패(AUTH_SECRET 불일치/만료) 시 throw → 루트 레이아웃 전체가 깨지므로
  // 클라 useSession 과 동일하게 무세션으로 graceful 폴백(session-scope 패턴) → AppAuthGate 가 /login 유도.
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="bg-background">
        <SessionProviderClient session={session}>{children}</SessionProviderClient>
      </body>
    </html>
  );
}
