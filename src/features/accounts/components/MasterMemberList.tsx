"use client";

// 마스터 마이페이지 — 초대로 합류한 멤버 목록 + 매니저 지정/해제.
// /api/master/crews(Prisma 멤버십 기반) 재사용. 매니저 토글은 PATCH 후 재로드.
import { useCallback } from "react";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { useMasterSummary } from "@/features/accounts/hooks/useMasterSummary";
import { SEED_MONTH } from "@/lib/constants";

export function MasterMemberList() {
  const { user } = useCurrentUser();
  // 멤버 집합은 월과 무관(getStoreMembers) — 목록 용도로 기준월 사용.
  const { crews, loading, reload } = useMasterSummary(SEED_MONTH);

  const toggleManager = useCallback(
    async (crewId: string, on: boolean) => {
      const res = await fetch(`/api/master/crews/${crewId}/manager`, {
        method: "PATCH",
        cache: "no-store",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      if (res.ok) reload();
    },
    [user, reload],
  );

  if (user.role !== "master") return null;

  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold">멤버 ({crews.length})</h2>
      {loading ? (
        <p className="py-4 text-center text-sm text-muted">불러오는 중…</p>
      ) : crews.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-foreground/10 px-4 py-6 text-center text-sm text-muted">
          아직 합류한 멤버가 없습니다. 초대 코드를 공유하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {crews.map((c) => (
            <li
              key={c.crewId}
              className="flex items-center gap-3 rounded-3xl border border-foreground/5 bg-surface px-4 py-3"
            >
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-foreground/[0.06] font-bold">
                {c.avatarInitial}
                {c.isManager && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
                  >
                    M
                  </span>
                )}
              </span>
              <div className="flex-1">
                <p className="font-semibold">
                  {c.name}
                  {c.isManager && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      매니저
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleManager(c.crewId, !c.isManager)}
                aria-pressed={c.isManager}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  c.isManager ? "bg-amber-500 text-white" : "bg-foreground/[0.06] text-muted"
                }`}
              >
                {c.isManager ? "매니저 해제" : "매니저 지정"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
