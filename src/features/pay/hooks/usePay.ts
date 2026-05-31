"use client";

import { useEffect, useState } from "react";
import type { PayResponse, PayDetail } from "@/types";

const NO_STORE: RequestInit = { cache: "no-store" };

export function useMonthPay(month: string) {
  const [data, setData] = useState<PayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/pay?month=${month}`, NO_STORE)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: PayResponse | null) => {
        if (!active) return;
        setData(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);

  return { data, loading };
}

export function useDayPay(date: string) {
  const [detail, setDetail] = useState<PayDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/pay/${date}`, NO_STORE)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: PayDetail | null) => {
        if (!active) return;
        setDetail(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  return { detail, loading };
}
