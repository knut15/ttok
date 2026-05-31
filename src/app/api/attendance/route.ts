// GET 월간 조회(AC-6) / PATCH 상태변경(AC-8). architect §2.3.
import { NextResponse } from "next/server";
import { getMonthRecords, updateStatus } from "@/lib/store";
import type { WorkStatus } from "@/types";
import { WORK_STATUSES } from "@/lib/constants";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const month =
    new URL(request.url).searchParams.get("month") ?? "";
  const records = getMonthRecords(month);
  return NextResponse.json(records, { headers: NO_STORE });
}

export async function PATCH(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { error: "date 쿼리가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const body = (await request.json()) as { status?: WorkStatus };
  if (!body.status || !WORK_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "유효한 status 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const updated = updateStatus(date, body.status);
  if (!updated) {
    return NextResponse.json(
      { error: "해당 날짜 레코드가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(updated, { headers: NO_STORE });
}
