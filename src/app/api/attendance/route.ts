// GET 월간 조회(AC-6) / PATCH 상태변경(AC-8). architect §2.3.
import { NextResponse } from "next/server";
import {
  getMonthRecords,
  updateStatus,
  setClockInStatus,
  setClockOutStatus,
  upsertTodayClock,
} from "@/lib/store";
import type { ClockInStatus, ClockOutStatus, WorkStatus } from "@/types";
import { WORK_STATUSES } from "@/lib/constants";

const CLOCK_IN_STATUSES: readonly ClockInStatus[] = ["정상", "지각", "결근", "휴가"];
const CLOCK_OUT_STATUSES: readonly ClockOutStatus[] = ["정상", "연장"];
import { parseHHMM } from "@/lib/time";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  // T8-4: 헤더 scope → 멤버 본인 강제, 마스터는 ?crewId 허용.
  const scoped = enforceReadScope(
    await resolveScope(request),
    url.searchParams.get("crewId") ?? undefined,
  );
  const records = await getMonthRecords(month, scoped);
  return NextResponse.json(records, { headers: NO_STORE });
}

export async function PATCH(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  // T8-4: 변경 대상도 본인 강제(멤버)/마스터 target.
  const scoped = enforceReadScope(
    await resolveScope(request),
    url.searchParams.get("crewId") ?? undefined,
  );
  if (!date) {
    return NextResponse.json(
      { error: "date 쿼리가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const body = (await request.json()) as {
    status?: WorkStatus;
    clockInStatus?: ClockInStatus;
    clockOutStatus?: ClockOutStatus;
    field?: "clockIn" | "clockOut";
    time?: string;
  };

  // 출근 상태 변경(독립).
  if (body.clockInStatus !== undefined) {
    if (!CLOCK_IN_STATUSES.includes(body.clockInStatus)) {
      return NextResponse.json({ error: "유효한 출근 상태가 아닙니다." }, { status: 400, headers: NO_STORE });
    }
    const updated = await setClockInStatus(date, body.clockInStatus, scoped);
    if (!updated) {
      return NextResponse.json({ error: "해당 날짜 레코드가 없습니다." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(updated, { headers: NO_STORE });
  }

  // 퇴근 상태 변경(독립).
  if (body.clockOutStatus !== undefined) {
    if (!CLOCK_OUT_STATUSES.includes(body.clockOutStatus)) {
      return NextResponse.json({ error: "유효한 퇴근 상태가 아닙니다." }, { status: 400, headers: NO_STORE });
    }
    const updated = await setClockOutStatus(date, body.clockOutStatus, scoped);
    if (!updated) {
      return NextResponse.json({ error: "해당 날짜 레코드가 없습니다." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(updated, { headers: NO_STORE });
  }

  // 쟁점 C: 출/퇴근 토글 — 현재 시각(client new Date()) 기록.
  if (body.field === "clockIn" || body.field === "clockOut") {
    if (!body.time || Number.isNaN(parseHHMM(body.time))) {
      return NextResponse.json(
        { error: "유효한 time(HH:MM)이 필요합니다." },
        { status: 400, headers: NO_STORE },
      );
    }
    const next = await upsertTodayClock(date, body.field, body.time, scoped);
    return NextResponse.json(next, { headers: NO_STORE });
  }

  if (!body.status || !WORK_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "유효한 status 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const updated = await updateStatus(date, body.status, scoped);
  if (!updated) {
    return NextResponse.json(
      { error: "해당 날짜 레코드가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(updated, { headers: NO_STORE });
}
