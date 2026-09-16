import { CircleCheck, Loader2 } from "@/lib/icons";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface InstallProgressProps {
  steps: readonly string[];
  currentStep: number;
  done: boolean;
}

export function InstallProgress({ steps, currentStep, done }: InstallProgressProps) {
  return (
    <div className="mx-auto max-w-md space-y-6 py-12 text-center">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {done ? "Server created" : "Setting up your server"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {done ? "Redirecting to your new server..." : "This usually takes less than a minute."}
        </p>
      </div>

      <Progress value={done ? 100 : ((currentStep + 1) / steps.length) * 100} />

      <div className="space-y-2.5 text-left">
        {steps.map((step, index) => {
          const isComplete = index < currentStep || done;
          const isCurrent = index === currentStep && !done;
          return (
            <div key={step} className="flex items-center gap-3 text-sm">
              {isComplete ? (
                <CircleCheck className="size-4 shrink-0 text-status-online" />
              ) : isCurrent ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-status-info" />
              ) : (
                <div className="size-4 shrink-0 rounded-full border border-border" />
              )}
              <span className={cn(isComplete || isCurrent ? "text-foreground" : "text-muted-foreground")}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
