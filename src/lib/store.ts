// 운영 데이터 배럴 — Prisma 단일 진실원(인메모리 store 완전 제거, P3).
// 라우트/테스트는 도메인 모듈 대신 이 배럴(@/lib/store)에서 import (기존 import 경로 보존).
export {
  getMonthRecords,
  getRecord,
  updateStatus,
  upsertTodayClock,
  listRequests,
  listRequestsForCrews,
  addRequest,
  approveRequest,
  getCrewAggregate,
} from "./attendance-store";
export type { NewEditRequest } from "./attendance-store";

export {
  getMonthSchedules,
  getDaySchedules,
  getMonthScheduleView,
  upsertSchedule,
  removeSchedule,
  listPendingSubstitutes,
  approveSubstitute,
  listFixedShifts,
  crewFixedWeekdays,
  addFixedShift,
  removeFixedShift,
  updateFixedShift,
  pushNotification,
  listNotifications,
  unreadNotificationCount,
  markNotificationsRead,
} from "./schedule-store";
export type { NewSchedule, NewFixedShift, FixedShiftPatch } from "./schedule-store";

export { getProfile, updateProfile } from "./profile-store";

export { canWriteSchedule, listStoreCrews } from "./identity-repo";
