// DELETE /api/schedule/[id] (T18) — 스케쥴 배정 삭제.
// canWriteSchedule(master/매니저)만 가능, 아니면 403. 없는 id → 404. client 는 route 경유.
import { NextResponse } from "next/server";
import { canWriteSchedule, removeSchedule } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!canWriteSchedule((await resolveScope(request)))) {
    return NextResponse.json(
      { error: "스케쥴 삭제 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  const { id } = await ctx.params;
  if (!(await removeSchedule(id))) {
    return NextResponse.json(
      { error: "대상 스케쥴을 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
