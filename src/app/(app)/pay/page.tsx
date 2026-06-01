// /pay RSC 셸(AC-17, AC-T6-8): 현재월 계산은 client 래퍼 PayView로 위임.
// RSC page 에 'use client' 침범 금지 — 셸은 RSC 유지하고 동적 월 계산을 경계로 지역화.
import { PayView } from "@/features/pay/components/PayView";

export default function PayPage() {
  return <PayView />;
}
