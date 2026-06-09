// 급여명세서 표현 컴포넌트 — 앱 카드형 레이아웃. 계산은 lib/payslip(순수).
import type { AttendanceRecord, Payslip as PayslipData, PayslipLine } from "@/types";
import { formatWon, durationLabel } from "@/features/pay/domain";
import {
  formatBirthDate,
  formatDotDate,
  formatMonthLabel,
  formatPayRowDate,
} from "@/lib/date";

/** 카드 컨테이너 — 제목은 박스 위 라벨, 본문은 앱 공통 카드(rounded-2xl border bg-surface). */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-lg font-bold">{title}</h2>
      <div className="rounded-2xl border border-border bg-surface px-4">{children}</div>
    </section>
  );
}

/** 직원정보 행(라벨 좌 / 값 우). */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** 지급/공제 항목 1행 + note(근거) + subRows(주별·세부, 들여쓰기 muted). */
function ItemLine({ line }: { line: PayslipLine }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{line.label}</span>
        <span className="text-sm font-semibold tabular-nums">{formatWon(line.amount)}</span>
      </div>
      {line.note && <p className="pt-0.5 text-xs text-muted">{line.note}</p>}
      {line.subRows?.map((sub) => (
        <div
          key={sub.label}
          className="flex items-center justify-between pt-1 text-xs text-muted"
        >
          <span>{sub.label}</span>
          <span className="tabular-nums">{formatWon(sub.amount)}</span>
        </div>
      ))}
    </div>
  );
}

/** 카드 하단 합계행(상단 보더 + 강조). */
function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between border-t border-border py-3">
      <span className="text-sm font-bold">{label}</span>
      <span className="text-base font-extrabold tabular-nums">{formatWon(amount)}</span>
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
      {/* 헤더 + 실수령 히어로 */}
      <p className="text-center text-xs font-semibold text-muted">
        {formatMonthLabel(slip.month)} 급여명세서
      </p>
      <div className="mt-3 text-center">
        <p className="text-sm font-semibold text-muted">실수령액</p>
        <p className="mt-1 text-3xl font-extrabold">{formatWon(slip.netPay)}</p>
        <p className="mt-2 text-sm text-muted">
          총지급{" "}
          <span className="font-semibold text-foreground">
            {slip.totalEarnings.toLocaleString("ko-KR")}
          </span>
          {"  −  "}공제{" "}
          <span className="font-semibold text-foreground">
            {slip.totalDeduction.toLocaleString("ko-KR")}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          정산 {slip.periodLabel} · 급여일 {formatDotDate(slip.payDate).slice(0, 10)}
        </p>
      </div>

      {/* 직원정보 */}
      <Card title="직원정보">
        <InfoRow label="회사명" value={slip.employee.company} />
        <InfoRow label="이름" value={slip.employee.name} />
        <InfoRow label="생년월일" value={formatBirthDate(slip.employee.birthDate)} />
      </Card>

      {/* 지급내역 */}
      <Card title="지급내역">
        {slip.earnings.map((line) => (
          <ItemLine key={line.label} line={line} />
        ))}
        <TotalRow label="총 지급액" amount={slip.totalEarnings} />
      </Card>

      {/* 공제내역 */}
      <Card title="공제내역">
        {slip.deductions.map((line) => (
          <ItemLine key={line.label} line={line} />
        ))}
        <TotalRow label="총 공제액" amount={slip.totalDeduction} />
      </Card>

      {/* 근무내역 */}
      <Card title="근무내역">
        <ul className="divide-y divide-foreground/5">
          {records.map((r) => (
            <li key={r.date} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-bold">{formatPayRowDate(r.date)}</p>
                <p className="text-xs text-muted">{workTimeLabel(r)}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatWon(dailyPay(r))}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
