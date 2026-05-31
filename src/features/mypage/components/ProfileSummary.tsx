import Link from "next/link";

// 이니셜 아바타 + 이름 + "내 정보 수정" 링크 (AC-9b/AC-10).
export function ProfileSummary({
  name,
  avatarInitial,
}: {
  name: string;
  avatarInitial: string;
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
        <p className="text-2xl font-extrabold text-foreground">{name}</p>
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
