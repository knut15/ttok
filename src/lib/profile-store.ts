// 프로필·매장정보 데이터 계층(Prisma 단일 진실원). crewId 키.
import { prisma } from "./prisma";
import type { ProfileResponse, StoreInfo, UserProfile } from "@/types";
import { DEFAULT_CREW_ID, STORE_NAME } from "./constants";

function toUserProfile(row: {
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  avatarInitial: string;
}): UserProfile {
  return {
    name: row.name,
    birthDate: row.birthDate,
    phone: row.phone,
    email: row.email,
    avatarInitial: row.avatarInitial,
  };
}

/** crewId(operationalId 또는 membershipId)의 멤버십(+user, +store). */
function membershipFor(crewId: string) {
  return prisma.membership.findFirst({
    where: { OR: [{ operationalId: crewId }, { id: crewId }] },
    include: { user: true, store: true },
  });
}

/** 프로필+매장+매니저여부. crewId 생략 → 김민정(데모). */
export async function getProfile(crewId: string = DEFAULT_CREW_ID): Promise<ProfileResponse> {
  const [profileRow, membership] = await Promise.all([
    prisma.profile.findUnique({ where: { crewId } }),
    membershipFor(crewId),
  ]);

  const name = profileRow?.name ?? membership?.user?.name ?? crewId;
  const profile: UserProfile = profileRow
    ? toUserProfile(profileRow)
    : {
        name,
        birthDate: "",
        phone: "",
        email: membership?.user?.email ?? "",
        avatarInitial: name.charAt(0) || "?",
      };

  const s = membership?.store;
  const store: StoreInfo = {
    name: s?.name ?? STORE_NAME,
    joinDate: s?.joinDate ?? "",
    employed: true,
    workDays: s?.workDays ?? "",
    workTime: s?.workTime ?? "",
  };

  return { profile, store, isManager: membership?.isManager ?? false };
}

/** 허용 필드(phone/email)만 머지. 프로필 행 없으면 멤버십/유저로 파생 생성. crewId 생략 → 김민정. */
export async function updateProfile(
  patch: { phone?: string; email?: string },
  crewId: string = DEFAULT_CREW_ID,
): Promise<UserProfile> {
  const existing = await prisma.profile.findUnique({ where: { crewId } });
  if (existing) {
    const row = await prisma.profile.update({
      where: { crewId },
      data: {
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      },
    });
    return toUserProfile(row);
  }

  // 프로필 미존재(실 멤버 최초 편집) → 멤버십/유저로 파생 생성.
  const membership = await membershipFor(crewId);
  if (!membership) throw new Error(`membership not found for crewId=${crewId}`);
  const name = membership.user?.name ?? crewId;
  const row = await prisma.profile.create({
    data: {
      storeId: membership.storeId,
      crewId,
      name,
      birthDate: "",
      phone: patch.phone ?? "",
      email: patch.email ?? membership.user?.email ?? "",
      avatarInitial: name.charAt(0) || "?",
    },
  });
  return toUserProfile(row);
}
