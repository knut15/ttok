// 예정(스케쥴) 대비 실제(출퇴근) 비교 카드(T21). presentational — 순수 계산.
// 지각 = 실제출근 > 예정시작, 초과 = 실제퇴근 > 예정종료, 조퇴 = 실제퇴근 < 예정종료.
import type { AttendanceRecord, ScheduleEntry } from "@/types";
import { parseHHMM } from "@/lib/time";

function minLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function diffMin(a: string | null, b: string): number | null {
  if (!a) return null;
  const x = parseHHMM(a);
  const y = parseHHMM(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return x - y;
}

function Chip({ text, tone }: { text: string; tone: "green" | "gray" | "coral" }) {
  const cls = {
    green: "bg-statusgreen/15 text-statusgreen",
    gray: "bg-foreground/[0.06] text-muted",
    coral: "bg-coral/15 text-coral",
  }[tone];
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

export function ScheduleVsActual({
  entry,
  record,
}: {
  entry: ScheduleEntry;
  record: AttendanceRecord;
}) {
  const planned = entry.off ? "휴무" : `${entry.startTime}–${entry.endTime}`;
  const actual =
    record.clockIn || record.clockOut
      ? `${record.clockIn ?? "-"}–${record.clockOut ?? "-"}`
      : "기록 없음";

  // 휴무 예정엔 차이 계산 생략(근무 발생 여부만 안내).
  const chips: { text: string; tone: "green" | "gray" | "coral" }[] = [];
  if (entry.off) {
    if (record.clockIn || record.clockOut) chips.push({ text: "휴무일 근무", tone: "coral" });
  } else {
    const late = diffMin(record.clockIn, entry.startTime);
    const outDelta = diffMin(record.clockOut, entry.endTime);
    if (late !== null && late > 0) chips.push({ text: `지각 ${minLabel(late)}`, tone: "coral" });
    if (outDelta !== null) {
      if (outDelta > 0) chips.push({ text: `초과근무 ${minLabel(outDelta)}`, tone: "green" });
      else if (outDelta < 0) chips.push({ text: `조퇴 ${minLabel(-outDelta)}`, tone: "gray" });
    }
    if (chips.length === 0 && record.clockIn && record.clockOut) {
      chips.push({ text: "예정대로 근무", tone: "green" });
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="pb-2 text-sm font-bold">예정 대비 실제</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">예정</span>
        <span className="font-semibold">{planned}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-muted">실제</span>
        <span className="font-semibold">{actual}</span>
      </div>
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <Chip key={c.text} text={c.text} tone={c.tone} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
