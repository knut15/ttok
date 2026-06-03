// /pay/statement RSC 셸 — 급여명세서(월별). ?month=YYYY-MM, 누락/형식불량 시 SEED_MONTH.
// ?crewId=… 는 마스터가 특정 멤버 명세서를 편집/조회할 때(멤버 본인은 생략 → 서버가 본인 강제).
import { StatementView } from "@/features/pay/components/StatementView";
import { SEED_MONTH } from "@/lib/constants";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; crewId?: string }>;
}) {
  const { month, crewId } = await searchParams;
  const initial = month && /^\d{4}-\d{2}$/.test(month) ? month : SEED_MONTH;
  return <StatementView initialMonth={initial} crewId={crewId} />;
}
