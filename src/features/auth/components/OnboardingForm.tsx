"use client";

// 온보딩 — 신규 로그인 사용자가 매장을 만들거나(마스터) 초대코드로 합류(멤버).
import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "create" | "join";

export function OnboardingForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  // 합류 링크로 온 경우(initialCode) join 탭 + 코드 자동입력.
  const [tab, setTab] = useState<Tab>(initialCode ? "join" : "create");
  const [storeName, setStoreName] = useState("");
  const [bizNumber, setBizNumber] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(url: string, payload: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "처리에 실패했습니다.");
        return;
      }
      // 멤버십 생성 완료 → 홈으로(세션 갱신 위해 새로고침).
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">시작하기</h1>
      <p className="mb-6 text-sm text-muted">매장을 만들거나 초대받은 매장에 합류하세요.</p>

      <div className="mb-5 flex rounded-3xl bg-foreground/[0.04] p-1">
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === "create" ? "bg-surface shadow-sm" : "text-muted"}`}
        >
          매장 만들기
        </button>
        <button
          type="button"
          onClick={() => setTab("join")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === "join" ? "bg-surface shadow-sm" : "text-muted"}`}
        >
          초대코드로 합류
        </button>
      </div>

      {tab === "create" ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            매장명
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="예) 매머드커피 마석점"
              className="mt-1 w-full rounded-3xl border border-foreground/10 bg-surface px-4 py-3"
            />
          </label>
          <label className="block text-sm font-medium">
            사업자등록번호
            <input
              value={bizNumber}
              onChange={(e) => setBizNumber(e.target.value)}
              placeholder="000-00-00000"
              className="mt-1 w-full rounded-3xl border border-foreground/10 bg-surface px-4 py-3 tracking-wider"
            />
          </label>
          <button
            type="button"
            disabled={busy || !storeName.trim() || !bizNumber.trim()}
            onClick={() => submit("/api/onboarding/store", { storeName, bizNumber })}
            className="w-full rounded-3xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "생성 중…" : "매장 만들고 시작하기"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            초대 코드
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="초대 코드 입력"
              className="mt-1 w-full rounded-3xl border border-foreground/10 bg-surface px-4 py-3 tracking-widest"
            />
          </label>
          <button
            type="button"
            disabled={busy || code.trim().length === 0}
            onClick={() => submit("/api/onboarding/join", { code })}
            className="w-full rounded-3xl bg-coral px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "합류 중…" : "합류하기"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
