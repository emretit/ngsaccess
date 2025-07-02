
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const loadDarkModeSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('general_settings')
          .select('dark_mode')
          .maybeSingle();

        if (error) {
          console.error('Error loading dark mode setting:', error);
          return;
        }

        const darkModeEnabled = data?.dark_mode || false;
        setIsDarkMode(darkModeEnabled);
        
        if (darkModeEnabled) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.error('Error in loadDarkModeSetting:', error);
      }
    };

    loadDarkModeSetting();
  }, []);

  const toggleDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return { isDarkMode, toggleDarkMode };
}
