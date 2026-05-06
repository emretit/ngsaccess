
import { CheckCircle, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
  current?: boolean;
}

interface OnboardingProgressProps {
  steps: OnboardingStep[];
  currentStep: string;
}

export function OnboardingProgress({ steps, currentStep }: OnboardingProgressProps) {
  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <div className="bg-card border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Kurulum İlerlemesi</h3>
        <Badge variant={progressPercentage === 100 ? "success" : "warning"}>
          {Math.round(progressPercentage)}% Tamamlandı
        </Badge>
      </div>
      
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const isCurrent = step.key === currentStep;

          return (
            <div 
              key={step.key}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isCurrent ? 'bg-primary/10 border border-primary/20' : ''
              }`}
            >
              {step.completed ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : isCurrent ? (
                <Clock className="w-5 h-5 text-[#711A1A]" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/70" />
              )}
              
              <span className={`font-medium ${
                isCurrent ? 'text-[#711A1A]' : 
                step.completed ? 'text-green-600' : 
                'text-muted-foreground'
              }`}>
                {step.label}
              </span>
              
              {step.completed && (
                <Badge variant="success" className="ml-auto text-xs">
                  Tamamlandı
                </Badge>
              )}
              
              {isCurrent && (
                <Badge variant="warning" className="ml-auto text-xs">
                  Mevcut Adım
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
