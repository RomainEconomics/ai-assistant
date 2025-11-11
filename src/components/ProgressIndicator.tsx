/**
 * Progress indicator component for tracking long-running operations
 * Used for batch queries and document processing
 */
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  showFraction?: boolean;
}

export function ProgressIndicator({
  current,
  total,
  label,
  showPercentage = true,
  showFraction = true,
}: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{label}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Progress value={percentage} className="flex-1" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[80px]">
          {showFraction && (
            <span className="font-mono">
              {current}/{total}
            </span>
          )}
          {showPercentage && (
            <span className="font-mono">
              {percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
