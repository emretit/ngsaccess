import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, "type">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input {...props} ref={ref} disabled={disabled} type={visible ? "text" : "password"} className={cn("min-h-11 pr-12", className)} />
        <Button type="button" variant="ghost" size="icon" disabled={disabled}
          className="absolute right-0 top-0 h-11 w-11"
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={visible}
          aria-controls={props.id} onClick={() => setVisible((value) => !value)}>
          {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        </Button>
      </div>
    );
  }
);
PasswordField.displayName = "PasswordField";
