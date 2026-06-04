import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProviderClient } from "@/features/auth/components/SessionProviderClient";

// Pretendard Variable(자체 호스팅) — 한글 친근감의 핵심(DESIGN.md §3). weight 축 45~920.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crewmon",
  description: "크루몬 — 출퇴근·급여 관리",
};

// RSC 루트 셸: html/body + 세션 컨텍스트. 헤더/하단탭은 (app) 그룹 레이아웃(가드 통과 후)에만.
// /login·/onboarding 은 (app) 밖이라 앱 셸 없이 단독 렌더.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${geistMono.variable}`}>
      <body className="bg-background">
        <SessionProviderClient>{children}</SessionProviderClient>
      </body>
    </html>
  );
}
