// /attendance/[date] RSC 셸. date 검증→notFound()(엣지#5). 상세는 client.
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AttendanceDetail } from "@/features/attendance/components/AttendanceDetail";
import { isValidDateString, formatLongDate } from "@/lib/date";

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();

  return (
    <div>
      <AppHeader title={formatLongDate(date)} />
      <div className="pt-2">
        <AttendanceDetail date={date} />
      </div>
    </div>
  );
}
