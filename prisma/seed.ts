// 데모 시드 — 신원(매장/유저/멤버십) + 운영 데이터(출퇴근/스케줄/고정근무/프로필)를 Prisma에 적재.
// dev 우회 로그인이 데모 데이터로 바로 착지. idempotent.
import { PrismaClient } from "@prisma/client";
import { seedDemoIdentity, seedDemoOperational } from "../src/lib/db-seed";

const prisma = new PrismaClient();

async function main() {
  const storeId = await seedDemoIdentity(prisma);
  await seedDemoOperational(prisma, storeId);
  console.log(`Seeded demo store(${storeId}) + 멤버십 + 운영데이터.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
