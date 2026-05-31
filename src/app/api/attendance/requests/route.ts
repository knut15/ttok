// GET 수정요청 내역 / POST 수정요청 생성(AC-9). 빈 사유 400(엣지#6).
import { NextResponse } from "next/server";
import { addRequest, listRequests } from "@/lib/store";
import { WORK_STATUSES } from "@/lib/constants";
import { parseHHMM } from "@/lib/time";
import type { EditRequestChange, WorkStatus } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_request?: Request): Promise<Response> {
  void _request;
  return NextResponse.json(listRequests(), { headers: NO_STORE });
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

  const created = addRequest({
    date: body.date,
    reason: body.reason.trim().slice(0, 100),
    after: body.after,
  });
  return NextResponse.json(created, { status: 201, headers: NO_STORE });
}
