
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PdksFilters {
  dateRange?: { from: Date; to: Date };
  department?: string;
  shift?: string;
}

interface AiInsight {
  text: string;
}

export function usePdksAi() {
  const [insight, setInsight] = useState<string | undefined>(
    "On-time rate improved by 7% since last month. Employee punctuality is trending positively."
  );
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Departman bilgilerini yükle
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from("departments")
          .select("name");
        
        if (error) {
          console.error("Departman verileri yüklenirken hata:", error);
          return;
        }
        
        if (data && data.length > 0) {
          const departmentNames = data.map((dept) => dept.name);
          setDepartments(departmentNames);
          console.log("Yüklenen departmanlar:", departmentNames);
        }
      } catch (error) {
        console.error("Departman yükleme hatası:", error);
      }
    };
    
    loadDepartments();
  }, []);

  const fetchInsight = async (filters: PdksFilters) => {
    setIsLoadingInsight(true);
    try {
      // In a real implementation, this would call your API endpoint
      // For now, we'll simulate a response after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Departman filtresine göre mesajı özelleştir
      if (filters.department) {
        // Departman adını kontrol et ve büyük/küçük harf duyarsız karşılaştır
        const departmentExists = departments.some(
          dept => dept.toLowerCase() === filters.department?.toLowerCase()
        );
        
        if (departmentExists) {
          setInsight(`${filters.department} departmanı için istatistikler: Bu departmanda devamsızlık oranı %4, bu ay önceki aya göre %1.5 düşüş gösterdi.`);
        } else {
          setInsight(`"${filters.department}" adında bir departman bulunamadı. Mevcut departmanlar: ${departments.join(', ')}`);
        }
        return;
      }
      
      // Sample insights based on current date
      const insights = [
        "On-time rate improved by 7% since last month. Employee punctuality is trending positively.",
        "Last week saw 15% fewer absences compared to the monthly average.",
        "3 employees had perfect attendance this month - consider recognition.",
        "IT department has the lowest late arrival rate (2.3%) across all departments this quarter.",
        "Friday has the highest early departure rate (12.7%). Consider reviewing end-of-week workflows.",
      ];
      
      // Select a random insight
      const randomInsight = insights[Math.floor(Math.random() * insights.length)];
      setInsight(randomInsight);
    } catch (error) {
      console.error("Error fetching AI insight:", error);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  return {
    insight,
    isLoadingInsight,
    fetchInsight,
    availableDepartments: departments
  };
}
