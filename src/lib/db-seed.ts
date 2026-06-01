// 데모 운영 데이터 Prisma 시드(server-only). 런타임 seed + 테스트 reseed 공용.
// 기존 순수 builder(seed.ts)를 재사용 → 계산값·불변식(차감440/연장544/주휴) 동일성 보존.
// crewId = operationalId(crew-minjung 등). storeId = 데모 매장.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildSeedRecordsByCrew,
  buildSeedSchedules,
  buildSeedFixedShifts,
  buildSeedProfile,
  buildSeedCrews,
} from "./seed";
import { SEED_JOIN_DATE, SEED_WORK_DAYS, SEED_WORK_TIME, STORE_NAME } from "./constants";

const DEMO_STORE = { operationalId: "store-demo", bizNumber: "2208162517" };
const DEMO_MEMBERS = [
  { operationalId: "master-1", name: "박점주", email: "owner@crewmon.local", role: "master", isManager: false },
  { operationalId: "crew-minjung", name: "김민정", email: "minjung@crewmon.local", role: "crew", isManager: true },
  { operationalId: "crew-2", name: "이서연", email: "seoyeon@crewmon.local", role: "crew", isManager: false },
  { operationalId: "crew-3", name: "박지훈", email: "jihun@crewmon.local", role: "crew", isManager: false },
  { operationalId: "crew-4", name: "최유진", email: "yujin@crewmon.local", role: "crew", isManager: false },
] as const;

/**
 * 데모 신원(매장+유저+멤버십) 시드. idempotent(upsert) — isManager 등 가변 필드를 시드값으로 리셋.
 * 반환 storeId 로 운영 시드를 적재. 런타임 seed + 테스트 globalSetup/beforeEach 공용.
 */
export async function seedDemoIdentity(prisma: PrismaClient): Promise<string> {
  const fields = { name: STORE_NAME, joinDate: SEED_JOIN_DATE, workDays: SEED_WORK_DAYS, workTime: SEED_WORK_TIME };
  const store = await prisma.store.upsert({
    where: { operationalId: DEMO_STORE.operationalId },
    update: fields,
    create: { ...fields, bizNumber: DEMO_STORE.bizNumber, bizVerified: true, operationalId: DEMO_STORE.operationalId },
  });
  for (const m of DEMO_MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name },
      create: { email: m.email, name: m.name },
    });
    await prisma.membership.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: { role: m.role, isManager: m.isManager, operationalId: m.operationalId, active: true },
      create: { userId: user.id, storeId: store.id, role: m.role, isManager: m.isManager, operationalId: m.operationalId, active: true },
    });
  }
  return store.id;
}

/**
 * 테스트 리셋(싱글톤 prisma) — 신원 시드(isManager 등 가변필드 리셋) + 운영 truncate + 운영 재시드.
 * 각 store/route 테스트의 beforeEach 에서 호출(기존 __resetStore 대체). 데모 storeId 반환.
 */
export async function resetDb(): Promise<string> {
  const storeId = await seedDemoIdentity(prisma);
  await truncateOperational(prisma);
  await seedDemoOperational(prisma, storeId);
  return storeId;
}

/** 운영 테이블 전부 비우기(테스트 reset). 신원(Store/Membership/User)은 보존. */
export async function truncateOperational(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AttendanceRecord","EditRequest","ScheduleEntry","FixedShift","Notification","Profile" RESTART IDENTITY CASCADE',
  );
}

/** 데모 매장(storeId)에 운영 데이터 적재. 기존 데모 운영행 삭제 후 재삽입(idempotent). */
export async function seedDemoOperational(prisma: PrismaClient, storeId: string): Promise<void> {
  // 멤버(crew) 메타 — crewId(operationalId)·이름·아바타.
  const crews = buildSeedCrews().filter((c) => c.role === "crew");

  // 프로필: 김민정은 전체, 나머지는 메타 기반(빈 연락처).
  const minjung = buildSeedProfile();
  const profiles = crews.map((c) =>
    c.id === "crew-minjung"
      ? { storeId, crewId: c.id, ...minjung }
      : { storeId, crewId: c.id, name: c.name, birthDate: "", phone: "", email: "", avatarInitial: c.avatarInitial },
  );

  // 출퇴근: Map<crewId, Map<date, rec>> 평탄화.
  const records: {
    storeId: string; crewId: string; date: string; status: string;
    clockIn: string | null; clockOut: string | null; breakMinutes: number;
    breakStart: string | null; breakEnd: string | null;
    workMinutes: number; overtimeMinutes: number; deductMinutes: number;
  }[] = [];
  for (const [crewId, byDate] of buildSeedRecordsByCrew()) {
    for (const r of byDate.values()) {
      records.push({
        storeId, crewId, date: r.date, status: r.status,
        clockIn: r.clockIn, clockOut: r.clockOut, breakMinutes: r.breakMinutes,
        breakStart: r.breakStart ?? null, breakEnd: r.breakEnd ?? null,
        workMinutes: r.workMinutes, overtimeMinutes: r.overtimeMinutes, deductMinutes: r.deductMinutes,
      });
    }
  }

  // 스케줄(명시 manual): Map<date, entries[]> 평탄화. source(fixed 파생)는 저장 안 함.
  const schedules: {
    storeId: string; crewId: string; date: string; startTime: string; endTime: string;
    off: boolean; createdBy: string; substitute: boolean; approval: string | null;
  }[] = [];
  for (const list of buildSeedSchedules().values()) {
    for (const e of list) {
      schedules.push({
        storeId, crewId: e.crewId, date: e.date, startTime: e.startTime, endTime: e.endTime,
        off: e.off ?? false, createdBy: e.createdBy, substitute: e.substitute ?? false,
        approval: e.approval ?? null,
      });
    }
  }

  const fixedShifts = buildSeedFixedShifts().map((f) => ({
    storeId, crewId: f.crewId, weekdays: f.weekdays, startTime: f.startTime, endTime: f.endTime,
  }));

  // 데모 매장의 기존 운영행 삭제(런타임 재시드 idempotent).
  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { storeId } }),
    prisma.scheduleEntry.deleteMany({ where: { storeId } }),
    prisma.fixedShift.deleteMany({ where: { storeId } }),
    prisma.profile.deleteMany({ where: { storeId } }),
    prisma.editRequest.deleteMany({ where: { storeId } }),
    prisma.notification.deleteMany({ where: { storeId } }),
  ]);

  await prisma.$transaction([
    prisma.profile.createMany({ data: profiles }),
    prisma.attendanceRecord.createMany({ data: records }),
    prisma.scheduleEntry.createMany({ data: schedules }),
    prisma.fixedShift.createMany({ data: fixedShifts }),
  ]);
}
