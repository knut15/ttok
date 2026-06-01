// /api/schedule/fixed — 멤버별 고정 근무 블록 추가/삭제(멤버당 여러 블록).
// canWrite(master/매니저)만. POST { crewId, weekdays:number[], startTime, endTime } 로 블록 추가
// (한 멤버 안에서 요일 중복 불가), DELETE { id } 로 블록 삭제.
import { NextResponse } from "next/server";
import {
  canWriteSchedule,
  listCrews,
  listFixedShifts,
  addFixedShift,
  removeFixedShift,
  updateFixedShift,
  crewFixedWeekdays,
} from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import { parseHHMM } from "@/lib/time";

const NO_STORE = { "Cache-Control": "no-store" };

async function gate(request: Request): Promise<Response | null> {
  if (!canWriteSchedule(await resolveScope(request))) {
    return NextResponse.json(
      { error: "고정 근무 등록 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  return null;
}

interface Body {
  id?: unknown;
  crewId?: unknown;
  weekdays?: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const denied = await gate(request);
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
  // 같은 멤버의 기존 블록과 요일이 겹치면 거부(요일당 1블록).
  const used = crewFixedWeekdays(crewId);
  if ((weekdays as number[]).some((w) => used.has(w))) {
    return NextResponse.json(
      { error: "이미 고정 근무가 등록된 요일이 있습니다." },
      { status: 409, headers: NO_STORE },
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

  const block = addFixedShift({ crewId, weekdays: weekdays as number[], startTime, endTime });
  return NextResponse.json(block, { headers: NO_STORE });
}

export async function PATCH(request: Request): Promise<Response> {
  const denied = await gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const id = body?.id;
  const weekdays = body?.weekdays;
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";

  if (typeof id !== "string") {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  const target = listFixedShifts().find((f) => f.id === id);
  if (!target) {
    return NextResponse.json(
      { error: "해당 고정 근무를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
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
  // 같은 멤버의 '다른' 블록 요일과 겹치면 거부(자기 자신 제외).
  const usedByOthers = new Set(
    listFixedShifts()
      .filter((f) => f.crewId === target.crewId && f.id !== id)
      .flatMap((f) => f.weekdays),
  );
  if ((weekdays as number[]).some((w) => usedByOthers.has(w))) {
    return NextResponse.json(
      { error: "이미 고정 근무가 등록된 요일이 있습니다." },
      { status: 409, headers: NO_STORE },
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

  const updated = updateFixedShift(id, { weekdays: weekdays as number[], startTime, endTime });
  return NextResponse.json(updated, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = await gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const id = body?.id;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  if (!removeFixedShift(id)) {
    return NextResponse.json(
      { error: "해당 고정 근무를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
