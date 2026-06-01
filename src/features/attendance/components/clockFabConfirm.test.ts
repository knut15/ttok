import { describe, it, expect } from "vitest";
import { nowHHMM } from "@/lib/date";
import { clockOutConfirmMessage } from "./clockFabConfirm";

describe("clockOutConfirmMessage (D: 퇴근 확인 대화상자 문구)", () => {
  it("현재 시각(HH:MM)을 담은 퇴근 확인 메시지를 만든다", () => {
    const msg = clockOutConfirmMessage(new Date(2026, 5, 1, 9, 5));
    expect(msg).toBe("현재 시각 09:05에 퇴근 처리할까요?");
  });

  it("now 미주입 시에도 HH:MM 형식 문구를 만든다", () => {
    const msg = clockOutConfirmMessage();
    expect(msg).toMatch(/^현재 시각 \d{2}:\d{2}에 퇴근 처리할까요\?$/);
  });

  // P2-1: ClockFab 은 단일 now 인스턴스를 캡처해 confirm 메시지와 clockOut(time) 인자에
  //   모두 사용한다. 메시지에 표시된 HH:MM 과 PATCH 로 보낼 nowHHMM(now) 가 동일해야
  //   "표시 시각 = 저장 시각" 보장(분 경계 레이스 차단). 그 계약을 단위로 고정한다.
  it("동일 now 인스턴스로 만든 메시지 시각과 nowHHMM(now)이 일치한다", () => {
    const now = new Date(2026, 5, 1, 9, 5, 59, 999); // 09:05 끝자락(분 경계 직전)
    const time = nowHHMM(now);
    expect(time).toBe("09:05");
    expect(clockOutConfirmMessage(now)).toBe(
      `현재 시각 ${time}에 퇴근 처리할까요?`,
    );
  });
});
