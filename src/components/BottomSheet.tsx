"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

// 바텀시트 모달 셸(AC-19d). open/onClose/children. 바디 스크롤 락.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <span className="text-base font-bold">{title}</span>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-2xl leading-none text-muted"
          >
            ×
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
