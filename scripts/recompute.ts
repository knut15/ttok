// 1회용 데이터 마이그레이션 — 출퇴근 레코드를 "예정 근무시간 기준"으로 재판정한다.
//  · 지각/조퇴/연장: 예정(스케줄표 ScheduleEntry 우선 → FixedShift)과 실제 출퇴근 비교
//  · 대타: 비번(예정 있는 멤버의 근무일 아님)에 출근
//  · 휴게: 법정 자동(4h 미만 0 / 8h 미만 30 / 이상 60), work = gross − 휴게
//  · 대타는 스케줄표(ScheduleEntry substitute)에도 동기화
//
// 실행: DATABASE_URL="<대상 DB URL>" npx tsx scripts/recompute.ts
//   - dev:  이미 적용됨(앱과 동일 .env)
//   - prod: Vercel 환경변수 DATABASE_URL_UNPOOLED 값을 넣어 1회 실행
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const parseHHMM = (t: string | null): number => {
  if (!t) return NaN;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const weekdayOf = (d: string): number => {
  const [y, mo, da] = d.split("-").map(Number);
  return new Date(y, mo - 1, da).getDay();
};
const legalBreak = (g: number): number => (g >= 480 ? 60 : g >= 240 ? 30 : 0);

async function main() {
  const fixedShifts = await p.fixedShift.findMany();
  const entries = await p.scheduleEntry.findMany();
  const members = await p.membership.findMany({ where: { active: true } });
  const storeOf: Record<string, string> = {};
  for (const m of members) storeOf[m.operationalId ?? m.id] = m.storeId;

  const rs = await p.attendanceRecord.findMany();
  let recomputed = 0;
  let synced = 0;

  for (const r of rs) {
    if (r.status === "휴가" || r.status === "결근" || !r.clockIn) continue;

    // 예정 근무시간: 스케줄표(ScheduleEntry) 우선 → 고정근무(FixedShift) 폴백
    let sched: { s: number; e: number } | null = null;
    let offDay = false;
    const entry = entries.find((x) => x.crewId === r.crewId && x.date === r.date);
    if (entry) {
      if (entry.off) offDay = true;
      else sched = { s: parseHHMM(entry.startTime), e: parseHHMM(entry.endTime) };
    } else {
      const all = fixedShifts.filter((f) => f.crewId === r.crewId);
      const fs = all.find((f) => f.weekdays.includes(weekdayOf(r.date)));
      sched = fs ? { s: parseHHMM(fs.startTime), e: parseHHMM(fs.endTime) } : null;
      offDay = !sched && all.length > 0;
    }

    const inM = parseHHMM(r.clockIn);
    const outM = r.clockOut ? parseHHMM(r.clockOut) : NaN;
    const ci = sched && !Number.isNaN(inM) && inM > sched.s ? "지각" : "정상";
    let co = "정상";
    let ot = 0;
    if (sched && !Number.isNaN(outM)) {
      if (outM > sched.e) {
        co = "연장";
        ot = outM - sched.e;
      } else if (outM < sched.e) co = "조퇴";
    }
    let status: string;
    if (offDay) status = "대타";
    else if (co === "연장") status = "연장";
    else if (co === "조퇴") status = "조퇴";
    else if (ci === "지각") status = "지각";
    else status = "정상";

    const gross = r.clockOut ? Math.max(0, outM - inM) : 0;
    const brk = legalBreak(gross);
    const work = r.clockOut ? Math.max(0, gross - brk) : 0;

    await p.attendanceRecord.update({
      where: { crewId_date: { crewId: r.crewId, date: r.date } },
      data: { clockInStatus: ci, clockOutStatus: co, overtimeMinutes: ot, workMinutes: work, breakMinutes: brk, status },
    });
    recomputed++;

    // 대타 → 스케줄표(ScheduleEntry substitute) 동기화
    if (status === "대타" && r.clockOut) {
      const storeId = storeOf[r.crewId];
      if (storeId) {
        await p.scheduleEntry.upsert({
          where: { crewId_date: { crewId: r.crewId, date: r.date } },
          create: { storeId, crewId: r.crewId, date: r.date, startTime: r.clockIn, endTime: r.clockOut, off: false, substitute: true, approval: "수락", createdBy: r.crewId },
          update: { startTime: r.clockIn, endTime: r.clockOut, off: false, substitute: true, approval: "수락" },
        });
        synced++;
      }
    }
  }

  console.log(`재판정 ${recomputed}건 · 대타 스케줄 동기화 ${synced}건`);
}

main()
  .then(() => p.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await p.$disconnect();
    process.exit(1);
  });
