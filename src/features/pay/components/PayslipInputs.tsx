"use client";

// 명세서 입력값 폼(마스터 전용) — 총매출/근로소득세/야간수당 입력 + 1% 인센티브 선택(체크박스).
// 인쇄 시 숨김(print:hidden). 인센티브는 총매출×1%로 자동 파생(미리보기 표기).
import type { PayslipInputs as Inputs } from "@/types";
import { formatWon } from "@/features/pay/domain";
import { calcIncentive } from "@/lib/payslip";

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2 text-right text-sm font-medium tabular-nums focus:border-coral focus:outline-none"
      />
      {hint && <span className="mt-1 block text-right text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** 마스터 입력 폼 래퍼(공통 카드). 인쇄 시 숨김. */
function InputCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-print-hide
      className="mx-5 mb-2 rounded-2xl border border-border bg-surface p-4 print:hidden"
    >
      {children}
    </section>
  );
}

export function PayslipInputs({
  value,
  onChange,
  onSave,
  onCancel,
  canCancel,
  saving,
  dirty,
}: {
  value: Inputs;
  onChange: (next: Inputs) => void;
  onSave: () => void;
  onCancel: () => void;
  canCancel: boolean;
  saving: boolean;
  dirty: boolean;
}) {
  const set = (patch: Partial<Inputs>) => onChange({ ...value, ...patch });

  return (
    <InputCard>
      <h3 className="pb-3 text-sm font-bold">명세서 입력값 (마스터)</h3>
      <div className="grid grid-cols-1 gap-3">
        {/* 1% 인센티브 — 선택값(체크박스). 체크 시에만 총매출 입력·인센티브 항목 포함. */}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.incentiveEnabled}
            onChange={(e) => set({ incentiveEnabled: e.target.checked })}
            className="h-4 w-4 accent-coral"
          />
          1% 인센티브 포함
        </label>
        {value.incentiveEnabled && (
          <NumberField
            label="총매출 (원)"
            value={value.monthlySales}
            onChange={(monthlySales) => set({ monthlySales })}
            hint={`1% 인센티브 → ${formatWon(calcIncentive(value.monthlySales))}`}
          />
        )}
        <NumberField
          label="근로소득세 (원) — 간이세액표 조회값"
          value={value.incomeTax}
          onChange={(incomeTax) => set({ incomeTax })}
        />
        <NumberField
          label="야간수당 (원)"
          value={value.nightPay}
          onChange={(nightPay) => set({ nightPay })}
        />
      </div>
      <div className="mt-4 flex gap-2">
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-foreground/10 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="flex-1 rounded-xl bg-coral py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : dirty ? "명세서 저장" : "저장됨"}
        </button>
      </div>
    </InputCard>
  );
}

/** 입력값 읽기 요약(마스터, 저장 후) — 텍스트 표시 + 수정 버튼. */
export function PayslipInputsSummary({
  value,
  onEdit,
}: {
  value: Inputs;
  onEdit: () => void;
}) {
  const rows: { label: string; text: string }[] = [
    {
      label: "1% 인센티브",
      text: value.incentiveEnabled
        ? `포함 · 총매출 ${formatWon(value.monthlySales)} → ${formatWon(calcIncentive(value.monthlySales))}`
        : "미포함",
    },
    { label: "근로소득세", text: formatWon(value.incomeTax) },
    { label: "야간수당", text: formatWon(value.nightPay) },
  ];
  return (
    <InputCard>
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-sm font-bold">명세서 입력값 (마스터)</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-semibold"
        >
          수정
        </button>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-muted">{r.label}</dt>
            <dd className="font-medium">{r.text}</dd>
          </div>
        ))}
      </dl>
    </InputCard>
  );
}
