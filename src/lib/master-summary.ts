// 마스터 집계 브리지(server-only): Prisma 멤버십(신원) + 인메모리 운영집계 결합.
// 합류한 실제 멤버가 마스터 화면에 보이도록 — crewId=operationalId(데모) ?? membership.id.
import { getStoreMembers } from "@/lib/identity-repo";
import { getCrewAggregate } from "@/lib/store";
import type { CrewSummary } from "@/types";

export async function getStoreCrewSummaries(
  storeId: string,
  month: string,
): Promise<CrewSummary[]> {
  const members = await getStoreMembers(storeId);
  return Promise.all(
    members.map(async (m) => {
      const crewId = m.operationalId ?? m.id;
      const name = m.user?.name ?? "멤버";
      return {
        crewId,
        name,
        avatarInitial: name.charAt(0) || "?",
        isManager: m.isManager,
        ...(await getCrewAggregate(crewId, month)),
      };
    }),
  );
}
