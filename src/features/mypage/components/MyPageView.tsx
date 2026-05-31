"use client";

import { AppHeader } from "@/components/AppHeader";
import { useProfile } from "@/features/mypage/hooks/useProfile";
import { ProfileSummary } from "./ProfileSummary";
import { StoreCard } from "./StoreCard";
import { DocumentBox } from "./DocumentBox";
import { ServiceMenu } from "./ServiceMenu";

// /mypage 클라이언트 뷰: useProfile 로딩 가드 후 4섹션 조립 (AC-9).
export function MyPageView() {
  const { data, loading } = useProfile();

  return (
    <div className="pb-24">
      <AppHeader
        title=""
        right={
          <span className="relative inline-block" aria-label="알림">
            <span aria-hidden className="text-2xl text-foreground">
              🔔
            </span>
            <span
              aria-hidden
              className="absolute right-0 top-0 h-2 w-2 rounded-full bg-coral"
            />
          </span>
        }
      />

      {loading || !data ? (
        <div className="px-5 pt-10 text-center text-sm text-muted">
          불러오는 중…
        </div>
      ) : (
        <>
          <ProfileSummary
            name={data.profile.name}
            avatarInitial={data.profile.avatarInitial}
          />
          <StoreCard store={data.store} />
          <DocumentBox />
          <ServiceMenu />
        </>
      )}
    </div>
  );
}
