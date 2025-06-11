
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export const LoadingSpinner = ({ 
  size = "md", 
  className,
  text = "Yükleniyor..."
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  return (
    <div className={cn("flex min-h-screen items-center justify-center", className)}>
      <div className="text-center">
        <div className={cn(
          "animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4",
          sizeClasses[size]
        )} />
        {text && (
          <p className="text-lg font-medium text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
};
