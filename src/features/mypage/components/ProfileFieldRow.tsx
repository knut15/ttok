"use client";

import { useState } from "react";

// 라벨+값 단일 행 (재사용). readonly variant(이름/생년월일) / editable variant(휴대폰/이메일 인라인 편집).
// editable: 행 탭 → input 활성, 저장 시 onSave(value). onSave가 throw 하면 에러 메시지 표시(AC-14).
export function ProfileFieldRow({
  label,
  value,
  editable = false,
  inputType = "text",
  onSave,
}: {
  label: string;
  value: string;
  editable?: boolean;
  inputType?: "text" | "email" | "tel";
  onSave?: (value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!editable) {
    return (
      <div className="flex items-center gap-6 px-5 py-4">
        <span className="w-20 shrink-0 text-base text-muted">{label}</span>
        <span className="text-base text-muted">{value}</span>
      </div>
    );
  }

  function startEdit() {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-6">
        <span className="w-20 shrink-0 text-base text-muted">{label}</span>
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type={inputType}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={label}
              className="flex-1 rounded-lg border border-black/15 px-3 py-1.5 text-base font-medium text-foreground outline-none focus:border-coral"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              저장
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="flex flex-1 items-center justify-between text-left"
          >
            <span className="text-base font-medium text-foreground">
              {value}
            </span>
            <span className="text-muted">›</span>
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 pl-[6.5rem] text-sm text-coral">{error}</p>
      )}
    </div>
  );
}
