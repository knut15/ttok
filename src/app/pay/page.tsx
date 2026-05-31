// /pay RSC 셸(AC-17): 월 선택 헤더 + 매장명 + PayList(client).
import { AppHeader } from "@/components/AppHeader";
import { PayList } from "@/features/pay/components/PayList";
import { STORE_NAME, SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel } from "@/lib/date";

export default function PayPage() {
  return (
    <div>
      <AppHeader
        title={`${formatMonthLabel(SEED_MONTH)} ▾`}
        right={
          <span className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold">
            급여명세서
          </span>
        }
      />
      <div className="flex items-center gap-2 px-5 pb-3 text-base font-bold">
        <span aria-hidden>🏪</span>
        <span className="truncate">{STORE_NAME}</span>
      </div>
      <PayList month={SEED_MONTH} />
    </div>
  );
}
