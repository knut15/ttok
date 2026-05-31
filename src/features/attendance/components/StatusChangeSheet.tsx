"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { WORK_STATUSES } from "@/lib/constants";
import type { WorkStatus } from "@/types";

// 출근상태 변경 바텀시트(AC-15): 라디오 5종 + 변경 버튼 → PATCH.
export function StatusChangeSheet({
  open,
  current,
  onClose,
  onChange,
}: {
  open: boolean;
  current: WorkStatus;
  onClose: () => void;
  onChange: (status: WorkStatus) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<WorkStatus>(current);

  return (
    <BottomSheet open={open} onClose={onClose} title="출근상태 변경">
      <ul className="space-y-1">
        {WORK_STATUSES.map((status) => (
          <li key={status}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="radio"
                name="work-status"
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
