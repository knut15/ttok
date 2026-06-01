// 데모 시드 — dev 우회 로그인이 기존 인메모리 시드 데이터로 바로 착지하도록
// 데모 매장 + 멤버십(operationalId 브리지)을 만든다. idempotent(upsert).
// 운영 데이터(출퇴근/스케줄)는 여전히 인메모리 store 가 진실원 — 여긴 신원만 영속.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 인메모리 시드(src/lib/seed.ts)의 personas 와 operationalId(crewId) 일치.
const DEMO_STORE = {
  operationalId: "store-demo",
  name: "매머드커피 익스프레스 마석경춘로점",
  bizNumber: "2208162517", // 데모(체크섬 유효). dev 에서는 검증 생략.
};

const DEMO_MEMBERS = [
  { operationalId: "master-1", name: "박점주", email: "owner@crewmon.local", role: "master", isManager: false },
  { operationalId: "crew-minjung", name: "김민정", email: "minjung@crewmon.local", role: "crew", isManager: true },
  { operationalId: "crew-2", name: "이서연", email: "seoyeon@crewmon.local", role: "crew", isManager: false },
  { operationalId: "crew-3", name: "박지훈", email: "jihun@crewmon.local", role: "crew", isManager: false },
  { operationalId: "crew-4", name: "최유진", email: "yujin@crewmon.local", role: "crew", isManager: false },
] as const;

async function main() {
  const store = await prisma.store.upsert({
    where: { operationalId: DEMO_STORE.operationalId },
    update: { name: DEMO_STORE.name },
    create: {
      name: DEMO_STORE.name,
      bizNumber: DEMO_STORE.bizNumber,
      bizVerified: true,
      operationalId: DEMO_STORE.operationalId,
    },
  });

  for (const m of DEMO_MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name },
      create: { email: m.email, name: m.name },
    });
    await prisma.membership.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: { role: m.role, isManager: m.isManager, operationalId: m.operationalId },
      create: {
        userId: user.id,
        storeId: store.id,
        role: m.role,
        isManager: m.isManager,
        operationalId: m.operationalId,
        active: true,
      },
    });
  }

  console.log(`Seeded demo store(${store.id}) + ${DEMO_MEMBERS.length} memberships.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
