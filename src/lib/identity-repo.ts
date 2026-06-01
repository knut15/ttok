// 신원/테넌트 Prisma 래퍼(server-only). 온보딩 API 가 이 함수들만 호출 →
// 비즈니스 로직을 mock 가능하게 격리. 코드 생성/검증/조인의 단일 진실원.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeBizNumber } from "@/lib/biz-number";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_DAYS,
} from "@/lib/constants";

/** 세션 user 가 DB 에 실존하는지(유령/만료 세션 방어 — 예: DB 리셋 후 옛 쿠키). */
export async function userExists(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return u !== null;
}

/** scope 의 매장 id 해석: 세션 storeId 우선, 없으면(헤더/테스트) crewId 로 조회. */
export async function resolveStoreId(scope: {
  storeId?: string;
  crewId: string;
}): Promise<string | null> {
  return scope.storeId ?? storeIdForCrew(scope.crewId);
}

/** crewId(operationalId 또는 membershipId)가 속한 매장 id. 운영행 생성/스코프용. 없으면 null. */
export async function storeIdForCrew(crewId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { OR: [{ operationalId: crewId }, { id: crewId }] },
    select: { storeId: true },
  });
  return m?.storeId ?? null;
}

/** 현재 사용자의 활성 멤버십(가장 오래된 것 우선 — 단일 매장 전제). */
export function findActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 매장 소속 전원의 운영 crewId 집합(operationalId ?? membership.id). master 포함.
 * 인메모리 운영데이터(스케줄 등)를 매장 단위로 필터링하는 데 사용 — 실매장은 데모 시드 미포함.
 */
export async function getStoreCrewIds(storeId: string): Promise<string[]> {
  const ms = await prisma.membership.findMany({
    where: { storeId, active: true },
    select: { operationalId: true, id: true },
  });
  return ms.map((m) => m.operationalId ?? m.id);
}

/** 매장의 멤버(role=crew) 목록 + 사용자(이름). 마스터 집계용. 가입순. */
export function getStoreMembers(storeId: string) {
  return prisma.membership.findMany({
    where: { storeId, role: "crew", active: true },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 매니저 지정/해제(매장 범위). crewKey = operationalId(데모) 또는 membership.id(실멤버).
 * 없으면 null. 성공 시 갱신된 멤버십 반환.
 */
export async function setMembershipManager(
  storeId: string,
  crewKey: string,
  on: boolean,
) {
  const m = await prisma.membership.findFirst({
    where: { storeId, role: "crew", OR: [{ operationalId: crewKey }, { id: crewKey }] },
  });
  if (!m) return null;
  return prisma.membership.update({ where: { id: m.id }, data: { isManager: on } });
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

export type JoinError = "invalid" | "used" | "revoked" | "expired" | "already-member";

/**
 * 초대코드 합류: 유효·미사용·미만료 코드면 crew Membership 생성 + invite "사용" 전이.
 * 없는 코드 → "invalid", 회수 → "revoked", 이미 사용 → "used", 만료 → "expired",
 * 이미 그 매장 멤버 → "already-member".
 */
export async function joinByInviteCode(input: { userId: string; code: string }) {
  const code = input.code.trim().toUpperCase();
  const invite = await prisma.invite.findUnique({ where: { code } });
  if (!invite) return "invalid" as const;
  if (invite.status === "회수") return "revoked" as const;
  if (invite.status !== "대기") return "used" as const;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return "expired" as const;
  }

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

/** now + INVITE_TTL_DAYS 만료 시각. */
function defaultExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** 매장 초대코드 발급(마스터). 만료=now+TTL. 코드 충돌 시 최대 5회 재시도. */
export async function createInviteForStore(input: { storeId: string; createdBy: string }) {
  const expiresAt = defaultExpiry();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await prisma.invite.findUnique({ where: { code } })) continue;
    return prisma.invite.create({
      data: { code, storeId: input.storeId, createdBy: input.createdBy, status: "대기", expiresAt },
    });
  }
  const code = `INV${Date.now().toString(36).toUpperCase()}`;
  return prisma.invite.create({
    data: { code, storeId: input.storeId, createdBy: input.createdBy, status: "대기", expiresAt },
  });
}

/** 매장의 발급 이력(최신순). 마스터 화면 목록용 — 상태/만료 포함. */
export function listStoreInvites(storeId: string) {
  return prisma.invite.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 초대코드 회수(매장 범위, 대기 상태만). 성공 → true.
 * 이미 사용/회수됐거나 다른 매장 코드면 false.
 */
export async function revokeInvite(storeId: string, code: string): Promise<boolean> {
  const res = await prisma.invite.updateMany({
    where: { code: code.trim().toUpperCase(), storeId, status: "대기" },
    data: { status: "회수" },
  });
  return res.count > 0;
}
