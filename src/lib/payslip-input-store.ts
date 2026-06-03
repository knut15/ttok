// 급여명세서 입력값 데이터 계층(Prisma 단일 진실원). (crewId, month) 키.
// 마스터만 save, 멤버는 get(완성본 조회). 저장 전이면 기본값(인센티브 off, 0).
import { prisma } from "./prisma";
import { storeIdForCrew } from "./identity-repo";
import type { PayslipInputs } from "@/types";

/** 저장값 없을 때의 기본 입력(인센티브 미포함). */
export const DEFAULT_PAYSLIP_INPUTS: PayslipInputs = {
  incentiveEnabled: false,
  monthlySales: 0,
  incomeTax: 0,
  nightPay: 0,
};

function toInputs(row: {
  incentiveEnabled: boolean;
  monthlySales: number;
  incomeTax: number;
  nightPay: number;
}): PayslipInputs {
  return {
    incentiveEnabled: row.incentiveEnabled,
    monthlySales: row.monthlySales,
    incomeTax: row.incomeTax,
    nightPay: row.nightPay,
  };
}

/** (crewId, month) 명세서 입력값. 없으면 기본값. */
export async function getPayslipInput(crewId: string, month: string): Promise<PayslipInputs> {
  const row = await prisma.payslipInput.findUnique({ where: { crewId_month: { crewId, month } } });
  return row ? toInputs(row) : { ...DEFAULT_PAYSLIP_INPUTS };
}

/** 입력값 upsert(마스터 전용 경로에서 호출). 음수 방어 후 저장. storeId 는 crewId 에서 해석. */
export async function savePayslipInput(
  crewId: string,
  month: string,
  inputs: PayslipInputs,
): Promise<PayslipInputs> {
  const storeId = await storeIdForCrew(crewId);
  if (!storeId) throw new Error(`storeId not found for crewId=${crewId}`);

  const data = {
    incentiveEnabled: inputs.incentiveEnabled,
    monthlySales: Math.max(0, Math.round(inputs.monthlySales)),
    incomeTax: Math.max(0, Math.round(inputs.incomeTax)),
    nightPay: Math.max(0, Math.round(inputs.nightPay)),
  };
  const row = await prisma.payslipInput.upsert({
    where: { crewId_month: { crewId, month } },
    update: data,
    create: { storeId, crewId, month, ...data },
  });
  return toInputs(row);
}
