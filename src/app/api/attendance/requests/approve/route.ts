// POST 수정요청 수락(AC-8). body {id} → approveRequest → 200 {request,record} / 404 / 400.
import { NextResponse } from "next/server";
import { approveRequest } from "@/lib/store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
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
