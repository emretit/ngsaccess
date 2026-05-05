import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface PdksFilters {
  dateRange?: { from: Date; to: Date };
  department?: string;
  shift?: string;
}

export function usePdksAi() {
  const [insight, setInsight] = useState<string | undefined>(
    "On-time rate improved by 7% since last month. Employee punctuality is trending positively."
  );
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const departmentsRaw = useQuery(api.departments.list, {});
  const departments = (departmentsRaw ?? []).map((d: { name: string }) => d.name);

  const fetchInsight = async (filters: PdksFilters) => {
    setIsLoadingInsight(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (filters.department) {
        const departmentExists = departments.some(
          (dept: string) => dept.toLowerCase() === filters.department?.toLowerCase()
        );
        if (departmentExists) {
          setInsight(
            `${filters.department} departmanı için geçen aya göre devam oranı %5 arttı.`
          );
        } else {
          setInsight("Seçili departman için yeterli veri bulunamadı.");
        }
      } else if (filters.shift) {
        setInsight(`${filters.shift} vardiyası için devam verileri analiz edildi.`);
      } else {
        setInsight("Genel devam oranı geçen aya göre %7 arttı.");
      }
    } finally {
      setIsLoadingInsight(false);
    }
  };

  return { insight, isLoadingInsight, departments, fetchInsight };
}
