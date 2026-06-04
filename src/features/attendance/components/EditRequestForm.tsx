"use client";

import { useState } from "react";

const MAX = 100;

// 수정요청 사유(AC-16): 0/100 카운터, 100자 초과 차단, 빈 사유 버튼 비활성 → POST.
export function EditRequestForm({
  onSubmit,
}: {
  onSubmit: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <section className="px-5 pt-6">
      <h2 className="mb-2 text-lg font-bold">요청사유</h2>
      <div className="rounded-3xl border border-foreground/10 bg-surface p-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder="사유를 입력해 주세요."
          rows={3}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <div className="text-right text-sm">
          <span className={reason.length > 0 ? "text-coral" : "text-muted"}>
            {reason.length}
          </span>
          <span className="text-muted">/{MAX}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={trimmed.length === 0}
        onClick={async () => {
          await onSubmit(trimmed);
          setReason("");
        }}
        className="mt-3 w-full rounded-xl bg-coral py-3 font-bold text-white disabled:bg-black/5 disabled:text-muted"
      >
        수정요청
      </button>
    </section>
  );
}
