"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useProfile } from "@/features/mypage/hooks/useProfile";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { InvitePanel } from "@/features/accounts/components/InvitePanel";
import { MasterMemberList } from "@/features/accounts/components/MasterMemberList";
import { ProfileSummary } from "./ProfileSummary";
import { StoreCard } from "./StoreCard";
import { DocumentBox } from "./DocumentBox";
import { ServiceMenu } from "./ServiceMenu";

// /mypage 클라이언트 뷰: useProfile 로딩 가드 후 섹션 조립.
// 세션 모델: 마스터만 초대코드 발급, 로그아웃 제공(계정 전환=재로그인).
export function MyPageView() {
  const { data, loading } = useProfile();
  const { user } = useCurrentUser();

  return (
    <div className="pb-24 pt-3">
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
              user.role === "master" ? "마스터" : data.isManager ? "멤버(매니저)" : null
            }
          />
          <StoreCard store={data.store} />
          <DocumentBox />
          <ServiceMenu />
          {user.role === "master" && (
            <section className="px-5 pt-8">
              <Link
                href="/master"
                className="block rounded-3xl bg-coral px-4 py-3 text-center font-semibold text-white"
              >
                마스터 집계 보기
              </Link>
            </section>
          )}
          {/* 마스터: 합류 멤버 목록(매니저 지정/해제) + 초대코드 발급. */}
          {user.role === "master" && <MasterMemberList />}
          {user.role === "master" && <InvitePanel />}
          <section className="px-5 pb-8 pt-10">
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/login" })}
              className="w-full rounded-3xl border border-foreground/10 px-4 py-3 font-semibold text-muted"
            >
              로그아웃
            </button>
          </section>
        </>
      )}
    </div>
  );
}
