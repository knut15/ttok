import Link from "next/link";

// 이니셜 아바타 + 이름 + "내 정보 수정" 링크 (AC-9b/AC-10). 매니저면 이름 옆 배지.
export function ProfileSummary({
  name,
  avatarInitial,
  isManager = false,
}: {
  name: string;
  avatarInitial: string;
  isManager?: boolean;
}) {
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
          {isManager ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              매니저
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
