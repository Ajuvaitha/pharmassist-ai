import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Patient", "Medicine", "Dosage", "Review"] as const;
export type StepIndex = 0 | 1 | 2 | 3;

export function StepIndicator({
  current,
  onStepClick,
}: {
  current: StepIndex;
  onStepClick?: (i: StepIndex) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-card p-2 shadow-card sm:gap-2 no-print">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={i > current}
              onClick={() => onStepClick?.(i as StepIndex)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors sm:px-3",
                active && "bg-primary/10",
                i > current && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  done && "bg-success text-success-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-bold sm:text-sm",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="hidden h-px w-4 shrink-0 bg-border sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
