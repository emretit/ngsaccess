
import { cn } from "@/lib/utils";

interface AiMessageProps {
  message: {
    id: string;
    type: "user" | "assistant";
    content: string;
  };
}

export function AiMessage({ message }: AiMessageProps) {
  const isUser = message.type === "user";

  return (
    <div
      className={cn(
        "flex w-full my-2",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[85%] text-sm animate-fade-in",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
