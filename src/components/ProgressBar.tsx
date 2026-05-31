// 진행바(presentational, percent props). 좌우 라벨 슬롯.
export function ProgressBar({
  percent,
  leftLabel,
  rightLabel,
}: {
  percent: number;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-coral transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
