// 상태/연장/휴가 배지(presentational, tone props만). architect §1.1.
import type { Tone } from "@/lib/constants";

const TONE_CLASS: Record<Tone, string> = {
  coral: "bg-coral-soft text-coral",
  green: "bg-statusgreen text-white",
  blue: "bg-statusblue/10 text-statusblue",
  gray: "bg-graybadge text-white",
  neutral: "bg-foreground/5 text-muted",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${TONE_CLASS[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
