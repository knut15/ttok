"use client";

import { useRouter } from "next/navigation";

// 뒤로가기 버튼 (프로필 수정 헤더). router.back() — 직접 진입 시 /mypage fallback.
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="뒤로가기"
      onClick={() => router.back()}
      className="text-2xl text-foreground"
    >
      ‹
    </button>
  );
}
