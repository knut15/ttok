"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useProfile } from "@/features/mypage/hooks/useProfile";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { RoleSwitcher } from "@/features/accounts/components/RoleSwitcher";
import { InvitePanel } from "@/features/accounts/components/InvitePanel";
import { ProfileSummary } from "./ProfileSummary";
import { StoreCard } from "./StoreCard";
import { DocumentBox } from "./DocumentBox";
import { ServiceMenu } from "./ServiceMenu";

// /mypage 클라이언트 뷰: useProfile 로딩 가드 후 4섹션 조립 (AC-9).
// T8-3: 역할전환(RoleSwitcher) + 마스터일 때 /master 진입점(링크만).
export function MyPageView() {
  const { data, loading } = useProfile();
  const { user } = useCurrentUser();

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
            roleLabel={
              user.role === "master" ? "마스터" : data.isManager ? "매니저" : null
            }
          />
          <StoreCard store={data.store} />
          <DocumentBox />
          <ServiceMenu />
          {user.role === "master" && (
            <section className="px-5 pt-8">
              <Link
                href="/master"
                className="block rounded-2xl bg-coral px-4 py-3 text-center font-semibold text-white"
              >
                마스터 집계 보기
              </Link>
            </section>
          )}
          {/* T8-6: role 별 초대 섹션(마스터=생성 / 크루=합류). */}
          <InvitePanel />
          <RoleSwitcher />
        </>
      )}
    </div>
  );
}
