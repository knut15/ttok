// GET /api/crews → 200 Crew[] — 요청자 매장의 근무자 메타(스케줄 picker 등). Prisma.
import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/session-scope";
import { resolveStoreId, listStoreCrews } from "@/lib/identity-repo";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const storeId = await resolveStoreId(await resolveScope(request));
  const crews = storeId ? await listStoreCrews(storeId) : [];
  return NextResponse.json(crews, { headers: NO_STORE });
}
