import Link from "next/link";

// 이니셜 아바타 + 이름 + "내 정보 수정" 링크 (AC-9b/AC-10). 권한(마스터/매니저)이면 이름 옆 배지.
export function ProfileSummary({
  name,
  avatarInitial,
  roleLabel = null,
}: {
  name: string;
  avatarInitial: string;
  roleLabel?: string | null; // "마스터" | "매니저" | null
}) {
  const roleTone =
    roleLabel === "마스터" ? "bg-coral/15 text-coral" : "bg-amber-100 text-amber-700";
  return (
    <div className="flex items-center gap-4 px-5 pt-2">
      <span
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-full bg-coral text-2xl font-bold text-white"
      >
        {avatarInitial}
      </span>
      <div>
        <p className="flex items-center gap-2 text-2xl font-extrabold text-foreground">
          {name}
          {roleLabel ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleTone}`}>
              {roleLabel}
            </span>
          ) : null}
        </p>
        <Link
          href="/mypage/profile"
          className="text-sm text-muted underline underline-offset-2"
        >
          내 정보 수정
        </Link>
      </div>
    </div>
  );
}
