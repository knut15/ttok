// /attendance/[date] RSC 셸. date 검증→notFound()(엣지#5). 상세/내비는 client.
import { notFound } from "next/navigation";
import { AttendanceDetail } from "@/features/attendance/components/AttendanceDetail";
import { AttendanceDetailNav } from "@/features/attendance/components/AttendanceDetailNav";
import { isValidDateString } from "@/lib/date";

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();

  return (
    <div>
      <AttendanceDetailNav date={date} />
      <div className="pt-2">
        <AttendanceDetail date={date} />
      </div>
    </div>
  );
}
