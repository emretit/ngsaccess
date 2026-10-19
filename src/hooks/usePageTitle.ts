import { useEffect } from 'react';

const SITE_NAME = 'NGS Plus';

/** Sayfa başlığını "<başlık> · NGS Plus" yapar; sayfadan çıkınca önceki başlığa döner. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
