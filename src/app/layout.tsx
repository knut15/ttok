import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProviderClient } from "@/features/auth/components/SessionProviderClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background">
        <SessionProviderClient>{children}</SessionProviderClient>
      </body>
    </html>
  );
}
