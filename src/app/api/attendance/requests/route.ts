// GET 수정요청 내역 / POST 수정요청 생성(AC-9). 빈 사유 400(엣지#6).
import { NextResponse } from "next/server";
import { addRequest, listRequests } from "@/lib/store";
import type { EditRequestChange } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
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

  const created = addRequest({
    date: body.date,
    reason: body.reason.trim().slice(0, 100),
    after: body.after,
  });
  return NextResponse.json(created, { status: 201, headers: NO_STORE });
}
