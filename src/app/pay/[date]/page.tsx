// /pay/[date] RSC 셸(AC-18). date 검증→notFound(). 상세는 client.
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
      <header className="flex items-center justify-center px-5 pb-2 pt-5">
        <h1 className="text-lg font-bold">{formatLongDate(date)}</h1>
      </header>
      <PayDetail date={date} />
    </div>
  );
}
