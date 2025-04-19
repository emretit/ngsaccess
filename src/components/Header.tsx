
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bell, User, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Ana Sayfa', href: '/' },
  { name: 'Kişiler', href: '/employees' },
  { name: 'Cihazlar', href: '/devices' },
  { name: 'Geçiş Kontrol', href: '/access-control' },
  { name: 'PDKS', href: '/pdks-records' },
  { name: 'Ayarlar', href: '/settings' },
];

export default function Header() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-primary hover:text-primary/80 flex items-center">
              <Home className="h-6 w-6" />
              <span className="ml-2 font-semibold hidden sm:inline">PDKS Sistemi</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-6">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    location.pathname === item.href
                      ? 'text-primary font-medium border-b-2 border-primary pb-1'
                      : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                  } transition-colors`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300 hover:text-primary relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            
            <div ref={profileRef} className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-600 dark:text-gray-300 hover:text-primary"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <User className="h-5 w-5" />
              </Button>
              
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-40 border border-gray-200 dark:border-gray-700">
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Profil
                  </Link>
                  <Link 
                    to="/settings" 
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Ayarlar
                  </Link>
                  <div className="border-t border-gray-200 dark:border-gray-700"></div>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-600 dark:text-gray-300 hover:text-primary"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden mt-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-3">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    location.pathname === item.href
                      ? 'text-primary font-medium'
                      : 'text-gray-600 dark:text-gray-300'
                  } px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
