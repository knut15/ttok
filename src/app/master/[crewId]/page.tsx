// /master/[crewId] RSC 셸(REWORK v2 / P1-2 / AC-11): 마스터 멤버 드릴다운.
// role 진실원은 클라 컨텍스트(localStorage) → 가드는 MasterCrewDetail(client) 책임.
// crewId 는 라우트 파라미터로 전달, 실제 권한 강제는 read API enforceReadScope(scope.ts).
import { MasterCrewDetail } from "@/features/accounts/components/MasterCrewDetail";

export default async function MasterCrewDetailPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;
  return <MasterCrewDetail crewId={crewId} />;
}
