import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";
import { __resetStore, getDaySchedules } from "@/lib/store";
import { MASTER_ID, DEFAULT_CREW_ID, SEED_MONTH } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const MANAGER = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H }; // 김민정=매니저(시드)
const PLAIN_CREW = { "x-role": "crew", "x-crew-id": "crew-2", ...JSON_H };

function post(body: unknown, headers: Record<string, string>) {
  return new Request("http://localhost/api/schedule", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
function del(id: string, headers: Record<string, string>) {
  return new Request(`http://localhost/api/schedule/${id}`, { method: "DELETE", headers });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => __resetStore());

describe("GET /api/schedule (T18)", () => {
  it("월간 스케쥴을 인증 사용자(크루 포함)에게 반환한다", async () => {
    const res = await GET(
      new Request(`http://localhost/api/schedule?month=${SEED_MONTH}`, { headers: PLAIN_CREW }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe(SEED_MONTH);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it("일반 크루는 본인 스케줄만 받는다(권한 스코프)", async () => {
    const body = await (
      await GET(new Request(`http://localhost/api/schedule?month=2026-06`, { headers: PLAIN_CREW }))
    ).json();
    expect(body.canWrite).toBe(false);
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries.every((e: { crewId: string }) => e.crewId === "crew-2")).toBe(true);
    expect(body.fixedShifts.every((f: { crewId: string }) => f.crewId === "crew-2")).toBe(true);
  });

  it("마스터는 전체 크루 스케줄을 받는다", async () => {
    const body = await (
      await GET(new Request(`http://localhost/api/schedule?month=2026-06`, { headers: MASTER }))
    ).json();
    expect(body.canWrite).toBe(true);
    const crewIds = new Set(body.entries.map((e: { crewId: string }) => e.crewId));
    expect(crewIds.size).toBeGreaterThan(1);
  });

  it("매니저는 전체 크루 스케줄을 받는다", async () => {
    const body = await (
      await GET(new Request(`http://localhost/api/schedule?month=2026-06`, { headers: MANAGER }))
    ).json();
    expect(body.canWrite).toBe(true);
    const crewIds = new Set(body.entries.map((e: { crewId: string }) => e.crewId));
    expect(crewIds.size).toBeGreaterThan(1);
  });
});

describe("POST /api/schedule — 작성 권한 (T18)", () => {
  const VALID = { date: `${SEED_MONTH}-20`, crewId: "crew-2", startTime: "09:00", endTime: "18:00" };

  it("마스터는 배정 생성 가능 → 200", async () => {
    const res = await POST(post(VALID, MASTER));
    expect(res.status).toBe(200);
    expect(getDaySchedules(VALID.date)).toHaveLength(1);
  });

  it("매니저(김민정)는 배정 생성 가능 → 200", async () => {
    const res = await POST(post(VALID, MANAGER));
    expect(res.status).toBe(200);
  });

  it("일반 크루는 작성 불가 → 403", async () => {
    const res = await POST(post(VALID, PLAIN_CREW));
    expect(res.status).toBe(403);
  });

  it("종료<=시작 시간 → 400", async () => {
    const res = await POST(post({ ...VALID, startTime: "18:00", endTime: "09:00" }, MASTER));
    expect(res.status).toBe(400);
  });

  it("없는/비근무자 crewId → 400 (master 대상도 거부)", async () => {
    expect((await POST(post({ ...VALID, crewId: "nope" }, MASTER))).status).toBe(400);
    expect((await POST(post({ ...VALID, crewId: MASTER_ID }, MASTER))).status).toBe(400);
  });

  it("off=true 면 시간 검증 없이 휴무로 저장 → 200", async () => {
    const res = await POST(post({ date: `${SEED_MONTH}-21`, crewId: "crew-3", off: true }, MASTER));
    expect(res.status).toBe(200);
    const entry = await res.json();
    expect(entry.off).toBe(true);
  });

  it("createdBy 는 작성자 scope 로 기록된다", async () => {
    const res = await POST(post(VALID, MANAGER));
    const entry = await res.json();
    expect(entry.createdBy).toBe(DEFAULT_CREW_ID);
  });
});

describe("DELETE /api/schedule/[id] (T18)", () => {
  it("마스터는 삭제 가능 → 200", async () => {
    const created = await (await POST(post({ date: `${SEED_MONTH}-22`, crewId: "crew-2", startTime: "09:00", endTime: "18:00" }, MASTER))).json();
    const res = await DELETE(del(created.id, MASTER), ctx(created.id));
    expect(res.status).toBe(200);
    expect(getDaySchedules(`${SEED_MONTH}-22`)).toEqual([]);
  });

  it("일반 크루는 삭제 불가 → 403", async () => {
    const res = await DELETE(del("sch-seed-1", PLAIN_CREW), ctx("sch-seed-1"));
    expect(res.status).toBe(403);
  });

  it("없는 id → 404", async () => {
    const res = await DELETE(del("nope", MASTER), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
