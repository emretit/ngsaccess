
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface StepNavigationProps {
  currentStep: string;
  steps: string[];
  onStepChange: (step: string) => void;
  canProceed?: boolean;
}

export function StepNavigation({ currentStep, steps, onStepChange, canProceed = true }: StepNavigationProps) {
  const currentIndex = steps.findIndex(step => step === currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(steps[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (!isLastStep && canProceed) {
      onStepChange(steps[currentIndex + 1]);
    }
  };

  return (
    <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-8">
      <Button
        variant="outline"
        onClick={handlePrevious}
        disabled={isFirstStep}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Önceki Adım
      </Button>

      <div className="text-sm text-gray-600">
        Adım {currentIndex + 1} / {steps.length}
      </div>

      <Button
        onClick={handleNext}
        disabled={isLastStep || !canProceed}
        className="flex items-center gap-2 bg-[#711A1A] hover:bg-[#5a1515]"
      >
        {isLastStep ? 'Kurulumu Tamamla' : 'Sonraki Adım'}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
