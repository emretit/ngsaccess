import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Sayfa bulunamadı');
  return (
    <StatusScreen
      tone="info"
      title="Bu sayfayı bulamadık."
      description="Bağlantı değişmiş veya adres yanlış yazılmış olabilir. Ana sayfadan devam edebilirsiniz."
      primaryAction={{ label: 'Ana sayfaya dön', href: '/' }}
      secondaryAction={{ label: 'Hesabınıza giriş yapın', href: '/login' }}
    />
  );
}
