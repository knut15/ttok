"use client";

// 초대 패널 — 마스터 전용(멤버 합류는 온보딩에서). 코드 생성 + 복사 + 합류 링크 공유.
import { useState } from "react";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useInvites } from "@/features/accounts/hooks/useInvites";

export function InvitePanel() {
  const { user } = useCurrentUser();
  const { createdCode, loading, createInvite } = useInvites();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  // 멤버 합류는 /onboarding 에서 처리 → 패널은 마스터만 노출.
  if (user.role !== "master") return null;

  const joinLink =
    createdCode && typeof window !== "undefined"
      ? `${window.location.origin}/login?invite=${createdCode}`
      : "";

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // 클립보드 차단 환경 — 무시(사용자가 직접 선택 복사).
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Crewmon 매장 합류",
          text: `초대 코드: ${createdCode}`,
          url: joinLink,
        });
      } catch {
        // 공유 취소/미지원 — 무시.
      }
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold">멤버 초대</h2>
      <button
        type="button"
        onClick={() => void createInvite()}
        disabled={loading}
        className="w-full rounded-2xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "발급 중…" : createdCode ? "새 초대 코드 생성" : "초대 코드 생성"}
      </button>

      {createdCode && (
        <div className="mt-3 space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
          <div className="text-center">
            <span className="block text-sm text-muted">초대 코드</span>
            <span className="block text-2xl font-bold tracking-widest text-coral">
              {createdCode}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copy(createdCode, "code")}
              className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
            >
              {copied === "code" ? "복사됨 ✓" : "코드 복사"}
            </button>
            <button
              type="button"
              onClick={() => void copy(joinLink, "link")}
              className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
            >
              {copied === "link" ? "복사됨 ✓" : "합류 링크 복사"}
            </button>
          </div>

          {canShare && (
            <button
              type="button"
              onClick={() => void share()}
              className="w-full rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral"
            >
              공유하기
            </button>
          )}

          <p className="break-all text-center text-xs text-muted">{joinLink}</p>
        </div>
      )}
    </section>
  );
}
