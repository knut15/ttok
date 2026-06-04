// 문서함 카드 3개(카운트 0) placeholder (AC-9d/AC-11).
// Premium Monotone: 문서 종류는 아이콘으로 구분, 타일 톤은 통일(크림 위 잉크).
const DOCUMENTS = [
  { icon: "₩", label: "급여명세서", request: "확인요청", tone: "bg-coral-soft text-foreground" },
  { icon: "✎", label: "근로계약서", request: "서명요청", tone: "bg-coral-soft text-foreground" },
  { icon: "≡", label: "기타문서", request: "등록요청", tone: "bg-coral-soft text-foreground" },
] as const;

export function DocumentBox() {
  return (
    <section className="px-5 pt-8">
      <h2 className="mb-4 text-lg font-bold text-foreground">문서함</h2>
      <div className="grid grid-cols-3 gap-3">
        {DOCUMENTS.map((doc) => (
          <button
            key={doc.label}
            type="button"
            className="rounded-2xl border border-border bg-surface p-3 text-left"
          >
            <span
              aria-hidden
              className={`mb-2 grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${doc.tone}`}
            >
              {doc.icon}
            </span>
            <p className="text-sm font-semibold text-foreground">{doc.label}</p>
            <p className="text-xs text-muted">{doc.request} 0</p>
          </button>
        ))}
      </div>
    </section>
  );
}
