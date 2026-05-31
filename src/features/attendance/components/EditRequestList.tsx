// 근무기록 수정 요청내역(AC-16, presentational): 날짜·시각·대기 배지.
import { StatusBadge } from "@/components/StatusBadge";
import { formatPayRowDate } from "@/lib/date";
import type { EditRequest } from "@/types";

export function EditRequestList({
  requests,
  onApprove,
}: {
  requests: EditRequest[];
  onApprove?: (id: string) => void;
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
              {/* AC-9: 대기 요청에만 수락 버튼. 수락 상태엔 버튼 없음. */}
              {req.status === "대기" && onApprove && (
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
