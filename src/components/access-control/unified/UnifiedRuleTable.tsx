
import { useAccessRules } from "@/hooks/useAccessRules";
import { Loader2 } from "lucide-react";

const UnifiedRuleTable = () => {
  const { rules, isLoading } = useAccessRules();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">📋</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Access Rules Sistemi Yeniden Yapılandırılıyor
      </h3>
      <p className="text-gray-600">
        Sistem temizlendi ve yeniden kurulacak.
      </p>
    </div>
  );
};

export default UnifiedRuleTable;
