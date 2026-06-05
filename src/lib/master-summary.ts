// 마스터 집계 브리지(server-only): Prisma 멤버십(신원) + 인메모리 운영집계 결합.
// 합류한 실제 멤버가 마스터 화면에 보이도록 — crewId=operationalId(데모) ?? membership.id.
import { getStoreMembers } from "@/lib/identity-repo";
import { prisma } from "@/lib/prisma";
import type { CrewSummary } from "@/types";

export async function getStoreCrewSummaries(
  storeId: string,
  month: string,
): Promise<CrewSummary[]> {
  const members = await getStoreMembers(storeId);
  const crewIds = members.map((m) => m.operationalId ?? m.id);
  const aggregates = await prisma.attendanceRecord.groupBy({
    by: ["crewId", "status"],
    where: {
      crewId: { in: crewIds },
      date: { startsWith: month },
    },
    _sum: {
      workMinutes: true,
      overtimeMinutes: true,
    },
    _count: {
      _all: true,
    },
  });
  const byCrew = new Map<
    string,
    { workMinutes: number; overtimeMinutes: number; vacationDays: number }
  >();

  for (const row of aggregates) {
    const current = byCrew.get(row.crewId) ?? {
      workMinutes: 0,
      overtimeMinutes: 0,
      vacationDays: 0,
    };
    current.workMinutes += row._sum.workMinutes ?? 0;
    current.overtimeMinutes += row._sum.overtimeMinutes ?? 0;
    if (row.status === "휴가") current.vacationDays += row._count._all;
    byCrew.set(row.crewId, current);
  }

  return members.map((m) => {
    const crewId = m.operationalId ?? m.id;
    const name = m.user?.name ?? "멤버";
    return {
      crewId,
      name,
      avatarInitial: name.charAt(0) || "?",
      isManager: m.isManager,
      ...(byCrew.get(crewId) ?? {
        workMinutes: 0,
        overtimeMinutes: 0,
        vacationDays: 0,
      }),
    };
  });
}
