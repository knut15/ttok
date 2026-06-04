import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import type { StoreInfo } from "@/types";

// "나의 매장" 섹션 + 매장 카드 + "매장 등록하기 +" placeholder (AC-9c).
// Premium Monotone: 아이콘 타일 + 재직 상태 pill + 구분선 + 라벨/값 정렬.
export function StoreCard({ store }: { store: StoreInfo }) {
  const joinDot = store.joinDate.replaceAll("-", ".");
  const employLabel = store.employed ? "재직중" : "퇴사";

  return (
    <section className="px-5 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1 text-lg font-bold tracking-tight text-foreground">
          나의 매장 <span className="text-muted">›</span>
        </h2>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted"
        >
          매장 등록하기 <span aria-hidden>+</span>
        </button>
      </div>
      <Card>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral-soft text-xl"
          >
            ☕
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-snug text-foreground">{store.name}</p>
            <StatusBadge
              label={employLabel}
              tone={store.employed ? "green" : "gray"}
              className="mt-1"
            />
          </div>
          <span className="self-start text-muted">›</span>
        </div>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">입사</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {joinDot}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">근무</dt>
            <dd className="font-semibold text-foreground">
              {store.workDays} {store.workTime}
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}
