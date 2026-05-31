// "서비스 안내·문의" 리스트 placeholder (AC-9e/AC-11).
const ITEMS = ["공지사항", "자주 하는 질문", "문의 · 제안"] as const;

export function ServiceMenu() {
  return (
    <section className="px-5 pb-8 pt-10">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
        <span
          aria-hidden
          className="grid h-5 w-5 place-items-center rounded bg-blue-500 text-xs text-white"
        >
          i
        </span>
        서비스 안내 · 문의
      </h2>
      <ul>
        {ITEMS.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="flex w-full items-center justify-between py-4 text-base font-semibold text-foreground"
            >
              <span>{item}</span>
              <span className="text-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
