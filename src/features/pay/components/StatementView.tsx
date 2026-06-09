"use client";

// 급여명세서 화면(월별). 근태(useMonthPay) + 프로필(useProfile) + 입력값 → buildPayslip → 렌더.
// 권한: 마스터만 입력값 편집·저장(PayslipInputs), 멤버는 완성본 조회만(읽기 전용).
// 입력값은 서버 영속(PayslipInput) — 마스터가 저장하면 해당 멤버가 완성본을 본다.
import { useMemo, useState } from "react";
import Link from "next/link";
import { MonthBar } from "@/components/MonthBar";
import { useMonthPay } from "@/features/pay/hooks/usePay";
import { useProfile } from "@/features/mypage/hooks/useProfile";
import { authHeaders, useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { buildPayslip } from "@/lib/payslip";
import { todayDate } from "@/lib/date";
import type { PayslipInputs as Inputs } from "@/types";
import { Payslip } from "./Payslip";
import { PayslipInputs, PayslipInputsSummary } from "./PayslipInputs";

/** "2026-05" → "2026.05.01 ~ 2026.05.31". */
function periodLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return `${y}.${mm}.01 ~ ${y}.${mm}.${String(last).padStart(2, "0")}`;
}

const EMPTY_INPUTS: Inputs = {
  incentiveEnabled: false,
  monthlySales: 0,
  incomeTax: 0,
  nightPay: 0,
};

/** 아직 한 번도 입력되지 않은(기본) 상태 — 최초엔 폼, 저장 후엔 텍스트로 시작. */
function isEmptyInputs(i: Inputs): boolean {
  return !i.incentiveEnabled && i.monthlySales === 0 && i.incomeTax === 0 && i.nightPay === 0;
}

export function StatementView({
  initialMonth,
  crewId,
}: {
  initialMonth: string;
  crewId?: string;
}) {
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(initialMonth);
  const { data: pay, loading: payLoading, reload } = useMonthPay(month, crewId);
  const { data: profile, loading: profileLoading } = useProfile(crewId);

  const canEdit = pay?.canEditStatement ?? false;
  const savedInputs = pay?.statementInputs ?? EMPTY_INPUTS;
  const savedKey = JSON.stringify(savedInputs);

  // 마스터 편집용 draft + 편집/텍스트 토글. 저장값(서버)이 바뀌면 렌더 중 재동기화(effect 미사용).
  // 최초(미입력)엔 폼, 저장 후엔 텍스트로 시작 → "수정"으로 다시 폼 전환.
  const [draft, setDraft] = useState<Inputs>(savedInputs);
  const [editing, setEditing] = useState(true);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setDraft(savedInputs);
    setEditing(isEmptyInputs(savedInputs));
  }

  const effectiveInputs = canEdit ? draft : savedInputs;
  const dirty = JSON.stringify(draft) !== savedKey;
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!crewId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pay/statement-inputs", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(user) },
        body: JSON.stringify({ month, crewId, ...draft }),
        cache: "no-store",
      });
      if (res.ok) {
        setEditing(false); // 저장 성공 → 텍스트 표시로 전환(reload 가 savedKey 갱신).
        reload();
      }
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setDraft(savedInputs);
    setEditing(false);
  }

  const slip = useMemo(() => {
    if (!pay || !profile) return null;
    return buildPayslip({
      records: pay.records,
      hourlyWage: pay.stats.hourlyWage,
      employee: {
        name: profile.profile.name,
        birthDate: profile.profile.birthDate,
        company: profile.store.name,
      },
      inputs: effectiveInputs,
      month,
      periodLabel: periodLabel(month),
      payDate: todayDate(),
    });
  }, [pay, profile, effectiveInputs, month]);

  return (
    <div>
      {/* chrome — 인쇄 시 숨김 */}
      <div className="print:hidden" data-print-hide>
        <div className="flex items-center justify-end px-5 pt-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white"
          >
            인쇄 / PDF 저장
          </button>
        </div>
        <MonthBar month={month} onChange={setMonth} />
        {canEdit ? (
          editing ? (
            <PayslipInputs
              value={draft}
              onChange={setDraft}
              onSave={save}
              onCancel={cancelEdit}
              canCancel={!isEmptyInputs(savedInputs)}
              saving={saving}
              dirty={dirty}
            />
          ) : (
            <PayslipInputsSummary value={savedInputs} onEdit={() => setEditing(true)} />
          )
        ) : (
          <p className="px-5 pb-2 text-center text-xs text-muted">
            완성된 명세서입니다. 입력값은 매장 관리자(마스터)만 수정할 수 있습니다.
          </p>
        )}
      </div>

      {payLoading || profileLoading ? (
        <p className="px-5 py-10 text-center text-sm text-muted">불러오는 중…</p>
      ) : !slip || !pay || pay.records.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          해당 월 급여 데이터가 없습니다.
        </p>
      ) : (
        <Payslip slip={slip} records={pay.records} hourlyWage={pay.stats.hourlyWage} />
      )}

      {/* 급여 탭 복귀 플로팅 버튼 — 하단 중앙, 바텀탭 위로 띄움. 인쇄 시 숨김.
          멤버는 /pay(급여 탭), 마스터가 멤버 명세서를 보는 중이면 해당 멤버 상세로 복귀. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 flex justify-center print:hidden">
        <Link
          href={crewId ? `/master/${crewId}` : "/pay"}
          aria-label="급여 탭으로 돌아가기"
          className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-coral text-white shadow-lg transition-transform active:scale-95"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
