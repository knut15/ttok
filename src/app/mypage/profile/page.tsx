// /mypage/profile RSC 셸(AC-12): 공통 헤더(layout)가 뒤로가기+"프로필 수정" 제공 → 본문만.
import { ProfileForm } from "@/features/mypage/components/ProfileForm";

export default function ProfileEditPage() {
  return (
    <div className="pt-3">
      <ProfileForm />
    </div>
  );
}
