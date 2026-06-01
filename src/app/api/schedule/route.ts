// /api/schedule — 스케쥴 조회/작성(Prisma).
// GET ?month=YYYY-MM → 200 ScheduleResponse(매장 스코프). 읽기는 인증 사용자 전원(멤버는 본인 것만).
// POST { date, crewId, startTime, endTime, off? } → 작성/수정. canWriteSchedule(master/매니저)만.
//   배정 대상 crewId 는 요청자 매장의 멤버(crew)여야 함(실 멤버 배정 가능).
import { NextResponse } from "next/server";
import {
  canWriteSchedule,
  getMonthScheduleView,
  listFixedShifts,
  upsertSchedule,
} from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import { resolveStoreId, getStoreMembers } from "@/lib/identity-repo";
import { isValidDateString } from "@/lib/date";
import { parseHHMM } from "@/lib/time";
import { SEED_MONTH } from "@/lib/constants";
import type { ScheduleResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") ?? SEED_MONTH;
  const scope = await resolveScope(request);
  const canWrite = canWriteSchedule(scope);
  const storeId = await resolveStoreId(scope);

  const entries = storeId ? await getMonthScheduleView(storeId, month) : [];
  const fixedShifts = storeId ? await listFixedShifts(storeId) : [];

  // 권한 스코프: master/매니저(canWrite)는 매장 전체, 일반 멤버는 본인 것만.
  const payload: ScheduleResponse = {
    month,
    entries: canWrite ? entries : entries.filter((e) => e.crewId === scope.crewId),
    fixedShifts: canWrite ? fixedShifts : fixedShifts.filter((f) => f.crewId === scope.crewId),
    canWrite,
  };
  return NextResponse.json(payload, { headers: NO_STORE });
}

interface PostBody {
  date?: unknown;
  crewId?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  off?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  // 작성권한 게이트. master 또는 매니저 crew 만.
  if (!canWriteSchedule(scope)) {
    return NextResponse.json(
      { error: "스케쥴 작성 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as PostBody | null;
  const date = body?.date;
  const crewId = body?.crewId;
  const off = body?.off === true;
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";

  if (typeof date !== "string" || !isValidDateString(date)) {
    return NextResponse.json(
      { error: "유효한 날짜(date)가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  // 배정 대상은 요청자 매장의 멤버(crew)만.
  const storeId = await resolveStoreId(scope);
  const memberCrewIds = storeId
    ? new Set((await getStoreMembers(storeId)).map((m) => m.operationalId ?? m.id))
    : new Set<string>();
  if (typeof crewId !== "string" || !memberCrewIds.has(crewId)) {
    return NextResponse.json(
      { error: "유효한 근무자(crewId)가 아닙니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  // 휴무가 아니면 시간 검증(형식 + 종료>시작).
  if (!off) {
    const s = parseHHMM(startTime);
    const e = parseHHMM(endTime);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) {
      return NextResponse.json(
        { error: "근무 시간(startTime<endTime)이 올바르지 않습니다." },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  const entry = await upsertSchedule({
    date,
    crewId,
    startTime: off ? "00:00" : startTime,
    endTime: off ? "00:00" : endTime,
    off,
    createdBy: scope.crewId,
    autoApprove: scope.role === "master",
  });
  return NextResponse.json(entry, { headers: NO_STORE });
}
