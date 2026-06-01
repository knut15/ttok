// /api/schedule (T18) — 스케쥴 조회/작성.
// GET ?month=YYYY-MM → 200 ScheduleResponse. 읽기는 인증 사용자 전원 허용(근무자도 본인 스케쥴 확인).
// POST { date, crewId, startTime, endTime, off? } → 작성/수정. canWriteSchedule(master/매니저)만, 아니면 403.
//   "근무자별 시간" 모델: (date, crewId) 당 1건 upsert. createdBy = 작성자 scope.crewId.
// client 는 route 경유로만 store 접근.
import { NextResponse } from "next/server";
import {
  canWriteSchedule,
  getMonthSchedules,
  listCrews,
  upsertSchedule,
} from "@/lib/store";
import { readScope } from "@/lib/scope";
import { isValidDateString } from "@/lib/date";
import { parseHHMM } from "@/lib/time";
import { SEED_MONTH } from "@/lib/constants";
import type { ScheduleResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") ?? SEED_MONTH;
  const payload: ScheduleResponse = {
    month,
    entries: getMonthSchedules(month),
    canWrite: canWriteSchedule(readScope(request)),
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
  const scope = readScope(request);
  // 작성권한 게이트(서버 단일 진실원). master 또는 매니저 crew 만.
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
  // 배정 대상은 실재하는 근무자(crew 역할)만.
  if (
    typeof crewId !== "string" ||
    !listCrews().some((c) => c.id === crewId && c.role === "crew")
  ) {
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

  const entry = upsertSchedule({
    date,
    crewId,
    startTime: off ? "00:00" : startTime,
    endTime: off ? "00:00" : endTime,
    off,
    createdBy: scope.crewId,
  });
  return NextResponse.json(entry, { headers: NO_STORE });
}
