// 급여명세서 표현 컴포넌트(PDF test.pdf 레이아웃). 순수 표현 — 계산은 lib/payslip.
import type { AttendanceRecord, Payslip as PayslipData, PayslipLine } from "@/types";
import { formatWon, durationLabel } from "@/features/pay/domain";
import { formatBirthDate, formatDotDate, formatPayRowDate } from "@/lib/date";

/** 섹션 제목 + 하단 보더. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 border-b border-foreground/10 pb-2 text-base font-bold">{children}</h2>
  );
}

/** 직원정보 행(라벨 좌 / 값 우). */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** 합계행(굵게) + note + subRows(들여쓰기, muted). PDF 지급/공제 공용. */
function AmountLine({ line }: { line: PayslipLine }) {
  return (
    <div className="pt-3">
      <div className="flex items-center justify-between">
        <span className="font-bold">{line.label}</span>
        <span className="font-bold">{formatWon(line.amount)}</span>
      </div>
      {line.note && (
        <div className="flex items-center justify-between pt-0.5 text-sm text-muted">
          <span>{line.note}</span>
          {!line.subRows && <span>{formatWon(line.amount)}</span>}
        </div>
      )}
      {line.subRows?.map((sub) => (
        <div
          key={sub.label}
          className="flex items-center justify-between pt-1 text-sm text-muted"
        >
          <span>{sub.label}</span>
          <span>{formatWon(sub.amount)}</span>
        </div>
      ))}
    </div>
  );
}

/** 총계 헤더행(섹션 첫 줄, 굵고 큼). */
function TotalLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-base font-bold">{label}</span>
      <span className="text-base font-bold">{formatWon(amount)}</span>
    </div>
  );
}

/** "HH:MM ~ HH:MM (근무시간)" / 무근무 상태 라벨. */
function workTimeLabel(r: AttendanceRecord): string {
  if (r.status === "휴가") return "휴가";
  if (!r.clockIn || !r.clockOut) return r.status;
  return `${r.clockIn} ~ ${r.clockOut} (${durationLabel(r.workMinutes)})`;
}

export function Payslip({
  slip,
  records,
  hourlyWage,
}: {
  slip: PayslipData;
  records: AttendanceRecord[];
  hourlyWage: number;
}) {
  const dailyPay = (r: AttendanceRecord) =>
    r.status === "휴가" ? 0 : Math.round((hourlyWage / 60) * r.workMinutes);

  return (
    <div className="px-5 pb-10 text-foreground">
      <h1 className="text-xl font-extrabold">급여명세서</h1>

      {/* 실 지급액 헤더 */}
      <p className="mt-4 text-sm font-bold">실 지급액</p>
      <p className="text-3xl font-extrabold">{formatWon(slip.netPay)}</p>
      <div className="mt-2 space-y-0.5 text-sm text-muted">
        <p>정산기간 {slip.periodLabel}</p>
        <p>급여일 {formatDotDate(slip.payDate).slice(0, 10)}</p>
        <p>직원확인 {formatDotDate(slip.payDate).slice(0, 10)}</p>
      </div>

      {/* 직원정보 */}
      <SectionTitle>직원정보</SectionTitle>
      <InfoRow label="회사명" value={slip.employee.company} />
      <InfoRow label="이름" value={slip.employee.name} />
      <InfoRow label="생년월일" value={formatBirthDate(slip.employee.birthDate)} />

      {/* 지급내역 */}
      <SectionTitle>지급내역</SectionTitle>
      <TotalLine label="총 지급액" amount={slip.totalEarnings} />
      {slip.earnings.map((line) => (
        <AmountLine key={line.label} line={line} />
      ))}

      {/* 공제내역 */}
      <SectionTitle>공제내역</SectionTitle>
      <TotalLine label="총 공제액" amount={slip.totalDeduction} />
      {slip.deductions.map((line) => (
        <AmountLine key={line.label} line={line} />
      ))}

      {/* 근무내역 */}
      <SectionTitle>근무내역</SectionTitle>
      <ul className="divide-y divide-black/5">
        {records.map((r) => (
          <li key={r.date} className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold">{formatPayRowDate(r.date)}</p>
              <p className="text-sm text-muted">{workTimeLabel(r)}</p>
            </div>
            <span className="font-bold">{formatWon(dailyPay(r))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
