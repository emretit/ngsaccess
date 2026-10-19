import { useLayoutEffect } from 'react';

/**
 * Oturumsuz sayfalar her zaman açık temadadır: uygulamadan (ör. Ayarlar'daki önizleme cleanup'ı) kalan `.dark`'ı boyamadan önce kaldırır.
 * Koyu tema tercihi uygulama kabuğunda (`Layout` → `useDarkMode`) yeniden uygulanır.
 */
export function usePublicTheme() {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);
}
