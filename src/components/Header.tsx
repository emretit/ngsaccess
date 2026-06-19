
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Dices, Shield, FileText, Settings, Bell, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Kişiler', href: '/employees', icon: Users },
  { name: 'Cihazlar', href: '/devices', icon: Dices },
  { name: 'Geçiş Kontrol', href: '/access-control', icon: Shield },
  { name: 'PDKS Kayıtları', href: '/pdks-records', icon: FileText },
  { name: 'Ayarlar', href: '/settings', icon: Settings },
];

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, profile, signOut } = useAuth();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Get user display name from profile or email
  const getUserDisplayName = () => {
    if (profile?.email) {
      return profile.email.split('@')[0];
    }
    return user?.email?.split('@')[0] || 'Kullanıcı';
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'KU';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-30 shadow-xs">
      <div className="px-4 lg:px-6 xl:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/home" className="flex items-center mr-6">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold">
                P
              </div>
              <span className="ml-2 text-xl font-semibold text-foreground">PDKS</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-4 lg:space-x-6">
              {navigation.map(item => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      location.pathname === item.href
                        ? 'text-primary font-medium border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-[#711A1A] dark:hover:text-[#f2b4b4]'
                    } transition-colors flex items-center py-2 px-1`}
                  >
                    <IconComponent className="h-4 w-4 mr-1.5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" aria-label="Bildirimler" className="text-muted-foreground hover:text-[#711A1A] dark:hover:text-[#f2b4b4] relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
            </Button>
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2 hover:bg-muted rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.photoUrl || ''} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-primary text-white">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm hidden sm:inline">{getUserDisplayName()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-4 py-2">
                  <p className="text-sm font-medium">{getUserDisplayName()}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="w-full cursor-pointer">
                    Profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="w-full cursor-pointer">
                    Ayarlar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-red-600 dark:text-red-400 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950 cursor-pointer"
                >
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-muted-foreground"
                aria-label={isMobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-1">
              {navigation.map(item => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      location.pathname === item.href
                        ? 'bg-muted text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50'
                    } px-4 py-3 rounded-md transition-colors flex items-center`}
                  >
                    <IconComponent className="h-5 w-5 mr-3" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
