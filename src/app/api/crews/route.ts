// GET /api/crews → 200 Crew[] (역할전환 목록, architect §2.6). client 는 route 경유로만 store 접근.
import { NextResponse } from "next/server";
import { listCrews } from "@/lib/store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  return NextResponse.json(listCrews(), { headers: NO_STORE });
}
