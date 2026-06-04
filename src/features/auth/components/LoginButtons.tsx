"use client";

// 로그인 화면 — 구글 로그인 + (loc/dev) 우회 로그인. 성공 시 "/"로, 가드가 온보딩/홈 분기.
import { useState } from "react";
import { signIn } from "next-auth/react";

const DEMO_PERSONAS = [
  { email: "owner@crewmon.local", label: "박점주 (마스터)" },
  { email: "minjung@crewmon.local", label: "김민정 (매니저)" },
  { email: "seoyeon@crewmon.local", label: "이서연 (멤버)" },
];

export function LoginButtons({
  devEnabled,
  invite,
}: {
  devEnabled: boolean;
  invite?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // 합류 링크로 들어온 경우 로그인 후 온보딩 join 탭(코드 자동입력)으로 보낸다.
  const dest = invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/";

  const devLogin = (addr: string) => {
    if (!addr) return;
    setBusy(true);
    void signIn("dev", { email: addr, redirectTo: dest });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 카카오 — 한국 인앱 브라우저(카톡/네이버 등)에서도 동작. 인앱브라우저 사용자의 기본 수단. */}
      <button
        type="button"
        onClick={() => signIn("kakao", { redirectTo: dest })}
        className="flex w-full items-center justify-center gap-2 rounded-3xl bg-[#FEE500] px-4 py-3 font-semibold text-[#191600]"
      >
        <span className="text-lg">K</span> 카카오로 로그인
      </button>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: dest })}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border border-black/10 bg-surface px-4 py-3 font-semibold text-foreground"
      >
        <span className="text-lg">G</span> 구글로 로그인
      </button>

      {devEnabled && (
        <section className="mt-2 rounded-3xl border border-dashed border-black/15 p-4">
          <h2 className="mb-2 text-sm font-bold text-muted">개발용 로그인 (loc/dev)</h2>
          <ul className="mb-3 space-y-2">
            {DEMO_PERSONAS.map((p) => (
              <li key={p.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => devLogin(p.email)}
                  className="w-full rounded-xl bg-black/[0.04] px-3 py-2 text-left text-sm hover:bg-black/[0.08] disabled:opacity-50"
                >
                  {p.label}
                  <span className="block text-xs text-muted">{p.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="새 계정 이메일(온보딩 테스트)"
              className="flex-1 rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || email.trim().length === 0}
              onClick={() => devLogin(email.trim())}
              className="rounded-xl bg-coral px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              로그인
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
