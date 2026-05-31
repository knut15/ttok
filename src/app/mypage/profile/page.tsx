// /mypage/profile RSC 셸(AC-12): 뒤로가기+"프로필 수정" 헤더 + ProfileForm.
import { BackButton } from "@/features/mypage/components/BackButton";
import { ProfileForm } from "@/features/mypage/components/ProfileForm";

export default function ProfileEditPage() {
  return (
    <div>
      <header className="grid grid-cols-[auto_1fr_auto] items-center px-5 pb-2 pt-4">
        <BackButton />
        <h1 className="text-center text-lg font-bold text-foreground">
          프로필 수정
        </h1>
        <span className="w-6" />
      </header>
      <ProfileForm />
    </div>
  );
}
