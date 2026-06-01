// POST /api/invites/join body{code, crewId} → 200 JoinResult (T8-6, AC-14).
// 없는 코드 → 400(E-2), 이미 사용된 코드 → 409(E-2b). 성공 시 멤버 active=true.
import { NextResponse } from "next/server";
import { joinByInvite } from "@/lib/store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { code?: string; crewId?: string };

  if (!body.code || !body.crewId) {
    return NextResponse.json(
      { error: "code 와 crewId 가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = joinByInvite(body.code, body.crewId);
  if (result === null) {
    // E-2: 존재하지 않는 코드 → 400
    return NextResponse.json(
      { error: "존재하지 않는 초대 코드입니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (result === "used") {
    // E-2b: 이미 사용된 코드 → 409
    return NextResponse.json(
      { error: "이미 사용된 초대 코드입니다." },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_STORE });
}
