import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const { user } = useAuth();
  return <main className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
    <div className="space-y-4 text-center"><h1 className="text-4xl font-bold">404</h1><p className="text-xl text-muted-foreground">Sayfa bulunamadı</p><Button asChild><Link to={user && user.verified !== false ? '/home' : '/'}>Ana sayfaya dön</Link></Button></div>
  </main>;
}
