
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  inline?: boolean;
}

export const LoadingSpinner = ({
  size = "md",
  className,
  text = "Yükleniyor...",
  inline = false,
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        inline ? "py-12" : "min-h-screen",
        className
      )}
    >
      <div className="text-center">
        <div
          className={cn(
            "animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4",
            sizeClasses[size]
          )}
        />
        {text && (
          <p className={cn(
            "font-medium text-muted-foreground",
            inline ? "text-sm" : "text-lg"
          )}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
};
