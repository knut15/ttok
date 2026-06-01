"use client";

// 초대 패널(T8-6). 마스터=초대 생성 버튼+코드 표시 / 멤버=코드 입력+합류.
// role 별 분기. client 는 useInvites(route 경유)로만 store 접근.
import { useState } from "react";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useInvites } from "@/features/accounts/hooks/useInvites";

export function InvitePanel() {
  const { user } = useCurrentUser();
  const {
    createdCode,
    joinMessage,
    joinOk,
    loading,
    createInvite,
    joinByCode,
  } = useInvites();
  const [code, setCode] = useState("");

  if (user.role === "master") {
    return (
      <section className="px-5 pt-8">
        <h2 className="mb-3 text-lg font-bold">멤버 초대</h2>
        <button
          type="button"
          onClick={() => void createInvite()}
          disabled={loading}
          className="w-full rounded-2xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "발급 중…" : "초대 코드 생성"}
        </button>
        {createdCode && (
          <p className="mt-3 rounded-2xl border border-black/5 bg-surface px-4 py-3 text-center">
            <span className="block text-sm text-muted">초대 코드</span>
            <span className="block text-2xl font-bold tracking-widest text-coral">
              {createdCode}
            </span>
          </p>
        )}
      </section>
    );
  }

  // 멤버: 코드 입력 + 합류
  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold">매장 합류</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="초대 코드 입력"
          className="flex-1 rounded-2xl border border-black/10 bg-surface px-4 py-3 tracking-widest"
        />
        <button
          type="button"
          onClick={() => void joinByCode(code.trim())}
          disabled={loading || code.trim().length === 0}
          className="rounded-2xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          합류
        </button>
      </div>
      {joinMessage && (
        <p
          className={`mt-3 text-sm ${joinOk ? "text-coral" : "text-red-500"}`}
        >
          {joinMessage}
        </p>
      )}
    </section>
  );
}
