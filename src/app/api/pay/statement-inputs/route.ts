// PUT /api/pay/statement-inputs — 급여명세서 입력값 저장(마스터 전용).
// body: { month, crewId, incentiveEnabled, monthlySales, incomeTax, nightPay }.
// 멤버는 저장 불가(403) — 완성본 조회만. 조회는 GET /api/pay 의 statementInputs 로 제공.
import { NextResponse } from "next/server";
import { savePayslipInput } from "@/lib/payslip-input-store";
import { resolveScope } from "@/lib/session-scope";
import type { PayslipInputs } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

interface PutBody {
  month?: unknown;
  crewId?: unknown;
  incentiveEnabled?: unknown;
  monthlySales?: unknown;
  incomeTax?: unknown;
  nightPay?: unknown;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function PUT(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  // 입력 권한 게이트: 마스터만.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "명세서 입력 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as PutBody | null;
  const month = body?.month;
  const crewId = body?.crewId;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "유효한 월(month=YYYY-MM)이 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (typeof crewId !== "string" || crewId.length === 0) {
    return NextResponse.json(
      { error: "대상 근무자(crewId)가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const inputs: PayslipInputs = {
    incentiveEnabled: body?.incentiveEnabled === true,
    monthlySales: num(body?.monthlySales),
    incomeTax: num(body?.incomeTax),
    nightPay: num(body?.nightPay),
  };
  const saved = await savePayslipInput(crewId, month, inputs);
  return NextResponse.json(saved, { headers: NO_STORE });
}
