import { describe, it, expect, beforeEach } from "vitest";
import { getProfile, updateProfile } from "./store";
import { resetDb } from "./db-seed";

beforeEach(async () => {
  await resetDb();
});

describe("getProfile — 시드", () => {
  it("프로필+매장 시드 필드를 반환한다", async () => {
    const { profile, store } = await getProfile();
    expect(profile.name).toBe("김민정");
    expect(profile.birthDate).toBe("1986-04-06");
    expect(profile.phone).toBe("010-3126-7299");
    expect(profile.email).toBe("24joy@naver.com");
    expect(profile.avatarInitial).toBe("김");
    expect(store.name).toBe("매머드커피 익스프레스 마석경춘로점");
    expect(store.joinDate).toBe("2026-04-01");
    expect(store.workDays).toBe("월 ~ 금");
    expect(store.workTime).toBe("08:00~15:00");
  });
});

describe("updateProfile — 휴대폰/이메일 갱신", () => {
  it("phone/email을 머지하고 name/birthDate/avatarInitial은 보존한다", async () => {
    await updateProfile({ phone: "010-0000-0000", email: "new@x.com" });
    const { profile } = await getProfile();
    expect(profile.phone).toBe("010-0000-0000");
    expect(profile.email).toBe("new@x.com");
    expect(profile.name).toBe("김민정");
    expect(profile.birthDate).toBe("1986-04-06");
    expect(profile.avatarInitial).toBe("김");
  });

  it("phone만 넘기면 email은 직전 값을 유지한다(부분 머지)", async () => {
    await updateProfile({ phone: "010-1234-5678" });
    const { profile } = await getProfile();
    expect(profile.phone).toBe("010-1234-5678");
    expect(profile.email).toBe("24joy@naver.com");
  });
});

describe("updateProfile — 읽기전용 강제 + 격리", () => {
  it("name/birthDate를 런타임에 섞어 넣어도 무시한다(화이트리스트)", async () => {
    await updateProfile({
      name: "다른이름",
      birthDate: "2000-01-01",
      phone: "010-9999-9999",
    } as Parameters<typeof updateProfile>[0]);
    const { profile } = await getProfile();
    expect(profile.name).toBe("김민정");
    expect(profile.birthDate).toBe("1986-04-06");
    expect(profile.phone).toBe("010-9999-9999");
  });

  it("resetDb 후 시드값으로 복원된다", async () => {
    await updateProfile({ phone: "010-0000-0000" });
    await resetDb();
    expect((await getProfile()).profile.phone).toBe("010-3126-7299");
  });
});
