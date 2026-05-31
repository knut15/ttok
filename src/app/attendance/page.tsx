// /attendance RSC 셸(AC-10): 월 이동은 client 래퍼(AttendanceCalendarView)로 위임.
// month 상태를 캘린더 영역에만 지역화해 RSC 셸 회귀를 방지(architect §2.3, §4.1).
import { AttendanceCalendarView } from "@/features/attendance/components/AttendanceCalendarView";

export default function AttendancePage() {
  return <AttendanceCalendarView />;
}
