
import { useToast } from '@/components/ui/use-toast';

// Basit bir placeholder hook - şimdilik sadece boş data döndürüyor
export const useAccessRules = () => {
  const { toast } = useToast();

  return {
    rules: [],
    isLoading: false,
    createRule: () => {
      toast({
        title: "Bilgi",
        description: "Access rules sistemi yeniden yapılandırılıyor...",
      });
    },
    isCreating: false,
    toggleRule: () => {
      toast({
        title: "Bilgi", 
        description: "Access rules sistemi yeniden yapılandırılıyor...",
      });
    },
    isToggling: false
  };
};
