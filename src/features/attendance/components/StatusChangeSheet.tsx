"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { WORK_STATUSES } from "@/lib/constants";

// 상태 변경 바텀시트(범용): 옵션 라디오 + 변경 버튼 → onChange.
// 출근(정상/지각/결근/휴가)·퇴근(정상/연장) 양쪽에서 재사용.
export function StatusChangeSheet({
  open,
  current,
  options = WORK_STATUSES,
  title = "출근상태 변경",
  onClose,
  onChange,
}: {
  open: boolean;
  current: string;
  options?: readonly string[];
  title?: string;
  onClose: () => void;
  onChange: (status: string) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string>(current);

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="space-y-1">
        {options.map((status) => (
          <li key={status}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="radio"
                name={`status-${title}`}
                value={status}
                checked={selected === status}
                onChange={() => setSelected(status)}
                className="h-5 w-5 accent-coral"
              />
              <span className="text-base">{status}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={async () => {
          await onChange(selected);
          onClose();
        }}
        className="mt-3 w-full rounded-xl bg-coral py-3 font-bold text-white"
      >
        변경
      </button>
    </BottomSheet>
  );
}
