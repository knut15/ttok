// 마스터 수정요청 목록(FR-2, presentational): 멤버명 · 날짜 · 대기/수락 배지 · 수락 버튼.
// 대기 요청에만 수락 버튼(approveRequest 멱등이나 UI에서 재수락 노출 안 함, E-3).
// 0건이면 빈 상태(E-2). props 는 types 만 의존(store/route 비접근).
import { StatusBadge } from "@/components/StatusBadge";
import { formatPayRowDate } from "@/lib/date";
import { requestKindLabel } from "@/features/attendance/domain";
import type { MasterRequestRow } from "@/types";

export function MasterRequestList({
  requests,
  onApprove,
}: {
  requests: MasterRequestRow[];
  onApprove: (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <p className="px-5 pt-6 text-center text-sm text-muted">
        수정요청이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3 px-5">
      {requests.map((req) => (
        <li
          key={req.id}
          className="rounded-3xl border border-foreground/5 bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">{req.crewName}</span>
            <span className="text-sm text-muted">
              {formatPayRowDate(req.date)}
            </span>
            {/* T15 Q4: before 빈값 파생 "추가"/"수정" 라벨(표시 전용, 스키마 무변경). */}
            <span className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-xs font-semibold text-muted">
              {requestKindLabel(req.before)}
            </span>
            <StatusBadge
              label={req.status}
              tone={req.status === "수락" ? "coral" : "neutral"}
            />
            {req.status === "대기" && (
              <button
                type="button"
                onClick={() => onApprove(req.id)}
                className="ml-auto rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-white"
              >
                수락
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-muted">
            <span className="text-statusgreen">{req.after.status}</span>{" "}
            {req.after.clockIn ?? "-"}~{req.after.clockOut ?? "-"}
            {req.reason && <p className="mt-1">사유: {req.reason}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
