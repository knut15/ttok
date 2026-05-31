// /attendance RSC 셸(AC-13): 월 선택 헤더 + 매장명 + MonthlyCalendar(client).
import { AppHeader } from "@/components/AppHeader";
import { MonthlyCalendar } from "@/features/attendance/components/MonthlyCalendar";
import { STORE_NAME, SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel } from "@/lib/date";

export default function AttendancePage() {
  return (
    <div>
      <AppHeader
        title={`${formatMonthLabel(SEED_MONTH)} ▾`}
        right={<span className="text-muted">⤓</span>}
      />
      <div className="flex items-center gap-2 px-5 pb-3 text-sm font-semibold">
        <span aria-hidden>🏪</span>
        <span className="truncate">{STORE_NAME}</span>
      </div>
      <MonthlyCalendar month={SEED_MONTH} />
    </div>
  );
}
