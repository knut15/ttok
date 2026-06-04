"use client";

import { useProfile } from "@/features/mypage/hooks/useProfile";
import { isValidEmail, isValidPhone } from "@/features/mypage/domain";
import { formatBirthDate } from "@/lib/date";
import { ProfileFieldRow } from "./ProfileFieldRow";

// 프로필 수정 폼 (AC-12/13/14): 이름/생년월일 읽기전용, 휴대폰/이메일 인라인 편집.
// 저장 전 클라 형식 검증(AC-14) → 통과 시 PATCH(useProfile.update). 400은 행에서 에러 표시.
export function ProfileForm() {
  const { data, loading, update } = useProfile();

  if (loading || !data) {
    return (
      <div className="px-5 pt-10 text-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }

  const { profile } = data;

  async function savePhone(value: string) {
    if (!isValidPhone(value)) {
      throw new Error("휴대폰 형식이 올바르지 않습니다.");
    }
    await update({ phone: value });
  }

  async function saveEmail(value: string) {
    if (!isValidEmail(value)) {
      throw new Error("이메일 형식이 올바르지 않습니다.");
    }
    await update({ email: value });
  }

  return (
    <div className="pb-24">
      <div className="flex flex-col items-center pb-8 pt-4">
        <span className="relative">
          <span
            aria-hidden
            className="grid h-28 w-28 place-items-center rounded-full bg-coral text-4xl font-bold text-white"
          >
            {profile.avatarInitial}
          </span>
          <button
            type="button"
            aria-label="사진 변경"
            className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-sm"
          >
            📷
          </button>
        </span>
      </div>

      <div className="divide-y divide-black/5">
        <ProfileFieldRow label="이름" value={profile.name} />
        <ProfileFieldRow
          label="생년월일"
          value={formatBirthDate(profile.birthDate)}
        />
        <ProfileFieldRow
          label="휴대폰"
          value={profile.phone}
          editable
          inputType="tel"
          onSave={savePhone}
        />
        <ProfileFieldRow
          label="이메일"
          value={profile.email}
          editable
          inputType="email"
          onSave={saveEmail}
        />
      </div>

      <div className="mx-5 mt-6 rounded-3xl bg-surface p-5 text-center">
        <p className="text-base font-semibold text-foreground">
          이름, 생년월일을 변경하려면 본인인증을 해주세요
        </p>
        <button
          type="button"
          className="mt-1 text-sm text-muted underline underline-offset-2"
        >
          본인인증하기
        </button>
      </div>
    </div>
  );
}
