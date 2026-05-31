// 문서함 카드 3개(카운트 0) placeholder (AC-9d/AC-11).
const DOCUMENTS = [
  { icon: "₩", label: "급여명세서", request: "확인요청", tone: "bg-green-100 text-green-600" },
  { icon: "✎", label: "근로계약서", request: "서명요청", tone: "bg-yellow-100 text-yellow-600" },
  { icon: "≡", label: "기타문서", request: "등록요청", tone: "bg-gray-100 text-gray-500" },
] as const;

export function DocumentBox() {
  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold text-foreground">문서함</h2>
      <div className="grid grid-cols-3 gap-3">
        {DOCUMENTS.map((doc) => (
          <button
            key={doc.label}
            type="button"
            className="rounded-2xl border border-black/5 p-3 text-left"
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
