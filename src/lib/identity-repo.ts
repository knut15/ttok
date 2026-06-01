// 신원/테넌트 Prisma 래퍼(server-only). 온보딩 API 가 이 함수들만 호출 →
// 비즈니스 로직을 mock 가능하게 격리. 코드 생성/검증/조인의 단일 진실원.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeBizNumber } from "@/lib/biz-number";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@/lib/constants";

/** 현재 사용자의 활성 멤버십(가장 오래된 것 우선 — 단일 매장 전제). */
export function findActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
}

export type CreateStoreError = "duplicate-biz";

/**
 * 마스터 가입: Store + master Membership 트랜잭션 생성.
 * 사업자번호 중복(@unique 위반) → "duplicate-biz".
 */
export async function createStoreWithMaster(input: {
  userId: string;
  storeName: string;
  bizNumber: string;
  bizVerified: boolean;
}) {
  const bizNumber = normalizeBizNumber(input.bizNumber);
  try {
    return await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: { name: input.storeName, bizNumber, bizVerified: input.bizVerified },
      });
      const membership = await tx.membership.create({
        data: { userId: input.userId, storeId: store.id, role: "master", active: true },
      });
      return { store, membership };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return "duplicate-biz" as const;
    }
    throw e;
  }
}

export type JoinError = "invalid" | "used" | "already-member";

/**
 * 초대코드 합류: 유효·미사용 코드면 crew Membership 생성 + invite "사용" 전이.
 * 없는 코드 → "invalid", 이미 사용 → "used", 이미 그 매장 멤버 → "already-member".
 */
export async function joinByInviteCode(input: { userId: string; code: string }) {
  const code = input.code.trim().toUpperCase();
  const invite = await prisma.invite.findUnique({ where: { code } });
  if (!invite) return "invalid" as const;
  if (invite.status !== "대기") return "used" as const;

  const exists = await prisma.membership.findUnique({
    where: { userId_storeId: { userId: input.userId, storeId: invite.storeId } },
  });
  if (exists) return "already-member" as const;

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: { userId: input.userId, storeId: invite.storeId, role: "crew", active: true },
    });
    await tx.invite.update({
      where: { code },
      data: { status: "사용", usedByUser: input.userId },
    });
    return { membership, storeId: invite.storeId };
  });
}

/** 혼동문자 제외 알파벳으로 초대코드 생성(인메모리 store 와 동일 규칙). */
function generateCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** 매장 초대코드 발급(마스터). 코드 충돌 시 최대 5회 재시도. */
export async function createInviteForStore(input: { storeId: string; createdBy: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await prisma.invite.findUnique({ where: { code } })) continue;
    return prisma.invite.create({
      data: { code, storeId: input.storeId, createdBy: input.createdBy, status: "대기" },
    });
  }
  // 충돌 가드 소진 시 타임스탬프 기반 보장.
  const code = `INV${Date.now().toString(36).toUpperCase()}`;
  return prisma.invite.create({
    data: { code, storeId: input.storeId, createdBy: input.createdBy, status: "대기" },
  });
}
