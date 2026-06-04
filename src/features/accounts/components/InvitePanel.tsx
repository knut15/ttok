"use client";

// 초대 패널(마스터 전용) — 코드 발급 + 복사/합류 링크/공유 + 발급 이력(상태·만료·회수).
import { useState } from "react";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useInvites } from "@/features/accounts/hooks/useInvites";
import { formatDotDate } from "@/lib/date";
import type { StoreInvite } from "@/types";

/** 표시용 상태: 대기 코드가 만료시각을 지났으면 "만료". */
function displayStatus(inv: StoreInvite): { label: string; tone: string } {
  if (inv.status === "사용") return { label: "사용됨", tone: "bg-black/[0.06] text-muted" };
  if (inv.status === "회수") return { label: "회수됨", tone: "bg-black/[0.06] text-muted" };
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())
    return { label: "만료", tone: "bg-black/[0.06] text-muted" };
  return { label: "대기", tone: "bg-coral/10 text-coral" };
}

export function InvitePanel() {
  const { user } = useCurrentUser();
  const { createdCode, invites, loading, createInvite, revoke } = useInvites();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

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
      /* 클립보드 차단 — 무시 */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Crewmon 매장 합류", text: `초대 코드: ${createdCode}`, url: joinLink });
      } catch {
        /* 취소/미지원 — 무시 */
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
        className="w-full rounded-3xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "발급 중…" : "초대 코드 생성"}
      </button>

      {createdCode && (
        <div className="mt-3 space-y-3 rounded-3xl border border-foreground/5 bg-surface p-4">
          <div className="text-center">
            <span className="block text-sm text-muted">새 초대 코드 (7일 후 만료)</span>
            <span className="block text-2xl font-bold tracking-widest text-coral">{createdCode}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copy(createdCode, "code")}
              className="flex-1 rounded-xl border border-foreground/10 px-3 py-2 text-sm font-semibold"
            >
              {copied === "code" ? "복사됨 ✓" : "코드 복사"}
            </button>
            <button
              type="button"
              onClick={() => void copy(joinLink, "link")}
              className="flex-1 rounded-xl border border-foreground/10 px-3 py-2 text-sm font-semibold"
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

      {/* 발급 이력 — 상태/만료/회수 */}
      {invites.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">발급 이력</h3>
          <ul className="space-y-2">
            {invites.map((inv) => {
              const st = displayStatus(inv);
              const active = st.label === "대기";
              return (
                <li
                  key={inv.code}
                  className="flex items-center gap-2 rounded-3xl border border-foreground/5 bg-surface px-4 py-2.5"
                >
                  <span className="font-bold tracking-widest">{inv.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}>
                    {st.label}
                  </span>
                  {inv.expiresAt && (
                    <span className="text-xs text-muted">
                      ~{formatDotDate(inv.expiresAt.slice(0, 10))}
                    </span>
                  )}
                  <span className="flex-1" />
                  {active && (
                    <button
                      type="button"
                      onClick={() => void revoke(inv.code)}
                      className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1 text-xs font-semibold text-muted"
                    >
                      회수
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
