// /api/schedule/fixed — 크루별 고정 근무 등록/해제.
// canWrite(master/매니저)만. POST { crewId, dayType, startTime, endTime } 로 upsert,
// DELETE { crewId, dayType } 로 해제. 고정 시프트는 해당 요일유형 운영시간 내여야 함.
import { NextResponse } from "next/server";
import { canWriteSchedule, listCrews, setFixedShift, removeFixedShift } from "@/lib/store";
import { readScope } from "@/lib/scope";
import { getOperatingHoursByType } from "@/lib/schedule";
import { parseHHMM } from "@/lib/time";
import type { DayType } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };
const DAY_TYPES: DayType[] = ["weekday", "weekend"];

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
  dayType?: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const crewId = body?.crewId;
  const dayType = body?.dayType as DayType;
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
  if (!DAY_TYPES.includes(dayType)) {
    return NextResponse.json(
      { error: "dayType 은 weekday/weekend 여야 합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  // 운영시간 내 + 종료>시작 검증.
  const op = getOperatingHoursByType(dayType);
  const s = parseHHMM(startTime);
  const e = parseHHMM(endTime);
  if (
    Number.isNaN(s) ||
    Number.isNaN(e) ||
    e <= s ||
    s < parseHHMM(op.open) ||
    e > parseHHMM(op.close)
  ) {
    return NextResponse.json(
      { error: `운영시간(${op.open}~${op.close}) 내 시작<종료 시간이어야 합니다.` },
      { status: 400, headers: NO_STORE },
    );
  }

  const shift = setFixedShift({ crewId, dayType, startTime, endTime });
  return NextResponse.json(shift, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Body | null;
  const crewId = body?.crewId;
  const dayType = body?.dayType as DayType;
  if (typeof crewId !== "string" || !DAY_TYPES.includes(dayType)) {
    return NextResponse.json(
      { error: "crewId, dayType 이 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!removeFixedShift(crewId, dayType)) {
    return NextResponse.json(
      { error: "해당 고정 근무가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
