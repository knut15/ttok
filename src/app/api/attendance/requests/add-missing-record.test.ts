// T15(S3) 통합테스트: 레코드 없는 과거 날짜 추가요청 → 마스터 수락 → approveRequest upsert 로
// 해당 crewId·날짜 레코드 신규 생성 + getRecord/getMonthRecords 반영(캘린더/월조회).
import { describe, it, expect, beforeEach } from "vitest";
import { POST as submitRequest } from "./route";
import { POST as approveRequestRoute } from "./approve/route";
import { getRecord, getMonthRecords } from "@/lib/store";
import { resetDb } from "@/lib/db-seed";

const CREW2 = { "x-crew-id": "crew-2", "x-role": "crew" } as const;
const MASTER = { "x-role": "master" } as const;

function submit(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/attendance/requests", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
function approve(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/attendance/requests/approve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("T15 과거 누락 근무기록 추가 (add → approve → upsert)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("레코드 없는 날 추가요청을 마스터가 수락하면 crew-2 레코드가 신규 생성된다", async () => {
    expect(await getRecord("2026-05-04", "crew-2")).toBeNull();

    const created = await submitRequest(
      submit(
        {
          date: "2026-05-04",
          reason: "출근 미입력 누락 보정",
          after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
        },
        CREW2,
      ),
    );
    expect(created.status).toBe(201);
    const req = await created.json();
    expect(req.status).toBe("대기");
    expect(req.crewId).toBe("crew-2");
    expect(req.before).toEqual({ status: "정상", clockIn: null, clockOut: null });

    expect(await getRecord("2026-05-04", "crew-2")).toBeNull();

    const approved = await approveRequestRoute(approve({ id: req.id }, MASTER));
    expect(approved.status).toBe(200);
    const result = await approved.json();
    expect(result.request.status).toBe("수락");

    const rec = await getRecord("2026-05-04", "crew-2");
    expect(rec).not.toBeNull();
    expect(rec!.clockIn).toBe("08:00");
    expect(rec!.clockOut).toBe("15:00");
    expect(rec!.status).toBe("정상");
    expect(rec!.workMinutes).toBe(390);
  });

  it("수락 후 crew-2 의 2026-05 월조회에 신규 레코드가 포함된다", async () => {
    const before = await getMonthRecords("2026-05", "crew-2");
    expect(before.some((r) => r.date === "2026-05-04")).toBe(false);

    const created = await submitRequest(
      submit(
        {
          date: "2026-05-04",
          reason: "보정",
          after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
        },
        CREW2,
      ),
    );
    const req = await created.json();
    await approveRequestRoute(approve({ id: req.id }, MASTER));

    const after = await getMonthRecords("2026-05", "crew-2");
    expect(after.some((r) => r.date === "2026-05-04")).toBe(true);
  });

  it("출근만(퇴근 null) 추가요청 수락 시 레코드 생성·work/overtime 0", async () => {
    const created = await submitRequest(
      submit(
        {
          date: "2026-05-05",
          reason: "출근만 보정",
          after: { status: "정상", clockIn: "08:00", clockOut: null },
        },
        CREW2,
      ),
    );
    const req = await created.json();
    const approved = await approveRequestRoute(approve({ id: req.id }, MASTER));
    expect(approved.status).toBe(200);
    const rec = await getRecord("2026-05-05", "crew-2");
    expect(rec).not.toBeNull();
    expect(rec!.clockIn).toBe("08:00");
    expect(rec!.clockOut).toBeNull();
    expect(rec!.workMinutes).toBe(0);
    expect(rec!.overtimeMinutes).toBe(0);
  });

  it("crew-2 추가요청 수락은 김민정(default) 레코드를 만들지 않는다", async () => {
    const created = await submitRequest(
      submit(
        {
          date: "2026-05-16",
          reason: "보정",
          after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
        },
        CREW2,
      ),
    );
    const req = await created.json();
    await approveRequestRoute(approve({ id: req.id }, MASTER));
    expect(await getRecord("2026-05-16", "crew-2")).not.toBeNull();
    expect(await getRecord("2026-05-16", "crew-minjung")).toBeNull();
  });
});
