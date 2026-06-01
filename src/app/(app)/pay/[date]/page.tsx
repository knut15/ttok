// /pay/[date] RSC 셸(AC-18). date 검증→notFound(). 공통 헤더(layout)가 뒤로가기+타이틀 제공.
import { notFound } from "next/navigation";
import { PayDetail } from "@/features/pay/components/PayDetail";
import { isValidDateString, formatLongDate } from "@/lib/date";

export default async function PayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();

  return (
    <div>
      <p className="px-5 pb-2 pt-3 text-center text-sm font-semibold text-muted">
        {formatLongDate(date)}
      </p>
      <PayDetail date={date} />
    </div>
  );
}
