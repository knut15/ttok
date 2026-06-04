// /master/[crewId] RSC 셸(REWORK v2 / P1-2 / AC-11): 마스터 멤버 드릴다운.
// role 진실원은 클라 컨텍스트(localStorage) → 가드는 MasterCrewDetail(client) 책임.
// crewId 는 라우트 파라미터로 전달, 실제 권한 강제는 read API enforceReadScope(scope.ts).
import { MasterCrewDetail } from "@/features/accounts/components/MasterCrewDetail";

export default async function MasterCrewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ crewId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { crewId } = await params;
  // 집계뷰에서 선택한 월을 ?month= 로 전달받아 같은 월로 진입(없으면 현재월 default).
  const { month } = await searchParams;
  return <MasterCrewDetail crewId={crewId} initialMonth={month} />;
}
