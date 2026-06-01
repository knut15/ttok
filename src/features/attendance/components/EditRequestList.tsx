// 근무기록 수정 요청내역(AC-16, presentational): 날짜·시각·대기 배지.
import { StatusBadge } from "@/components/StatusBadge";
import { formatPayRowDate } from "@/lib/date";
import { requestKindLabel } from "@/features/attendance/domain";
import type { EditRequest } from "@/types";

// T8-7: 수락 버튼은 마스터에게만(canApprove). UI 숨김 + approve API 403 이중 방어(AC-18).
export function EditRequestList({
  requests,
  onApprove,
  canApprove = false,
}: {
  requests: EditRequest[];
  onApprove?: (id: string) => void;
  canApprove?: boolean;
}) {
  if (requests.length === 0) return null;

  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold">근무기록 수정 요청내역</h2>
      <ul className="space-y-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className="rounded-2xl border border-black/5 bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatPayRowDate(req.date)}</span>
              {/* T15 Q4: before 빈값 파생 "추가"/"수정" 라벨(표시 전용, 스키마 무변경). */}
              <span className="rounded-md bg-black/[0.06] px-2 py-0.5 text-xs font-semibold text-muted">
                {requestKindLabel(req.before)}
              </span>
              <span className="text-sm text-muted">
                {new Date(req.createdAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <StatusBadge
                label={req.status}
                tone={req.status === "수락" ? "coral" : "neutral"}
              />
              {/* AC-9/AC-18: 대기 요청에만 + 마스터(canApprove)만 수락 버튼. */}
              {req.status === "대기" && canApprove && onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(req.id)}
                  className="ml-auto rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-white"
                >
                  수락
                </button>
              )}
            </div>
            <div className="mt-2 text-sm">
              <p className="font-semibold">출 · 퇴근</p>
              <p className="text-muted">
                <span className="text-statusgreen">{req.after.status}</span>{" "}
                {req.after.clockIn ?? "-"}~{req.after.clockOut ?? "-"}
              </p>
              {req.reason && (
                <p className="mt-1 text-muted">사유: {req.reason}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
