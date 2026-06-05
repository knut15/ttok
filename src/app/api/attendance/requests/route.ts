// GET 수정요청 내역 / POST 수정요청 생성(AC-9). 빈 사유 400(엣지#6).
import { NextResponse } from "next/server";
import { addRequest, listRequests } from "@/lib/attendance-store";
import { DEFAULT_CREW_ID } from "@/lib/constants";
import { WORK_STATUSES } from "@/lib/constants";
import { parseHHMM } from "@/lib/time";
import { todayDate } from "@/lib/date";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope } from "@/lib/session-scope";
import type { EditRequestChange, WorkStatus } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request?: Request): Promise<Response> {
  // 본인(또는 마스터의 ?crewId 대상) 수정요청만. 마스터 전체 열람은 /api/master/requests.
  if (!request) {
    return NextResponse.json(await listRequests(DEFAULT_CREW_ID), { headers: NO_STORE });
  }
  const scoped = enforceReadScope(
    await resolveScope(request),
    new URL(request.url).searchParams.get("crewId") ?? undefined,
  );
  return NextResponse.json(await listRequests(scoped), { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    date?: string;
    reason?: string;
    after?: EditRequestChange;
  };

  if (!body.date || !body.after) {
    return NextResponse.json(
      { error: "date 와 after 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!body.reason || body.reason.trim().length === 0) {
    return NextResponse.json(
      { error: "사유를 입력해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  // Q3(T15): 미래 날짜 추가/수정요청 서버 방어. "YYYY-MM-DD" 사전식 비교(zero-pad 보장).
  // 과거/오늘만 허용 — 누락 보정의 의미상 미래 사전 등록은 범위 밖(폼 미노출 + 서버 이중 방어).
  if (body.date > todayDate()) {
    return NextResponse.json(
      { error: "미래 날짜는 추가할 수 없습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  // E-8: after 형식 검증. status 가 유효 WorkStatus 가 아니면 400.
  if (!WORK_STATUSES.includes(body.after.status as WorkStatus)) {
    return NextResponse.json(
      { error: "유효한 출근상태가 아닙니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  // after 는 status·clockIn·clockOut 3필드 완전체 요구(v3 P1).
  // undefined 누락 차단: undefined != null 이 JS 에서 false 라 검증 스킵되던 결함 방지.
  // clockIn/clockOut 은 null 허용, 명시값이면 "HH:MM" 형식이어야 한다(NaN → 400).
  for (const clock of [body.after.clockIn, body.after.clockOut]) {
    if (clock === undefined) {
      return NextResponse.json(
        { error: "출퇴근 시각 필드(clockIn/clockOut)가 필요합니다." },
        { status: 400, headers: NO_STORE },
      );
    }
    if (clock !== null && Number.isNaN(parseHHMM(clock))) {
      return NextResponse.json(
        { error: "출퇴근 시각 형식이 올바르지 않습니다." },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  // Q5(T15): clockIn·clockOut 둘 다 명시(non-null)이고 clockOut<=clockIn(역전·동일)이면 400.
  // 진입 가드(둘 다 non-null)라 기존 휴게·clockOut-null 요청은 미진입 → 회귀 0. NaN 은 위 루프 선차단.
  if (body.after.clockIn != null && body.after.clockOut != null) {
    if (parseHHMM(body.after.clockOut) <= parseHHMM(body.after.clockIn)) {
      return NextResponse.json(
        { error: "퇴근 시각이 출근보다 빠르거나 같습니다." },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  // T7: after 에 휴게 범위가 있으면(optional) HH:MM 형식 검증(NaN → 400).
  // 미명시면 분기 진입 안 함 → 기존 동작·멱등 보존(R2).
  for (const bound of [body.after.breakStart, body.after.breakEnd]) {
    if (bound !== undefined && Number.isNaN(parseHHMM(bound))) {
      return NextResponse.json(
        { error: "휴게 시각 형식이 올바르지 않습니다." },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  // P2-1(architect §2.7): breakStart/breakEnd 가 둘 다 명시된 경우 역전·동일(end<=start) 거부.
  // 한쪽만 명시/미명시는 분기 진입 안 함 → 기존 동작 보존(R2 멱등). NaN 은 위 루프에서 선차단.
  if (body.after.breakStart !== undefined && body.after.breakEnd !== undefined) {
    if (parseHHMM(body.after.breakEnd) <= parseHHMM(body.after.breakStart)) {
      return NextResponse.json(
        { error: "휴게 종료가 시작보다 빠르거나 같습니다." },
        { status: 400, headers: NO_STORE },
      );
    }
  }

  // AC-9: 요청은 항상 생성자 본인 crewId 로 태그(scope.crewId, 헤더 없으면 김민정).
  const created = await addRequest({
    date: body.date,
    reason: body.reason.trim().slice(0, 100),
    after: body.after,
    crewId: (await resolveScope(request)).crewId,
  });
  return NextResponse.json(created, { status: 201, headers: NO_STORE });
}
