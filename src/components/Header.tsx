
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Kişiler', href: '/employees' },
  { name: 'Cihazlar', href: '/devices' },
  { name: 'Geçiş Kontrol', href: '/access-control' },
  { name: 'Erişim Grupları', href: '/access-groups' },
  { name: 'PDKS', href: '/pdks-records' },
  { name: 'Ayarlar', href: '/settings' },
];

export default function Header() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-primary hover:text-primary/80">
              <Home className="h-6 w-6" />
            </Link>
            <nav className="hidden md:flex space-x-4">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    location.pathname === item.href
                      ? 'text-primary font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300 hover:text-primary">
              <Bell className="h-5 w-5" />
            </Button>
            <div ref={profileRef}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-600 dark:text-gray-300 hover:text-primary"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
