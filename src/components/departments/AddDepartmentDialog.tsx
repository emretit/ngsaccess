
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface AddDepartmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function AddDepartmentDialog({
  isOpen,
  onOpenChange,
  onAdd,
  title = "Yeni Departman Ekle",
  description = "Departmanın adını girin"
}: AddDepartmentDialogProps) {
  const [departmentName, setDepartmentName] = useState("");

  const handleAdd = async () => {
    await onAdd(departmentName);
    setDepartmentName("");
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={departmentName}
          onChange={(e) => setDepartmentName(e.target.value)}
          placeholder="Departman adı"
          className="my-4"
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setDepartmentName("");
            onOpenChange(false);
          }}>
            İptal
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleAdd}>
            Ekle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
