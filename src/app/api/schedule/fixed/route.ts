// /api/schedule/fixed — 크루별 고정 근무 등록/해제.
// canWrite(master/매니저)만. POST { crewId, weekdays:number[], startTime, endTime } 로 upsert,
// DELETE { crewId } 로 해제. 근무 요일은 일~토(0~6)에서 직접 선택.
import { NextResponse } from "next/server";
import { canWriteSchedule, listCrews, setFixedShift, removeFixedShift } from "@/lib/store";
import { readScope } from "@/lib/scope";
import { parseHHMM } from "@/lib/time";

const NO_STORE = { "Cache-Control": "no-store" };

function gate(request: Request): Response | null {
  if (!canWriteSchedule(readScope(request))) {
    return NextResponse.json(
      { error: "고정 근무 등록 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  return null;
}

interface Body {
  crewId?: unknown;
  weekdays?: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const crewId = body?.crewId;
  const weekdays = body?.weekdays;
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";

  if (
    typeof crewId !== "string" ||
    !listCrews().some((c) => c.id === crewId && c.role === "crew")
  ) {
    return NextResponse.json(
      { error: "유효한 근무자(crewId)가 아닙니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  // 요일: 1개 이상, 모두 0~6 정수.
  if (
    !Array.isArray(weekdays) ||
    weekdays.length === 0 ||
    !weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return NextResponse.json(
      { error: "근무 요일(weekdays, 0~6)을 1개 이상 선택해야 합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const s = parseHHMM(startTime);
  const e = parseHHMM(endTime);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) {
    return NextResponse.json(
      { error: "시작<종료 시간이어야 합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const shift = setFixedShift({ crewId, weekdays: weekdays as number[], startTime, endTime });
  return NextResponse.json(shift, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const crewId = body?.crewId;
  if (typeof crewId !== "string") {
    return NextResponse.json(
      { error: "crewId 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!removeFixedShift(crewId)) {
    return NextResponse.json(
      { error: "해당 고정 근무가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
