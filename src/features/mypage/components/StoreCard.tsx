import { Card } from "@/components/Card";
import type { StoreInfo } from "@/types";

// "나의 매장" 섹션 + 매장 카드 + "매장 등록하기 +" placeholder (AC-9c).
export function StoreCard({ store }: { store: StoreInfo }) {
  const joinDot = store.joinDate.replaceAll("-", ".");
  const employLabel = store.employed ? "재직중" : "퇴사";

  return (
    <section className="px-5 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1 text-lg font-bold text-foreground">
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <span aria-hidden>☕</span>
            <span>{store.name}</span>
          </div>
          <span className="text-muted">›</span>
        </div>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-3">
            <dt className="text-muted">입사</dt>
            <dd className="font-medium text-foreground">
              {joinDot} ~ {employLabel}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-muted">근무</dt>
            <dd className="font-medium text-foreground">
              {store.workDays} {store.workTime}
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}
