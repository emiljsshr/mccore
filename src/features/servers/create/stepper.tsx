import { Check } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li key={step} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  isCurrent && "bg-primary text-primary-foreground",
                  isComplete && "text-status-online",
                  !isCurrent && !isComplete && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border text-[10px]",
                    isCurrent && "border-primary-foreground/40",
                    isComplete && "border-status-online bg-status-online-muted",
                    !isCurrent && !isComplete && "border-border",
                  )}
                >
                  {isComplete ? <Check className="size-2.5" /> : index + 1}
                </span>
                {step}
              </div>
              {index < steps.length - 1 && <div className="h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
