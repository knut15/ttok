// POST 수정요청 수락(AC-8). body {id} → approveRequest → 200 {request,record} / 404 / 400.
// T8-7: 수락은 마스터 전용(AC-18/19). 크루 → 403 + store 불변(approveRequest 미호출).
import { NextResponse } from "next/server";
import { approveRequest } from "@/lib/store";
import { readScope } from "@/lib/scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  // 마스터 게이트(UI 숨김과 이중 방어). role≠master → 403, store 불변.
  if (readScope(request).role !== "master") {
    return NextResponse.json(
      { error: "수락 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  const body = (await request.json()) as { id?: string };

  if (!body.id) {
    return NextResponse.json(
      { error: "id 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = approveRequest(body.id);
  if (!result) {
    return NextResponse.json(
      { error: "존재하지 않는 요청입니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  // 유효 대기 수락 + Q2 멱등 no-op 모두 200(architect §2.2).
  return NextResponse.json(result, { status: 200, headers: NO_STORE });
}
