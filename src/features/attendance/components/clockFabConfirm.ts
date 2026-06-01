// 퇴근 확인 대화상자 문구(T12 AC-3). 순수 — now 주입 가능(결정적 테스트).
//   ClockFab 의 clockOut 분기에서 window.confirm(메시지)로 사용. 출근(clockIn)은 확인 없이 즉시.
import { nowHHMM } from "@/lib/date";

export function clockOutConfirmMessage(now: Date = new Date()): string {
  return `현재 시각 ${nowHHMM(now)}에 퇴근 처리할까요?`;
}
