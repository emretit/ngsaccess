import { Button } from "@/components/ui/button";
export function EmployeePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Personel sayfaları"
      className="flex flex-wrap items-center justify-end gap-3 text-xs"
    >
      <span aria-live="polite">
        Sayfa {currentPage} / {Math.max(1, totalPages)}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Önceki
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Sonraki
      </Button>
    </nav>
  );
}
